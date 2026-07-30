import { completionPercent } from '../gaming/format';
import type {
  GameAchievementProgress,
  GamingStats,
  InventoryItem,
  LibrarySort,
  LinkedAccount,
  OwnedGame,
  ProviderAchievement,
  ProviderBadge,
  ProviderFriend,
  SectionSyncState,
} from '../gaming/types';
import type {
  GamingAchievementRow,
  GamingInventoryItemRow,
  GamingOwnedGameRow,
  GamingProvider,
  Profile,
} from '../database.types';
import { supabase } from '../supabase';

/**
 * Reads for linked gaming accounts.
 *
 * Everything here is a plain Supabase read against tables the sync service has
 * already populated — no provider API is ever called from the app. That is what
 * makes the profile render instantly on a cold open and work offline against the
 * last sync.
 *
 * Rows come back in database shape (`playtime_minutes`, `app_id`) and leave in
 * domain shape (`playtimeMinutes`, `appId`), so no screen ever sees a column
 * name.
 */

const DEFAULT_PROVIDER: GamingProvider = 'steam';

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

export async function getLinkedAccount(
  userId: string,
  provider: GamingProvider = DEFAULT_PROVIDER
): Promise<LinkedAccount | null> {
  const { data, error } = await supabase
    .from('gaming_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    provider: data.provider,
    externalId: data.external_id,
    handle: data.handle,
    displayName: data.display_name,
    avatarUrl: data.avatar_url,
    profileUrl: data.profile_url,
    country: data.country,
    level: data.level,
    xp: data.xp,
    visibility: data.visibility,
    status: (data.status as LinkedAccount['status']) ?? 'unknown',
    currentGame:
      data.current_game_name && data.current_game_app_id
        ? { appId: data.current_game_app_id, name: data.current_game_name }
        : null,
    linkedAt: data.linked_at,
    lastSyncedAt: data.last_synced_at,
  };
}

export async function getSyncState(
  userId: string,
  provider: GamingProvider = DEFAULT_PROVIDER
): Promise<SectionSyncState[]> {
  const { data, error } = await supabase
    .from('gaming_sync_state')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    section: row.section,
    status: row.status,
    lastRunAt: row.last_run_at,
    lastSuccessAt: row.last_success_at,
    nextRunAfter: row.next_run_after,
    attempts: row.attempts,
    error: row.error,
  }));
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

/**
 * Profile rollup.
 *
 * Postgres returns `sum()` and the average as numeric, which PostgREST serialises
 * as strings — hence the explicit `Number()` rather than trusting the shape.
 */
export async function getGamingStats(
  userId: string,
  provider: GamingProvider = DEFAULT_PROVIDER
): Promise<GamingStats | null> {
  const { data, error } = await supabase
    .from('gaming_profile_stats')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    gamesOwned: Number(data.games_owned) || 0,
    totalPlaytimeMinutes: Number(data.total_playtime_minutes) || 0,
    achievementsUnlocked: Number(data.achievements_unlocked) || 0,
    achievementsTotal: Number(data.achievements_total) || 0,
    perfectGames: Number(data.perfect_games) || 0,
    avgPlaytimeMinutes: Number(data.avg_playtime_minutes) || 0,
  };
}

// ---------------------------------------------------------------------------
// Library
// ---------------------------------------------------------------------------

function toOwnedGame(row: GamingOwnedGameRow): OwnedGame {
  return {
    provider: row.provider,
    appId: row.app_id,
    name: row.name,
    iconUrl: row.icon_url,
    playtimeMinutes: row.playtime_minutes,
    playtimeRecentMinutes: row.playtime_recent_minutes,
    lastPlayedAt: row.last_played_at,
    achievementsTotal: row.achievements_total,
    achievementsUnlocked: row.achievements_unlocked,
    acquiredAt: row.acquired_at,
    gameId: row.game_id,
  };
}

/** Column and direction for each sort, so the ordering lives in one place. */
const SORT_COLUMNS: Record<LibrarySort, { column: keyof GamingOwnedGameRow; ascending: boolean }> =
  {
    'most-played': { column: 'playtime_minutes', ascending: false },
    'recently-played': { column: 'last_played_at', ascending: false },
    alphabetical: { column: 'name', ascending: true },
    'recently-purchased': { column: 'acquired_at', ascending: false },
  };

export async function getOwnedGames(
  userId: string,
  options: {
    provider?: GamingProvider;
    sort?: LibrarySort;
    limit?: number;
    /** Substring match on the title. */
    search?: string;
  } = {}
): Promise<OwnedGame[]> {
  const { provider = DEFAULT_PROVIDER, sort = 'most-played', limit, search } = options;
  const ordering = SORT_COLUMNS[sort];

  let query = supabase
    .from('gaming_owned_games')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    // nullsFirst false keeps never-played and never-dated games at the bottom
    // rather than leading the list with blanks.
    .order(ordering.column, { ascending: ordering.ascending, nullsFirst: false });

  if (search?.trim()) {
    query = query.ilike('name', `%${search.trim()}%`);
  }
  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(toOwnedGame);
}

export type LibraryStatistics = {
  totalGames: number;
  totalPlaytimeMinutes: number;
  avgPlaytimeMinutes: number;
  /** Games with any recorded playtime — the denominator for the average. */
  playedGames: number;
  neverPlayed: number;
  mostPlayed: OwnedGame[];
  recentlyPlayed: OwnedGame[];
};

/**
 * Everything the library's Statistics tab shows, in two queries.
 *
 * The rollup comes from the view rather than being recomputed here so the
 * numbers cannot disagree with the ones in the profile header.
 */
export async function getLibraryStatistics(
  userId: string,
  provider: GamingProvider = DEFAULT_PROVIDER
): Promise<LibraryStatistics> {
  const [stats, games] = await Promise.all([
    getGamingStats(userId, provider),
    getOwnedGames(userId, { provider, sort: 'most-played' }),
  ]);

  const played = games.filter((game) => game.playtimeMinutes > 0);

  const recentlyPlayed = games
    .filter((game) => game.lastPlayedAt !== null)
    .sort((a, b) => (b.lastPlayedAt ?? '').localeCompare(a.lastPlayedAt ?? ''))
    .slice(0, 8);

  return {
    totalGames: stats?.gamesOwned ?? games.length,
    totalPlaytimeMinutes:
      stats?.totalPlaytimeMinutes ?? games.reduce((total, game) => total + game.playtimeMinutes, 0),
    avgPlaytimeMinutes: stats?.avgPlaytimeMinutes ?? 0,
    playedGames: played.length,
    neverPlayed: games.length - played.length,
    mostPlayed: played.slice(0, 8),
    recentlyPlayed,
  };
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

/**
 * Per-game achievement progress for every game with at least one unlock.
 *
 * The filter is the product requirement — "show each game the user has at least
 * 1 achievement" — and it is also what keeps the list short: a 900-game library
 * typically has achievements in a few dozen.
 */
export async function getGameAchievementProgress(
  userId: string,
  provider: GamingProvider = DEFAULT_PROVIDER
): Promise<GameAchievementProgress[]> {
  const { data, error } = await supabase
    .from('gaming_owned_games')
    .select('app_id, name, icon_url, achievements_total, achievements_unlocked')
    .eq('user_id', userId)
    .eq('provider', provider)
    .gt('achievements_unlocked', 0)
    .order('achievements_unlocked', { ascending: false });

  if (error) throw new Error(error.message);

  const games = data ?? [];
  if (games.length === 0) return [];

  // One extra query gets the newest unlock per game, which is what the row
  // subtitle shows. Ordered newest-first so the first hit per app wins.
  const { data: unlocks } = await supabase
    .from('gaming_achievements')
    .select('app_id, name, unlocked_at')
    .eq('user_id', userId)
    .eq('provider', provider)
    .eq('unlocked', true)
    .in(
      'app_id',
      games.map((game) => game.app_id)
    )
    .order('unlocked_at', { ascending: false, nullsFirst: false });

  const latestByApp = new Map<string, { name: string; unlocked_at: string | null }>();
  for (const unlock of unlocks ?? []) {
    if (!latestByApp.has(unlock.app_id)) {
      latestByApp.set(unlock.app_id, { name: unlock.name, unlocked_at: unlock.unlocked_at });
    }
  }

  return games.map((game) => {
    const total = game.achievements_total ?? 0;
    const unlocked = game.achievements_unlocked ?? 0;
    const latest = latestByApp.get(game.app_id);

    return {
      appId: game.app_id,
      name: game.name,
      iconUrl: game.icon_url,
      total,
      unlocked,
      percent: completionPercent(unlocked, total),
      lastUnlockedAt: latest?.unlocked_at ?? null,
      lastUnlockedName: latest?.name ?? null,
      isPerfect: total > 0 && unlocked >= total,
    };
  });
}

function toAchievement(row: GamingAchievementRow): ProviderAchievement {
  return {
    provider: row.provider,
    appId: row.app_id,
    key: row.achievement_key,
    name: row.name,
    description: row.description,
    iconUrl: row.icon_url,
    iconGrayUrl: row.icon_gray_url,
    unlocked: row.unlocked,
    unlockedAt: row.unlocked_at,
    globalPercent: row.global_percent === null ? null : Number(row.global_percent),
  };
}

/** Every achievement in one game, unlocked first then by rarity. */
export async function getAchievementsForApp(
  userId: string,
  appId: string,
  provider: GamingProvider = DEFAULT_PROVIDER
): Promise<ProviderAchievement[]> {
  const { data, error } = await supabase
    .from('gaming_achievements')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    .eq('app_id', appId)
    .order('unlocked', { ascending: false })
    .order('unlocked_at', { ascending: false, nullsFirst: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(toAchievement);
}

export async function getRecentUnlocks(
  userId: string,
  options: { provider?: GamingProvider; limit?: number } = {}
): Promise<ProviderAchievement[]> {
  const { provider = DEFAULT_PROVIDER, limit = 12 } = options;

  const { data, error } = await supabase
    .from('gaming_achievements')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    .eq('unlocked', true)
    .not('unlocked_at', 'is', null)
    .order('unlocked_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map(toAchievement);
}

/**
 * The achievement showcase: rarest unlocks first.
 *
 * Rarity is far more interesting than recency for a showcase — a 0.4% unlock is
 * a genuine flex, whereas the most recent unlock is often a tutorial step.
 */
export async function getRarestUnlocks(
  userId: string,
  options: { provider?: GamingProvider; limit?: number } = {}
): Promise<ProviderAchievement[]> {
  const { provider = DEFAULT_PROVIDER, limit = 8 } = options;

  const { data, error } = await supabase
    .from('gaming_achievements')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    .eq('unlocked', true)
    .not('global_percent', 'is', null)
    .order('global_percent', { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map(toAchievement);
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

function toInventoryItem(row: GamingInventoryItemRow): InventoryItem {
  return {
    provider: row.provider,
    appId: row.app_id,
    itemId: row.item_id,
    name: row.name,
    type: row.type,
    iconUrl: row.icon_url,
    rarity: row.rarity,
    rarityColor: row.rarity_color,
    amount: row.amount,
    tradable: row.tradable,
    marketable: row.marketable,
    marketHashName: row.market_hash_name,
  };
}

export async function getInventory(
  userId: string,
  options: { provider?: GamingProvider; appId?: string; limit?: number } = {}
): Promise<InventoryItem[]> {
  const { provider = DEFAULT_PROVIDER, appId, limit } = options;

  let query = supabase
    .from('gaming_inventory_items')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    .order('feature_rank', { ascending: false, nullsFirst: false })
    .order('name', { ascending: true });

  if (appId) query = query.eq('app_id', appId);
  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(toInventoryItem);
}

export async function getInventorySize(
  userId: string,
  provider: GamingProvider = DEFAULT_PROVIDER
): Promise<number> {
  const { count, error } = await supabase
    .from('gaming_inventory_items')
    .select('item_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('provider', provider);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

export async function getBadges(
  userId: string,
  provider: GamingProvider = DEFAULT_PROVIDER
): Promise<ProviderBadge[]> {
  const { data, error } = await supabase
    .from('gaming_badges')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    // Years of Service first — it is the one badge with real status attached.
    .order('is_years_of_service', { ascending: false })
    .order('xp', { ascending: false, nullsFirst: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    provider: row.provider,
    key: row.badge_key,
    name: row.name,
    iconUrl: row.icon_url,
    level: row.level,
    xp: row.xp,
    earnedAt: row.earned_at,
    isYearsOfService: row.is_years_of_service,
  }));
}

// ---------------------------------------------------------------------------
// Friends
// ---------------------------------------------------------------------------

export type MatchedFriend = ProviderFriend & { profile: Profile | null };

/**
 * Provider friends who also use GameLog.
 *
 * The requirement is specifically "friends already using this app", so this
 * filters to matched rows and embeds the GameLog profile — showing 300 Steam
 * friends who have never heard of GameLog would be noise, and would leak a
 * friend list into a product that has its own.
 */
export async function getMatchedFriends(
  userId: string,
  provider: GamingProvider = DEFAULT_PROVIDER
): Promise<MatchedFriend[]> {
  const { data, error } = await supabase
    .from('gaming_provider_friends')
    .select('*, profile:profiles!gaming_provider_friends_matched_user_id_fkey(*)')
    .eq('user_id', userId)
    .eq('provider', provider)
    .not('matched_user_id', 'is', null);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    provider: row.provider,
    externalId: row.friend_external_id,
    handle: row.friend_handle,
    avatarUrl: row.friend_avatar_url,
    friendsSince: row.friends_since,
    matchedUserId: row.matched_user_id,
    profile: (row.profile as Profile | null) ?? null,
  }));
}

/** Total provider friends, matched or not — for "12 of 240 friends here". */
export async function getProviderFriendCount(
  userId: string,
  provider: GamingProvider = DEFAULT_PROVIDER
): Promise<number> {
  const { count, error } = await supabase
    .from('gaming_provider_friends')
    .select('friend_external_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('provider', provider);

  if (error) throw new Error(error.message);
  return count ?? 0;
}
