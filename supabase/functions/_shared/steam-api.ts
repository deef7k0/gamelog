/**
 * Steam Web API client (Deno / Edge Function side).
 *
 * This lives server-side for one non-negotiable reason: every useful endpoint
 * needs `key=<Steam Web API key>`, that key is tied to the developer's Steam
 * account, and anything in an Expo bundle can be extracted from the APK. The
 * app never sees the key and never calls Steam directly.
 *
 * Verified against the live API before writing:
 *   - GetOwnedGames without a key -> 401, GetPlayerSummaries without one -> 400,
 *     so there is no keyless fallback to be clever about.
 *   - GetGlobalAchievementPercentagesForApp *is* keyless.
 *   - The community inventory endpoint is keyless, returns `assets` and
 *     `descriptions` as SEPARATE arrays joined on classid+instanceid, and puts
 *     rarity in `tags[category="Rarity"]` plus a `name_color` hex.
 *
 * Deploy:
 *   supabase secrets set STEAM_API_KEY=xxxxxxxx
 */

const WEB_API = 'https://api.steampowered.com';
const COMMUNITY = 'https://steamcommunity.com';
const ECONOMY_IMAGE = 'https://community.cloudflare.steamstatic.com/economy/image';
const STEAM_CDN = 'https://cdn.cloudflare.steamstatic.com/steam/apps';

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

/**
 * Steam allows roughly 100,000 Web API calls per day per key, but the practical
 * limit is burst tolerance — hammer it and you get 429s and then temporary
 * blocks. The achievement scan is the dangerous one: two calls per owned game
 * means a 500-game library is 1,000 calls, so it is deliberately spread out and
 * budgeted per run rather than fired off in parallel.
 *
 * The community inventory endpoint is far stricter than the Web API (single
 * digits per minute before it starts refusing), hence its own slower limiter.
 */
class RateLimiter {
  #queue: Promise<void> = Promise.resolve();
  #lastStart = 0;

  constructor(
    private readonly minIntervalMs: number,
    readonly label: string
  ) {}

  /** Serialise callers and keep at least `minIntervalMs` between starts. */
  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.#queue.then(async () => {
      const wait = this.minIntervalMs - (Date.now() - this.#lastStart);
      if (wait > 0) await sleep(wait);
      this.#lastStart = Date.now();
      return task();
    });

    // Keep the chain alive even when a task rejects, or one failure would wedge
    // the limiter permanently.
    this.#queue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }
}

const webApiLimiter = new RateLimiter(120, 'steam-web-api');
const communityLimiter = new RateLimiter(1_500, 'steam-community');

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class SteamApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** True when retrying later could plausibly succeed. */
    readonly transient: boolean
  ) {
    super(message);
    this.name = 'SteamApiError';
  }
}

/** Thrown when Steam is reachable but the profile will not tell us anything. */
export class SteamPrivateError extends Error {
  constructor(message = 'This Steam profile is private.') {
    super(message);
    this.name = 'SteamPrivateError';
  }
}

const MAX_ATTEMPTS = 3;

/**
 * One HTTP call with retry on transient failure.
 *
 * 429 and 5xx are retried with exponential backoff; 401/403 are not, because a
 * bad key or a private profile will fail identically forever and retrying just
 * burns the rate budget.
 */
async function request(
  url: string,
  limiter: RateLimiter,
  init?: RequestInit
): Promise<Response> {
  let lastError: SteamApiError | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await limiter.run(() =>
      fetch(url, {
        ...init,
        headers: {
          Accept: 'application/json',
          // Some Steam community endpoints 403 a request with no User-Agent.
          'User-Agent': 'GameLog/1.0 (+https://github.com/gamelog)',
          ...init?.headers,
        },
      })
    );

    if (response.ok) return response;

    const transient = response.status === 429 || response.status >= 500;
    lastError = new SteamApiError(
      `Steam request failed (${response.status}) for ${redact(url)}`,
      response.status,
      transient
    );

    if (!transient || attempt === MAX_ATTEMPTS) break;

    // Honour Retry-After when Steam sends it; otherwise back off exponentially.
    const retryAfter = Number(response.headers.get('Retry-After'));
    const backoff = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : 500 * 2 ** (attempt - 1);
    await sleep(backoff);
  }

  throw lastError ?? new SteamApiError('Steam request failed', 500, true);
}

/** Never let the API key reach a log line or an error surfaced to the client. */
function redact(url: string): string {
  return url.replace(/key=[^&]+/, 'key=REDACTED');
}

async function getJson<T>(url: string, limiter: RateLimiter): Promise<T> {
  const response = await request(url, limiter);
  return (await response.json()) as T;
}

// ---------------------------------------------------------------------------
// Raw response shapes
// ---------------------------------------------------------------------------

export type RawPlayerSummary = {
  steamid: string;
  personaname?: string;
  realname?: string;
  profileurl?: string;
  avatar?: string;
  avatarmedium?: string;
  avatarfull?: string;
  /** 1 = private, 2 = friends only, 3 = public. */
  communityvisibilitystate?: number;
  /** 0 offline, 1 online, 2 busy, 3 away, 4 snooze, 5 trade, 6 play. */
  personastate?: number;
  loccountrycode?: string;
  gameid?: string;
  gameextrainfo?: string;
  timecreated?: number;
};

export type RawOwnedGame = {
  appid: number;
  name?: string;
  img_icon_url?: string;
  playtime_forever?: number;
  playtime_2weeks?: number;
  rtime_last_played?: number;
  has_community_visible_stats?: boolean;
};

export type RawBadge = {
  badgeid: number;
  appid?: number;
  level?: number;
  completion_time?: number;
  xp?: number;
  scarcity?: number;
  border_color?: number;
};

export type RawBadgesResponse = {
  badges?: RawBadge[];
  player_xp?: number;
  player_level?: number;
  player_xp_needed_to_level_up?: number;
  player_xp_needed_current_level?: number;
};

export type RawPlayerAchievement = {
  apiname: string;
  achieved: number;
  unlocktime?: number;
  name?: string;
  description?: string;
};

export type RawSchemaAchievement = {
  name: string;
  displayName?: string;
  description?: string;
  icon?: string;
  icongray?: string;
  hidden?: number;
};

export type RawFriend = {
  steamid: string;
  relationship?: string;
  friend_since?: number;
};

/** One entry of the community inventory `descriptions` array. */
export type RawInventoryDescription = {
  appid: number;
  classid: string;
  instanceid: string;
  icon_url?: string;
  name?: string;
  market_name?: string;
  market_hash_name?: string;
  name_color?: string;
  type?: string;
  tradable?: number;
  marketable?: number;
  tags?: {
    category?: string;
    internal_name?: string;
    localized_category_name?: string;
    localized_tag_name?: string;
  }[];
};

export type RawInventoryAsset = {
  appid: number;
  contextid: string;
  assetid: string;
  classid: string;
  instanceid: string;
  amount: string;
};

export type RawInventoryResponse = {
  assets?: RawInventoryAsset[];
  descriptions?: RawInventoryDescription[];
  total_inventory_count?: number;
  more_items?: number;
  last_assetid?: string;
  success?: number;
  error?: string;
};

// ---------------------------------------------------------------------------
// Image helpers
// ---------------------------------------------------------------------------

/** Portrait library capsule, matching what `lib/games/steam.ts` already uses. */
export function appCoverUrl(appId: number | string): string {
  return `${STEAM_CDN}/${appId}/library_600x900.jpg`;
}

export function appHeaderUrl(appId: number | string): string {
  return `${STEAM_CDN}/${appId}/header.jpg`;
}

/** `img_icon_url` is a bare hash; only useful once expanded. */
export function appIconUrl(appId: number, hash: string | undefined): string | null {
  if (!hash) return null;
  return `https://media.steampowered.com/steamcommunity/public/images/apps/${appId}/${hash}.jpg`;
}

/** Inventory `icon_url` is a CDN path fragment, not a URL. */
export function economyImageUrl(fragment: string | undefined): string | null {
  if (!fragment) return null;
  return `${ECONOMY_IMAGE}/${fragment}/256fx256f`;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class SteamApi {
  constructor(private readonly key: string) {
    if (!key) throw new Error('STEAM_API_KEY is not set.');
  }

  #url(path: string, params: Record<string, string | number | undefined>): string {
    const search = new URLSearchParams({ key: this.key });
    for (const [name, value] of Object.entries(params)) {
      if (value !== undefined) search.set(name, String(value));
    }
    return `${WEB_API}/${path}?${search}`;
  }

  async getPlayerSummary(steamId: string): Promise<RawPlayerSummary | null> {
    const json = await getJson<{ response?: { players?: RawPlayerSummary[] } }>(
      this.#url('ISteamUser/GetPlayerSummaries/v2/', { steamids: steamId }),
      webApiLimiter
    );
    return json.response?.players?.[0] ?? null;
  }

  async getSteamLevel(steamId: string): Promise<number | null> {
    const json = await getJson<{ response?: { player_level?: number } }>(
      this.#url('IPlayerService/GetSteamLevel/v1/', { steamid: steamId }),
      webApiLimiter
    );
    return json.response?.player_level ?? null;
  }

  /**
   * Owned games.
   *
   * `include_played_free_games` matters: without it, TF2/Dota/Warframe simply do
   * not appear, and a library that silently omits someone's most-played game
   * looks broken. A private "game details" setting yields an empty `games` array
   * rather than an error, which is why the caller treats empty-with-public-profile
   * as private rather than as a real zero.
   */
  async getOwnedGames(steamId: string): Promise<RawOwnedGame[] | null> {
    const json = await getJson<{ response?: { game_count?: number; games?: RawOwnedGame[] } }>(
      this.#url('IPlayerService/GetOwnedGames/v1/', {
        steamid: steamId,
        include_appinfo: 1,
        include_played_free_games: 1,
      }),
      webApiLimiter
    );
    return json.response?.games ?? null;
  }

  async getRecentlyPlayed(steamId: string): Promise<RawOwnedGame[]> {
    const json = await getJson<{ response?: { games?: RawOwnedGame[] } }>(
      this.#url('IPlayerService/GetRecentlyPlayedGames/v1/', { steamid: steamId }),
      webApiLimiter
    );
    return json.response?.games ?? [];
  }

  async getBadges(steamId: string): Promise<RawBadgesResponse> {
    const json = await getJson<{ response?: RawBadgesResponse }>(
      this.#url('IPlayerService/GetBadges/v1/', { steamid: steamId }),
      webApiLimiter
    );
    return json.response ?? {};
  }

  /**
   * A player's achievements in one game.
   *
   * Steam returns `success: false` with an error string for private profiles and
   * for games with no achievement support, so the two are separated here: the
   * former is a real signal for the UI, the latter is routine and yields null.
   */
  async getPlayerAchievements(
    steamId: string,
    appId: number | string
  ): Promise<RawPlayerAchievement[] | null> {
    let json: {
      playerstats?: { success?: boolean; error?: string; achievements?: RawPlayerAchievement[] };
    };

    try {
      json = await getJson(
        this.#url('ISteamUserStats/GetPlayerAchievements/v1/', {
          steamid: steamId,
          appid: appId,
          l: 'english',
        }),
        webApiLimiter
      );
    } catch (caught) {
      // 400 here means "this app has no achievements", which is not an error.
      if (caught instanceof SteamApiError && caught.status === 400) return null;
      throw caught;
    }

    const stats = json.playerstats;
    if (stats?.success === false) {
      const error = stats.error ?? '';
      if (/profile is not public|private/i.test(error)) throw new SteamPrivateError(error);
      return null;
    }
    return stats?.achievements ?? null;
  }

  async getSchemaAchievements(appId: number | string): Promise<RawSchemaAchievement[]> {
    try {
      const json = await getJson<{
        game?: { availableGameStats?: { achievements?: RawSchemaAchievement[] } };
      }>(
        this.#url('ISteamUserStats/GetSchemaForGame/v2/', { appid: appId, l: 'english' }),
        webApiLimiter
      );
      return json.game?.availableGameStats?.achievements ?? [];
    } catch (caught) {
      if (caught instanceof SteamApiError && caught.status === 400) return [];
      throw caught;
    }
  }

  /** Keyless, so it does not consume the key's budget — but still rate limited. */
  async getGlobalAchievementPercentages(appId: number | string): Promise<Map<string, number>> {
    const percentages = new Map<string, number>();
    try {
      const json = await getJson<{
        achievementpercentages?: { achievements?: { name: string; percent: string | number }[] };
      }>(
        `${WEB_API}/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/?gameid=${appId}`,
        webApiLimiter
      );
      for (const entry of json.achievementpercentages?.achievements ?? []) {
        const percent = Number(entry.percent);
        if (Number.isFinite(percent)) percentages.set(entry.name, percent);
      }
    } catch {
      // Rarity is a nice-to-have; a failure here must not fail the whole scan.
    }
    return percentages;
  }

  /** Requires the friend list to be public; Steam 401s otherwise. */
  async getFriends(steamId: string): Promise<RawFriend[]> {
    try {
      const json = await getJson<{ friendslist?: { friends?: RawFriend[] } }>(
        this.#url('ISteamUser/GetFriendList/v1/', { steamid: steamId, relationship: 'friend' }),
        webApiLimiter
      );
      return json.friendslist?.friends ?? [];
    } catch (caught) {
      if (caught instanceof SteamApiError && (caught.status === 401 || caught.status === 403)) {
        throw new SteamPrivateError('This Steam friend list is private.');
      }
      throw caught;
    }
  }

  /** Summaries for many players at once — 100 per call is Steam's cap. */
  async getPlayerSummaries(steamIds: string[]): Promise<RawPlayerSummary[]> {
    const players: RawPlayerSummary[] = [];
    for (let index = 0; index < steamIds.length; index += 100) {
      const batch = steamIds.slice(index, index + 100);
      const json = await getJson<{ response?: { players?: RawPlayerSummary[] } }>(
        this.#url('ISteamUser/GetPlayerSummaries/v2/', { steamids: batch.join(',') }),
        webApiLimiter
      );
      players.push(...(json.response?.players ?? []));
    }
    return players;
  }

  /**
   * Community inventory. Keyless, undocumented, and the most fragile thing here.
   *
   * A private inventory returns 403; an empty one returns 200 with no `assets`.
   * Uses its own slower limiter because this endpoint starts refusing after only
   * a handful of requests per minute.
   */
  async getInventory(
    steamId: string,
    appId: number,
    contextId: number,
    count = 500
  ): Promise<RawInventoryResponse> {
    const url =
      `${COMMUNITY}/inventory/${steamId}/${appId}/${contextId}` +
      `?l=english&count=${count}`;

    try {
      const response = await request(url, communityLimiter);
      const text = await response.text();
      // An empty body is Steam's way of saying "nothing here", not valid JSON.
      if (!text.trim()) return { assets: [], descriptions: [] };
      return JSON.parse(text) as RawInventoryResponse;
    } catch (caught) {
      if (caught instanceof SteamApiError && (caught.status === 403 || caught.status === 401)) {
        throw new SteamPrivateError('This Steam inventory is private.');
      }
      throw caught;
    }
  }
}

// ---------------------------------------------------------------------------
// Supported inventories
// ---------------------------------------------------------------------------

/**
 * Inventories worth syncing, with their context ids.
 *
 * The context id is not guessable — it identifies a sub-inventory within an app,
 * and using the wrong one returns an empty list rather than an error. 753/6 is
 * the Steam community inventory, which is where trading cards, backgrounds,
 * emoticons and boosters live.
 */
export const SUPPORTED_INVENTORIES: {
  appId: number;
  contextId: number;
  label: string;
}[] = [
  { appId: 730, contextId: 2, label: 'Counter-Strike 2' },
  { appId: 440, contextId: 2, label: 'Team Fortress 2' },
  { appId: 570, contextId: 2, label: 'Dota 2' },
  { appId: 252490, contextId: 2, label: 'Rust' },
  { appId: 753, contextId: 6, label: 'Steam Community' },
];

/**
 * Rarity ranking for the "featured items" ordering.
 *
 * Steam has no cross-game rarity scale — CS2 uses `Rarity_Ancient`, TF2 uses
 * `Rarity_Legendary` for a different tier, and community items have none at all.
 * These are ranked on the internal names Steam actually emits, matched by
 * substring so the per-weapon variants (`Rarity_Rare_Weapon`) fall in the right
 * place. Unknown rarities rank 0 and sort last, which is the honest outcome.
 */
const RARITY_RANK: [pattern: string, rank: number][] = [
  ['immortal', 100],
  ['arcana', 95],
  ['ancient', 90],
  ['legendary', 80],
  ['mythical', 70],
  ['rare', 60],
  ['uncommon', 50],
  ['unusual', 85],
  ['common', 40],
  ['base grade', 30],
];

export function rarityRank(internalName: string | undefined): number {
  if (!internalName) return 0;
  const lowered = internalName.toLowerCase();
  for (const [pattern, rank] of RARITY_RANK) {
    if (lowered.includes(pattern)) return rank;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Enum translation
// ---------------------------------------------------------------------------

export function visibilityFrom(state: number | undefined): 'public' | 'friends' | 'private' | 'unknown' {
  switch (state) {
    case 3:
      return 'public';
    case 2:
      return 'friends';
    case 1:
      return 'private';
    default:
      return 'unknown';
  }
}

const PERSONA_STATES = [
  'offline',
  'online',
  'busy',
  'away',
  'snooze',
  'looking_to_trade',
  'looking_to_play',
] as const;

export function statusFrom(state: number | undefined): string {
  if (state === undefined || state < 0 || state >= PERSONA_STATES.length) return 'unknown';
  return PERSONA_STATES[state];
}

/** Steam sends Unix seconds; Postgres wants ISO. 0 means "never". */
export function isoFromUnix(seconds: number | undefined | null): string | null {
  if (!seconds || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}
