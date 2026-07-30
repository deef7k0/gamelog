/**
 * Steam synchronisation service.
 *
 * One request syncs one section, so the cheap parts stay fresh without dragging
 * the expensive parts along. The cost spread is the whole reason:
 *
 *   profile       1 request
 *   library       1 request
 *   badges        1 request
 *   friends       1 + ceil(friends / 100) requests
 *   inventory     1 request per supported game (strict community rate limit)
 *   achievements  2-3 requests PER OWNED GAME
 *
 * A 500-game library is ~1,200 requests for a full achievement scan, which is
 * why that section processes a bounded batch per run, ordered by playtime so the
 * games a user actually cares about are populated first, and reports `hasMore`
 * so the client can keep going.
 *
 * ## Deploy
 *   supabase secrets set STEAM_API_KEY=xxxxxxxx
 *   supabase functions deploy steam-sync
 *
 * JWT verification stays ON here — every caller is an authenticated app user.
 */

import { jsonResponse, preflight } from '../_shared/http.ts';
import { adminClient, userFromRequest } from '../_shared/supabase-admin.ts';
import {
  SUPPORTED_INVENTORIES,
  SteamApi,
  SteamPrivateError,
  appCoverUrl,
  appIconUrl,
  economyImageUrl,
  isoFromUnix,
  rarityRank,
  statusFrom,
  visibilityFrom,
  type RawInventoryDescription,
} from '../_shared/steam-api.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const PROVIDER = 'steam';

type Section = 'profile' | 'library' | 'achievements' | 'inventory' | 'badges' | 'friends';

const SECTIONS: Section[] = [
  'profile',
  'library',
  'achievements',
  'inventory',
  'badges',
  'friends',
];

/**
 * Minimum seconds between runs of each section.
 *
 * These are the "avoid unnecessary requests" policy in one place. Presence
 * changes minute to minute so `profile` is cheap and frequent; a library barely
 * changes day to day; inventories are throttled hardest by Steam itself.
 */
const SECTION_TTL_SECONDS: Record<Section, number> = {
  profile: 5 * 60,
  library: 30 * 60,
  achievements: 6 * 60 * 60,
  inventory: 60 * 60,
  badges: 6 * 60 * 60,
  friends: 6 * 60 * 60,
};

/** Owned games to scan for achievements per run. 15 games ≈ 30-45 requests. */
const ACHIEVEMENT_BATCH = 15;

/** Items to keep per inventory. Featured showcases need depth, not everything. */
const INVENTORY_ITEM_CAP = 200;

/** PostgREST is happy with large payloads, but chunking keeps memory flat. */
const UPSERT_CHUNK = 500;

type SyncResult = {
  status: 'ok' | 'partial' | 'private' | 'error';
  written: number;
  hasMore: boolean;
  message: string | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function upsertChunked(
  admin: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string
): Promise<void> {
  for (let index = 0; index < rows.length; index += UPSERT_CHUNK) {
    const chunk = rows.slice(index, index + UPSERT_CHUNK);
    const { error } = await admin.from(table).upsert(chunk, { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// profile
// ---------------------------------------------------------------------------

async function syncProfile(
  admin: SupabaseClient,
  api: SteamApi,
  userId: string,
  steamId: string
): Promise<SyncResult> {
  const summary = await api.getPlayerSummary(steamId);
  if (!summary) {
    return { status: 'error', written: 0, hasMore: false, message: 'Steam returned no profile.' };
  }

  const visibility = visibilityFrom(summary.communityvisibilitystate);

  // Level and XP are readable even on many private profiles, so they are fetched
  // regardless and simply left null when Steam declines.
  const [level, badges] = await Promise.all([
    api.getSteamLevel(steamId).catch(() => null),
    api.getBadges(steamId).catch(() => ({})),
  ]);

  const { error } = await admin
    .from('gaming_accounts')
    .update({
      handle: summary.personaname ?? null,
      display_name: summary.realname ?? summary.personaname ?? null,
      avatar_url: summary.avatarfull ?? summary.avatarmedium ?? summary.avatar ?? null,
      profile_url: summary.profileurl ?? `https://steamcommunity.com/profiles/${steamId}`,
      country: summary.loccountrycode ?? null,
      level: level ?? badges.player_level ?? null,
      xp: badges.player_xp ?? null,
      visibility,
      status: statusFrom(summary.personastate),
      current_game_app_id: summary.gameid ?? null,
      current_game_name: summary.gameextrainfo ?? null,
      last_synced_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('provider', PROVIDER);

  if (error) throw new Error(error.message);

  return {
    status: visibility === 'private' ? 'private' : 'ok',
    written: 1,
    hasMore: false,
    message: visibility === 'private' ? 'This Steam profile is private.' : null,
  };
}

// ---------------------------------------------------------------------------
// library
// ---------------------------------------------------------------------------

async function syncLibrary(
  admin: SupabaseClient,
  api: SteamApi,
  userId: string,
  steamId: string
): Promise<SyncResult> {
  const games = await api.getOwnedGames(steamId);

  // Steam answers a private "game details" setting with null/empty rather than an
  // error, so an empty library on an otherwise reachable profile is reported as
  // private instead of as a genuine zero.
  if (!games || games.length === 0) {
    return {
      status: 'private',
      written: 0,
      hasMore: false,
      message: 'Steam did not share this library. Game details may be set to private.',
    };
  }

  const syncedAt = new Date().toISOString();

  const rows = games.map((game) => ({
    user_id: userId,
    provider: PROVIDER,
    app_id: String(game.appid),
    name: game.name?.trim() || `App ${game.appid}`,
    icon_url: appIconUrl(game.appid, game.img_icon_url),
    playtime_minutes: game.playtime_forever ?? 0,
    playtime_recent_minutes: game.playtime_2weeks ?? 0,
    last_played_at: isoFromUnix(game.rtime_last_played),
    // Steam exposes no purchase date anywhere in its Web API. Left null on
    // purpose so the "recently purchased" sort stays honestly unavailable.
    acquired_at: null,
    synced_at: syncedAt,
  }));

  await upsertChunked(admin, 'gaming_owned_games', rows, 'user_id,provider,app_id');

  // Anything not touched by this run is no longer owned (refunds, family sharing
  // changes, delisted apps).
  await admin
    .from('gaming_owned_games')
    .delete()
    .eq('user_id', userId)
    .eq('provider', PROVIDER)
    .lt('synced_at', syncedAt);

  // Link to the shared `games` cache in one set-based statement so tapping a
  // library entry can open the normal game page.
  const { error: linkError } = await admin.rpc('link_gaming_owned_games', {
    p_user_id: userId,
    p_provider: PROVIDER,
  });
  if (linkError) {
    // Non-fatal: the library still renders, entries just are not tappable
    // through to a cached game page yet.
    console.warn(`link_gaming_owned_games failed: ${linkError.message}`);
  }

  return { status: 'ok', written: rows.length, hasMore: false, message: null };
}

// ---------------------------------------------------------------------------
// achievements
// ---------------------------------------------------------------------------

/**
 * Scan a bounded batch of games for achievements.
 *
 * `achievements_synced_at` is the resume cursor: games are picked oldest-scan
 * first (nulls first) but ordered by playtime, so a fresh account fills in its
 * most-played titles immediately and the long tail catches up over later runs.
 */
async function syncAchievements(
  admin: SupabaseClient,
  api: SteamApi,
  userId: string,
  steamId: string
): Promise<SyncResult> {
  const staleBefore = new Date(Date.now() - SECTION_TTL_SECONDS.achievements * 1000).toISOString();

  const { data: candidates, error: pickError } = await admin
    .from('gaming_owned_games')
    .select('app_id, name, playtime_minutes, achievements_synced_at')
    .eq('user_id', userId)
    .eq('provider', PROVIDER)
    .or(`achievements_synced_at.is.null,achievements_synced_at.lt.${staleBefore}`)
    .order('playtime_minutes', { ascending: false })
    .limit(ACHIEVEMENT_BATCH);

  if (pickError) throw new Error(pickError.message);
  if (!candidates || candidates.length === 0) {
    return { status: 'ok', written: 0, hasMore: false, message: null };
  }

  const achievementRows: Record<string, unknown>[] = [];
  const rollups: Record<string, unknown>[] = [];
  const scannedAt = new Date().toISOString();
  let sawPrivate = false;

  for (const game of candidates) {
    const appId = game.app_id as string;

    let unlocks: Awaited<ReturnType<SteamApi['getPlayerAchievements']>>;
    try {
      unlocks = await api.getPlayerAchievements(steamId, appId);
    } catch (caught) {
      if (caught instanceof SteamPrivateError) {
        sawPrivate = true;
        break;
      }
      throw caught;
    }

    // Null means this game has no achievement support at all — record that so it
    // is not rescanned every cycle.
    if (!unlocks) {
      rollups.push({
        user_id: userId,
        provider: PROVIDER,
        app_id: appId,
        name: game.name,
        achievements_total: 0,
        achievements_unlocked: 0,
        achievements_synced_at: scannedAt,
      });
      continue;
    }

    const [schema, globalPercents] = await Promise.all([
      api.getSchemaAchievements(appId),
      api.getGlobalAchievementPercentages(appId),
    ]);

    const schemaByKey = new Map(schema.map((entry) => [entry.name, entry]));

    for (const unlock of unlocks) {
      const definition = schemaByKey.get(unlock.apiname);
      achievementRows.push({
        user_id: userId,
        provider: PROVIDER,
        app_id: appId,
        achievement_key: unlock.apiname,
        name: definition?.displayName || unlock.name || unlock.apiname,
        description: definition?.description ?? unlock.description ?? null,
        icon_url: definition?.icon ?? null,
        icon_gray_url: definition?.icongray ?? null,
        unlocked: unlock.achieved === 1,
        unlocked_at: unlock.achieved === 1 ? isoFromUnix(unlock.unlocktime) : null,
        global_percent: globalPercents.get(unlock.apiname) ?? null,
        synced_at: scannedAt,
      });
    }

    const unlockedCount = unlocks.filter((entry) => entry.achieved === 1).length;
    rollups.push({
      user_id: userId,
      provider: PROVIDER,
      app_id: appId,
      name: game.name,
      achievements_total: unlocks.length,
      achievements_unlocked: unlockedCount,
      achievements_synced_at: scannedAt,
    });
  }

  if (achievementRows.length > 0) {
    await upsertChunked(
      admin,
      'gaming_achievements',
      achievementRows,
      'user_id,provider,app_id,achievement_key'
    );
  }
  if (rollups.length > 0) {
    await upsertChunked(admin, 'gaming_owned_games', rollups, 'user_id,provider,app_id');
  }

  if (sawPrivate) {
    return {
      status: 'private',
      written: achievementRows.length,
      hasMore: false,
      message: 'Steam game details are private, so achievements cannot be read.',
    };
  }

  // Anything left to do? If this run filled its batch, assume so.
  const hasMore = candidates.length === ACHIEVEMENT_BATCH;

  return {
    status: hasMore ? 'partial' : 'ok',
    written: achievementRows.length,
    hasMore,
    message: hasMore ? `Scanned ${candidates.length} games; more remaining.` : null,
  };
}

// ---------------------------------------------------------------------------
// inventory
// ---------------------------------------------------------------------------

function rarityOf(description: RawInventoryDescription): {
  label: string | null;
  internal: string | undefined;
} {
  const tag = description.tags?.find((entry) => entry.category === 'Rarity');
  return { label: tag?.localized_tag_name ?? null, internal: tag?.internal_name };
}

async function syncInventory(
  admin: SupabaseClient,
  api: SteamApi,
  userId: string,
  steamId: string
): Promise<SyncResult> {
  const syncedAt = new Date().toISOString();
  const rows: Record<string, unknown>[] = [];
  let privateCount = 0;
  let attempted = 0;

  for (const target of SUPPORTED_INVENTORIES) {
    attempted++;
    let payload: Awaited<ReturnType<SteamApi['getInventory']>>;

    try {
      payload = await api.getInventory(steamId, target.appId, target.contextId);
    } catch (caught) {
      if (caught instanceof SteamPrivateError) {
        privateCount++;
        continue;
      }
      // One game's inventory failing must not lose the others.
      console.warn(`inventory ${target.appId} failed: ${String(caught)}`);
      continue;
    }

    const assets = payload.assets ?? [];
    const descriptions = payload.descriptions ?? [];
    if (assets.length === 0) continue;

    // The two arrays are joined on classid+instanceid — descriptions carry the
    // item metadata, assets carry the individual copies and their quantities.
    const describedBy = new Map(
      descriptions.map((entry) => [`${entry.classid}:${entry.instanceid}`, entry])
    );

    const items = assets
      .map((asset) => {
        const description = describedBy.get(`${asset.classid}:${asset.instanceid}`);
        if (!description) return null;

        const rarity = rarityOf(description);
        return {
          user_id: userId,
          provider: PROVIDER,
          app_id: String(target.appId),
          item_id: asset.assetid,
          name: description.market_name || description.name || 'Unknown item',
          type: description.type ?? null,
          icon_url: economyImageUrl(description.icon_url),
          rarity: rarity.label,
          rarity_color: description.name_color ?? null,
          amount: Math.max(1, Number(asset.amount) || 1),
          tradable: description.tradable === 1,
          marketable: description.marketable === 1,
          // The only hook a future pricing provider needs.
          market_hash_name: description.market_hash_name ?? null,
          feature_rank: rarityRank(rarity.internal),
          synced_at: syncedAt,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    // Keep the most interesting items when a Dota or TF2 backpack runs to
    // thousands of entries.
    items.sort((a, b) => (b.feature_rank ?? 0) - (a.feature_rank ?? 0));
    rows.push(...items.slice(0, INVENTORY_ITEM_CAP));
  }

  if (rows.length > 0) {
    await upsertChunked(
      admin,
      'gaming_inventory_items',
      rows,
      'user_id,provider,app_id,item_id'
    );
  }

  await admin
    .from('gaming_inventory_items')
    .delete()
    .eq('user_id', userId)
    .eq('provider', PROVIDER)
    .lt('synced_at', syncedAt);

  if (rows.length === 0 && privateCount === attempted) {
    return {
      status: 'private',
      written: 0,
      hasMore: false,
      message: 'Steam inventory is private.',
    };
  }

  return {
    status: privateCount > 0 ? 'partial' : 'ok',
    written: rows.length,
    hasMore: false,
    message: privateCount > 0 ? `${privateCount} inventories are private.` : null,
  };
}

// ---------------------------------------------------------------------------
// badges
// ---------------------------------------------------------------------------

async function syncBadges(
  admin: SupabaseClient,
  api: SteamApi,
  userId: string,
  steamId: string
): Promise<SyncResult> {
  const response = await api.getBadges(steamId);
  const badges = response.badges ?? [];

  if (badges.length === 0) {
    return {
      status: 'private',
      written: 0,
      hasMore: false,
      message: 'Steam did not share badge details.',
    };
  }

  const syncedAt = new Date().toISOString();

  /**
   * Badge 1 is Years of Service, where `level` is the number of years. Steam
   * gives no name or icon through the API for most badges, so game badges are
   * labelled from their appid and the UI leans on level and XP instead.
   */
  const rows = badges.map((badge) => {
    const isGameBadge = typeof badge.appid === 'number' && badge.appid > 0;
    return {
      user_id: userId,
      provider: PROVIDER,
      badge_key: isGameBadge ? `${badge.badgeid}:${badge.appid}` : String(badge.badgeid),
      name: isGameBadge ? null : badge.badgeid === 1 ? 'Years of Service' : `Badge ${badge.badgeid}`,
      icon_url: isGameBadge ? appCoverUrl(badge.appid as number) : null,
      level: badge.level ?? null,
      xp: badge.xp ?? null,
      earned_at: isoFromUnix(badge.completion_time),
      is_years_of_service: badge.badgeid === 1 && !isGameBadge,
      synced_at: syncedAt,
    };
  });

  await upsertChunked(admin, 'gaming_badges', rows, 'user_id,provider,badge_key');

  await admin
    .from('gaming_badges')
    .delete()
    .eq('user_id', userId)
    .eq('provider', PROVIDER)
    .lt('synced_at', syncedAt);

  // GetBadges is also the only source of XP, so keep the account row in step.
  await admin
    .from('gaming_accounts')
    .update({ xp: response.player_xp ?? null, level: response.player_level ?? null })
    .eq('user_id', userId)
    .eq('provider', PROVIDER);

  return { status: 'ok', written: rows.length, hasMore: false, message: null };
}

// ---------------------------------------------------------------------------
// friends
// ---------------------------------------------------------------------------

async function syncFriends(
  admin: SupabaseClient,
  api: SteamApi,
  userId: string,
  steamId: string
): Promise<SyncResult> {
  let friends: Awaited<ReturnType<SteamApi['getFriends']>>;
  try {
    friends = await api.getFriends(steamId);
  } catch (caught) {
    if (caught instanceof SteamPrivateError) {
      return {
        status: 'private',
        written: 0,
        hasMore: false,
        message: 'This Steam friend list is private.',
      };
    }
    throw caught;
  }

  if (friends.length === 0) {
    return { status: 'ok', written: 0, hasMore: false, message: null };
  }

  const ids = friends.map((friend) => friend.steamid);

  // The product requirement is "friends already using this app", so resolve
  // which of these Steam ids belong to GameLog profiles.
  const { data: matches } = await admin
    .from('gaming_accounts')
    .select('user_id, external_id')
    .eq('provider', PROVIDER)
    .in('external_id', ids);

  const matchByExternalId = new Map(
    (matches ?? []).map((row) => [row.external_id as string, row.user_id as string])
  );

  // Summaries are only worth fetching for friends we can actually show. A
  // 400-friend list would otherwise cost 4 requests for data nothing renders.
  const relevant = ids.filter((id) => matchByExternalId.has(id));
  const summaries = relevant.length > 0 ? await api.getPlayerSummaries(relevant) : [];
  const summaryById = new Map(summaries.map((entry) => [entry.steamid, entry]));

  const syncedAt = new Date().toISOString();

  const rows = friends.map((friend) => {
    const summary = summaryById.get(friend.steamid);
    return {
      user_id: userId,
      provider: PROVIDER,
      friend_external_id: friend.steamid,
      friend_handle: summary?.personaname ?? null,
      friend_avatar_url: summary?.avatarfull ?? summary?.avatarmedium ?? null,
      friends_since: isoFromUnix(friend.friend_since),
      matched_user_id: matchByExternalId.get(friend.steamid) ?? null,
      synced_at: syncedAt,
    };
  });

  await upsertChunked(
    admin,
    'gaming_provider_friends',
    rows,
    'user_id,provider,friend_external_id'
  );

  await admin
    .from('gaming_provider_friends')
    .delete()
    .eq('user_id', userId)
    .eq('provider', PROVIDER)
    .lt('synced_at', syncedAt);

  return { status: 'ok', written: rows.length, hasMore: false, message: null };
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

const RUNNERS: Record<
  Section,
  (admin: SupabaseClient, api: SteamApi, userId: string, steamId: string) => Promise<SyncResult>
> = {
  profile: syncProfile,
  library: syncLibrary,
  achievements: syncAchievements,
  inventory: syncInventory,
  badges: syncBadges,
  friends: syncFriends,
};

/** Exponential backoff after repeated failures, capped so it always recovers. */
function backoffSeconds(attempts: number): number {
  return Math.min(60 * 60, 30 * 2 ** Math.min(attempts, 7));
}

async function runSection(
  admin: SupabaseClient,
  api: SteamApi,
  userId: string,
  steamId: string,
  section: Section,
  force: boolean
): Promise<SyncResult & { section: Section; skipped: boolean }> {
  const { data: state } = await admin
    .from('gaming_sync_state')
    .select('status, next_run_after, attempts')
    .eq('user_id', userId)
    .eq('provider', PROVIDER)
    .eq('section', section)
    .maybeSingle();

  // Respect the rate-limit floor unless explicitly overridden by a manual
  // "Refresh Steam Data".
  if (!force && state?.next_run_after && new Date(state.next_run_after).getTime() > Date.now()) {
    return {
      section,
      skipped: true,
      status: (state.status as SyncResult['status']) ?? 'ok',
      written: 0,
      hasMore: false,
      message: null,
    };
  }

  const startedAt = new Date().toISOString();
  await admin.from('gaming_sync_state').upsert(
    {
      user_id: userId,
      provider: PROVIDER,
      section,
      status: 'syncing',
      last_run_at: startedAt,
    },
    { onConflict: 'user_id,provider,section' }
  );

  try {
    const result = await RUNNERS[section](admin, api, userId, steamId);

    // A section with more work queued should come back promptly, not after its
    // full TTL — otherwise a large achievement scan would take days.
    const nextRun = result.hasMore
      ? new Date(Date.now() + 5_000)
      : new Date(Date.now() + SECTION_TTL_SECONDS[section] * 1000);

    await admin.from('gaming_sync_state').upsert(
      {
        user_id: userId,
        provider: PROVIDER,
        section,
        status: result.status,
        last_run_at: startedAt,
        last_success_at: new Date().toISOString(),
        next_run_after: nextRun.toISOString(),
        attempts: 0,
        error: result.message,
      },
      { onConflict: 'user_id,provider,section' }
    );

    return { section, skipped: false, ...result };
  } catch (caught) {
    const attempts = (state?.attempts ?? 0) + 1;
    const message = caught instanceof Error ? caught.message : 'Unknown error';

    await admin.from('gaming_sync_state').upsert(
      {
        user_id: userId,
        provider: PROVIDER,
        section,
        status: 'error',
        last_run_at: startedAt,
        next_run_after: new Date(Date.now() + backoffSeconds(attempts) * 1000).toISOString(),
        attempts,
        error: message,
      },
      { onConflict: 'user_id,provider,section' }
    );

    return { section, skipped: false, status: 'error', written: 0, hasMore: false, message };
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return preflight();
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  const steamKey = Deno.env.get('STEAM_API_KEY');
  if (!steamKey) {
    return jsonResponse(
      { error: 'Steam is not configured. Run: supabase secrets set STEAM_API_KEY=...' },
      503
    );
  }

  const userId = await userFromRequest(request);
  if (!userId) return jsonResponse({ error: 'Not signed in.' }, 401);

  let payload: { sections?: string[]; section?: string; force?: boolean };
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const requested = payload.sections ?? (payload.section ? [payload.section] : SECTIONS);
  const sections = requested.filter((entry): entry is Section =>
    SECTIONS.includes(entry as Section)
  );

  if (sections.length === 0) {
    return jsonResponse({ error: 'No valid sections requested.' }, 400);
  }

  try {
    const admin = adminClient();

    const { data: account, error: accountError } = await admin
      .from('gaming_accounts')
      .select('external_id')
      .eq('user_id', userId)
      .eq('provider', PROVIDER)
      .maybeSingle();

    if (accountError) return jsonResponse({ error: accountError.message }, 500);
    if (!account) return jsonResponse({ error: 'No Steam account is linked.' }, 404);

    const api = new SteamApi(steamKey);
    const steamId = account.external_id as string;

    // Sequential on purpose: parallel sections would each open their own burst
    // against a shared per-key rate limit and trip Steam's throttling.
    const results = [];
    for (const section of sections) {
      results.push(
        await runSection(admin, api, userId, steamId, section, payload.force === true)
      );
    }

    return jsonResponse({ results });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
});
