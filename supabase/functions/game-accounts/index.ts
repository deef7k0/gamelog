/**
 * PlayStation, Xbox and GOG linked by username, as RAWG links them: the person
 * types the name they go by on the service, and this imports what the service
 * shows to anybody — their games, with trophies or achievements where the
 * service has them. Never a password, never a sign-in to the person's account.
 * See `_shared/game-accounts.ts` for what each service answers, and 0044.
 *
 * POST { action: 'link', provider, handle }   look the name up, import, link
 * POST { action: 'sync', provider }           import again for the linked name
 * POST { action: 'unlink', provider }         forget the account and its games
 *
 * Every answer is 200 with `{ status, message, games }` — RAWG's statuses — so
 * the app shows "your games are private" as a state, not an error.
 *
 * Secrets: `PSN_NPSSO` (the app's own PlayStation account's NPSSO cookie, from
 * https://ca.account.sony.com/api/v1/ssocookie while signed in) and
 * `OPENXBL_API_KEY` (xbl.io). GOG needs none. Without a service's secret its
 * imports answer `unconfigured`.
 */

import { jsonResponse, preflight } from '../_shared/http.ts';
import { adminClient, userFromRequest } from '../_shared/supabase-admin.ts';
import {
  IMPORT_PROVIDERS,
  PSN_NOT_PERMITTED,
  cleanHandle,
  gogRows,
  gogUserIdFromPage,
  psnErrorCode,
  psnRows,
  statusMessage,
  xboxPersonFor,
  xboxRows,
  type GogStatsPage,
  type ImportProvider,
  type ImportStatus,
  type ImportedAccount,
  type ImportedGame,
  type PsnTrophyTitle,
  type XboxPerson,
  type XboxTitle,
} from '../_shared/game-accounts.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

/** A browser's, because GOG's pages answer one; honest about who it is. */
const USER_AGENT = 'Mozilla/5.0 (compatible; GameLog/1.0; +https://gamelog.app)';

/** How soon the same account may be imported again. */
const RESYNC_SECONDS = 6 * 60 * 60;

const GOG_MAX_PAGES = 40;
const PSN_PAGE = 800;
const PSN_MAX_PAGES = 5;
const UPSERT_CHUNK = 500;

type Imported =
  | { status: 'ready'; account: ImportedAccount; games: ImportedGame[] }
  | { status: Exclude<ImportStatus, 'ready'> };

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return preflight();
  if (request.method !== 'POST') return jsonResponse({ error: 'POST only' }, 405);

  /* A signed-in person only: the anon key is a valid JWT and ships in the app. */
  const userId = await userFromRequest(request);
  if (!userId) return jsonResponse({ error: 'Sign in first.' }, 401);

  let body: { action?: string; provider?: string; handle?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Expected JSON.' }, 400);
  }

  const provider = body.provider as ImportProvider;
  if (!IMPORT_PROVIDERS.includes(provider)) {
    return jsonResponse({ error: 'Unknown provider.' }, 400);
  }

  const db = adminClient();

  if (body.action === 'unlink') {
    await unlink(db, userId, provider);
    return jsonResponse({ status: 'ready', message: null, games: 0 });
  }

  let handle: string | null;
  if (body.action === 'link') {
    handle = cleanHandle(provider, body.handle ?? '');
    if (!handle) return reply(provider, 'not-found');
  } else if (body.action === 'sync') {
    const { data } = await db
      .from('gaming_accounts')
      .select('handle')
      .eq('user_id', userId)
      .eq('provider', provider)
      .maybeSingle();
    handle = data?.handle ?? null;
    if (!handle) return jsonResponse({ error: 'Nothing linked.' }, 404);

    const { data: state } = await db
      .from('gaming_sync_state')
      .select('next_run_after, status')
      .eq('user_id', userId)
      .eq('provider', provider)
      .eq('section', 'library')
      .maybeSingle();
    if (
      state?.status === 'ok' &&
      state.next_run_after &&
      Date.parse(state.next_run_after) > Date.now()
    ) {
      return jsonResponse({ status: 'ready', message: null, games: null, skipped: true });
    }
  } else {
    return jsonResponse({ error: 'Unknown action.' }, 400);
  }

  let result: Imported;
  try {
    result = await importFrom(db, provider, handle);
  } catch (error) {
    console.error(`[game-accounts] ${provider} import failed:`, error);
    result = { status: 'unavailable' };
  }

  if (result.status !== 'ready') {
    if (body.action === 'sync') await markSection(db, userId, provider, result.status);
    return reply(provider, result.status);
  }

  /* One GameLog account per service account (0009's unique constraint). */
  const { data: owner } = await db
    .from('gaming_accounts')
    .select('user_id')
    .eq('provider', provider)
    .eq('external_id', result.account.externalId)
    .maybeSingle();
  if (owner && owner.user_id !== userId) return reply(provider, 'taken');

  await save(db, userId, provider, result.account, result.games);
  return jsonResponse({ status: 'ready', message: null, games: result.games.length });
});

function reply(provider: ImportProvider, status: ImportStatus): Response {
  return jsonResponse({ status, message: statusMessage(provider, status), games: null });
}

function importFrom(
  db: SupabaseClient,
  provider: ImportProvider,
  handle: string
): Promise<Imported> {
  switch (provider) {
    case 'gog':
      return importGog(handle);
    case 'playstation':
      return importPlayStation(db, handle);
    case 'xbox':
      return importXbox(handle);
  }
}

// ---------------------------------------------------------------------------
// GOG — public, no key
// ---------------------------------------------------------------------------

async function importGog(username: string): Promise<Imported> {
  const base = `https://www.gog.com/u/${encodeURIComponent(username)}`;
  const page = await fetch(base, { headers: { 'User-Agent': USER_AGENT } });
  if (page.status === 404) return { status: 'not-found' };
  if (!page.ok) return { status: 'unavailable' };
  const userId = gogUserIdFromPage(await page.text());

  const items: NonNullable<GogStatsPage['_embedded']>['items'] = [];
  let pages = 1;
  for (let n = 1; n <= Math.min(pages, GOG_MAX_PAGES); n += 1) {
    const response = await fetch(`${base}/games/stats?sort=recent_playtime&order=desc&page=${n}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    /* Observed live: 403 for a private profile, 404 for hidden games. */
    if (response.status === 403) return { status: 'private-user' };
    if (response.status === 404) return { status: 'private-games' };
    if (!response.ok) return { status: 'unavailable' };
    const body = (await response.json()) as GogStatsPage;
    items.push(...(body._embedded?.items ?? []));
    pages = body.pages ?? 1;
  }

  const games = gogRows(items ?? []);
  const fromStats = items?.flatMap((item) => Object.keys(item.stats ?? {}))[0];
  return {
    status: 'ready',
    account: {
      externalId: userId ?? fromStats ?? username.toLowerCase(),
      handle: username,
      displayName: username,
      avatarUrl: null,
      profileUrl: base,
    },
    games,
  };
}

// ---------------------------------------------------------------------------
// PlayStation — the trophy API, through the app's own PSN sign-in
// ---------------------------------------------------------------------------

const PSN_AUTH = 'https://ca.account.sony.com/api/authz/v3/oauth';
/** The PlayStation app's own client (psn-api's constants). */
const PSN_CLIENT_ID = '09515159-7237-4370-9b40-3806e67c0891';
const PSN_BASIC = 'Basic MDk1MTUxNTktNzIzNy00MzcwLTliNDAtMzgwNmU2N2MwODkxOnVjUGprYTV0bnRCMktxc1A=';
const PSN_REDIRECT = 'com.scee.psxandroid.scecompcall://redirect';
const PSN_SCOPE = 'psn:mobile.v2.core psn:clientapp';

async function importPlayStation(db: SupabaseClient, onlineId: string): Promise<Imported> {
  const npsso = Deno.env.get('PSN_NPSSO');
  if (!npsso) return { status: 'unconfigured' };
  const token = await psnToken(db, npsso);
  const auth = { Authorization: `Bearer ${token}` };

  const profileResponse = await fetch(
    `https://us-prof.np.community.playstation.net/userProfile/v1/users/${encodeURIComponent(onlineId)}/profile2?fields=onlineId,accountId,avatarUrls`,
    { headers: auth }
  );
  if (profileResponse.status === 404) return { status: 'not-found' };
  const profileBody = (await profileResponse.json()) as {
    profile?: { onlineId?: string; accountId?: string; avatarUrls?: { avatarUrl?: string }[] };
  };
  const profile = profileBody.profile;
  if (!profile?.accountId)
    return psnErrorCode(profileBody) ? { status: 'not-found' } : { status: 'unavailable' };

  const titles: PsnTrophyTitle[] = [];
  for (let page = 0; page < PSN_MAX_PAGES; page += 1) {
    const response = await fetch(
      `https://m.np.playstation.com/api/trophy/v1/users/${profile.accountId}/trophyTitles?limit=${PSN_PAGE}&offset=${page * PSN_PAGE}`,
      { headers: auth }
    );
    const body = (await response.json()) as {
      trophyTitles?: PsnTrophyTitle[];
      totalItemCount?: number;
      nextOffset?: number;
    };
    if (psnErrorCode(body) === PSN_NOT_PERMITTED) return { status: 'private-games' };
    if (!response.ok) return { status: 'unavailable' };
    titles.push(...(body.trophyTitles ?? []));
    if (body.nextOffset === undefined || titles.length >= (body.totalItemCount ?? 0)) break;
  }

  return {
    status: 'ready',
    account: {
      externalId: profile.accountId,
      handle: profile.onlineId ?? onlineId,
      displayName: profile.onlineId ?? onlineId,
      avatarUrl: profile.avatarUrls?.at(-1)?.avatarUrl ?? null,
      profileUrl: null,
    },
    games: psnRows(titles),
  };
}

/** A usable access token: the kept one, renewed by refresh, or a new sign-in. */
async function psnToken(db: SupabaseClient, npsso: string): Promise<string> {
  const { data: kept } = await db
    .from('gaming_service_tokens')
    .select('access_token, refresh_token, expires_at, refresh_expires_at')
    .eq('service', 'playstation')
    .maybeSingle();

  const now = Date.now();
  if (kept && Date.parse(kept.expires_at) > now + 60_000) return kept.access_token;

  let tokens: PsnTokens | null = null;
  if (kept?.refresh_token && kept.refresh_expires_at && Date.parse(kept.refresh_expires_at) > now) {
    tokens = await psnTokenRequest({
      refresh_token: kept.refresh_token,
      grant_type: 'refresh_token',
      token_format: 'jwt',
      scope: PSN_SCOPE,
    }).catch(() => null);
  }
  if (!tokens) {
    const code = await psnAccessCode(npsso);
    tokens = await psnTokenRequest({
      code,
      redirect_uri: PSN_REDIRECT,
      grant_type: 'authorization_code',
      token_format: 'jwt',
    });
  }

  await db.from('gaming_service_tokens').upsert({
    service: 'playstation',
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    expires_at: new Date(now + tokens.expires_in * 1000).toISOString(),
    refresh_expires_at: tokens.refresh_token_expires_in
      ? new Date(now + tokens.refresh_token_expires_in * 1000).toISOString()
      : null,
    updated_at: new Date(now).toISOString(),
  });
  return tokens.access_token;
}

type PsnTokens = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
};

async function psnAccessCode(npsso: string): Promise<string> {
  const query = new URLSearchParams({
    access_type: 'offline',
    client_id: PSN_CLIENT_ID,
    redirect_uri: PSN_REDIRECT,
    response_type: 'code',
    scope: PSN_SCOPE,
  });
  const response = await fetch(`${PSN_AUTH}/authorize?${query}`, {
    headers: { Cookie: `npsso=${npsso}` },
    redirect: 'manual',
  });
  const location = response.headers.get('location') ?? '';
  const code = new URLSearchParams(location.split('?')[1] ?? '').get('code');
  if (!code) throw new Error('PSN sign-in failed: is PSN_NPSSO still valid?');
  return code;
}

async function psnTokenRequest(form: Record<string, string>): Promise<PsnTokens> {
  const response = await fetch(`${PSN_AUTH}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: PSN_BASIC },
    body: new URLSearchParams(form).toString(),
  });
  const body = (await response.json()) as Partial<PsnTokens>;
  if (!response.ok || !body.access_token || !body.expires_in) {
    throw new Error(`PSN token request failed (${response.status})`);
  }
  return body as PsnTokens;
}

// ---------------------------------------------------------------------------
// Xbox — title history, through OpenXBL
// ---------------------------------------------------------------------------

async function importXbox(gamertag: string): Promise<Imported> {
  const key = Deno.env.get('OPENXBL_API_KEY');
  if (!key) return { status: 'unconfigured' };
  const headers = { 'X-Authorization': key, Accept: 'application/json' };

  const search = await fetch(`https://xbl.io/api/v2/search/${encodeURIComponent(gamertag)}`, {
    headers,
  });
  if (search.status === 429 || !search.ok) return { status: 'unavailable' };
  const people = ((await search.json()) as { people?: XboxPerson[] }).people ?? [];
  const person = xboxPersonFor(people, gamertag);
  if (!person?.xuid) return { status: 'not-found' };

  const history = await fetch(`https://xbl.io/api/v2/player/titleHistory/${person.xuid}`, {
    headers,
  });
  if (history.status === 403) return { status: 'private-games' };
  if (!history.ok) return { status: 'unavailable' };
  const titles = ((await history.json()) as { titles?: XboxTitle[] }).titles ?? [];
  /* An empty history for a real gamertag is a hidden one: RAWG's help asks
     for "game and app history" to be shared with everybody. */
  if (titles.length === 0) return { status: 'private-games' };

  const tag = person.gamertag ?? person.modernGamertag ?? gamertag;
  return {
    status: 'ready',
    account: {
      externalId: person.xuid,
      handle: tag,
      displayName: tag,
      avatarUrl: person.displayPicRaw ?? null,
      /* No profile address has been checked to exist for a gamertag. */
      profileUrl: null,
    },
    games: xboxRows(titles),
  };
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

async function save(
  db: SupabaseClient,
  userId: string,
  provider: ImportProvider,
  account: ImportedAccount,
  games: ImportedGame[]
): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await db.from('gaming_accounts').upsert({
    user_id: userId,
    provider,
    external_id: account.externalId,
    handle: account.handle,
    display_name: account.displayName,
    avatar_url: account.avatarUrl,
    profile_url: account.profileUrl,
    visibility: 'public',
    linked_by: 'username',
    last_synced_at: now,
  });
  if (error) throw new Error(error.message);

  /* The library is replaced: a game gone from the public list is gone here. */
  await db.from('gaming_owned_games').delete().eq('user_id', userId).eq('provider', provider);
  for (let i = 0; i < games.length; i += UPSERT_CHUNK) {
    const { error: rows } = await db.from('gaming_owned_games').upsert(
      games.slice(i, i + UPSERT_CHUNK).map((game) => ({
        ...game,
        user_id: userId,
        provider,
        playtime_recent_minutes: 0,
        synced_at: now,
      }))
    );
    if (rows) throw new Error(rows.message);
  }

  await markSection(db, userId, provider, 'ready');
}

/** The library section's state, which the app reads as the account's status. */
async function markSection(
  db: SupabaseClient,
  userId: string,
  provider: ImportProvider,
  status: ImportStatus
): Promise<void> {
  const now = new Date();
  const ok = status === 'ready';
  const privateNow = status === 'private-user' || status === 'private-games';
  await db.from('gaming_sync_state').upsert({
    user_id: userId,
    provider,
    section: 'library',
    status: ok ? 'ok' : privateNow ? 'private' : 'error',
    last_run_at: now.toISOString(),
    ...(ok ? { last_success_at: now.toISOString(), attempts: 0 } : {}),
    next_run_after: new Date(now.getTime() + RESYNC_SECONDS * 1000).toISOString(),
    error: ok ? null : status,
  });
}

async function unlink(db: SupabaseClient, userId: string, provider: ImportProvider): Promise<void> {
  await db.from('gaming_owned_games').delete().eq('user_id', userId).eq('provider', provider);
  await db.from('gaming_sync_state').delete().eq('user_id', userId).eq('provider', provider);
  await db.from('gaming_accounts').delete().eq('user_id', userId).eq('provider', provider);
}
