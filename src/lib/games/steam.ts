import {
  makeGameId,
  stripHtml,
  yearFrom,
  type Achievement,
  type Game,
  type GameProvider,
  type GameSearchResult,
} from './types';

/**
 * Steam provider.
 *
 * Steam has no official public search API. These store endpoints are
 * undocumented but keyless, stable for years, and what most third-party clients
 * use:
 *
 *   /api/storesearch  -> search by term
 *   /api/appdetails   -> full metadata for one appid
 *
 * Achievements are a different story: the *definitions* need a Steam Web API
 * key (see `EXPO_PUBLIC_STEAM_API_KEY`), though global unlock percentages are
 * keyless.
 *
 * Two caveats worth knowing:
 *  - The store endpoints send no CORS headers, so they fail in a browser. Fine
 *    on iOS/Android (React Native's fetch does not enforce CORS) but it means
 *    `npm run web` cannot search Steam directly.
 *  - appdetails is rate limited (roughly 200 requests / 5 min per IP), which is
 *    why detail lookups are cached below.
 */

const STORE_BASE = 'https://store.steampowered.com/api';
const WEB_API_BASE = 'https://api.steampowered.com';
const COUNTRY = 'US';
const LANGUAGE = 'english';

function webApiKey(): string | null {
  const key = process.env.EXPO_PUBLIC_STEAM_API_KEY?.trim();
  return key ? key : null;
}

type SteamSearchItem = {
  type?: string;
  id: number;
  name: string;
  tiny_image?: string;
  metascore?: string | number;
};

type SteamSearchResponse = {
  total?: number;
  items?: SteamSearchItem[];
};

type SteamAppDetailsEntry = {
  success: boolean;
  data?: {
    type?: string;
    name?: string;
    steam_appid?: number;
    short_description?: string;
    detailed_description?: string;
    header_image?: string;
    developers?: string[];
    publishers?: string[];
    genres?: { id: string; description: string }[];
    metacritic?: { score?: number };
    release_date?: { coming_soon?: boolean; date?: string };
    screenshots?: { path_full?: string }[];
    platforms?: { windows?: boolean; mac?: boolean; linux?: boolean };
  };
};

/** Portrait library capsule (600x900) — Steam's own vertical box art. */
function coverImage(appId: number | string): string {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`;
}

/** Landscape header (460x215), used as hero art. */
function headerImage(appId: number | string): string {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`;
}

function storeUrl(appId: number | string): string {
  return `https://store.steampowered.com/app/${appId}`;
}

function toNumberOrNull(value: string | number | undefined): number | null {
  if (value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Steam request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

async function search(query: string, signal?: AbortSignal): Promise<GameSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const url =
    `${STORE_BASE}/storesearch/?term=${encodeURIComponent(trimmed)}` +
    `&l=${LANGUAGE}&cc=${COUNTRY}`;

  const json = await fetchJson<SteamSearchResponse>(url, signal);

  return (
    (json.items ?? [])
      // Steam mixes soundtracks, DLC and hardware into results; keep actual games.
      .filter((item) => item.type === undefined || item.type === 'app')
      .map((item) => ({
        id: makeGameId('steam', item.id),
        source: 'steam' as const,
        sourceId: String(item.id),
        title: item.name,
        coverUrl: coverImage(item.id),
        heroUrl: headerImage(item.id),
        // storesearch does not return these; the detail screen fills them in.
        releaseYear: null,
        developer: null,
        genres: [],
        platforms: [],
        score: toNumberOrNull(item.metascore),
      }))
  );
}

/**
 * appdetails is rate limited, and the detail screen is easy to re-open, so hold
 * successful lookups for the session. Bounded so a long browse cannot grow it
 * without limit.
 */
const detailCache = new Map<string, Game>();
const DETAIL_CACHE_LIMIT = 100;

function rememberDetail(game: Game): void {
  if (detailCache.size >= DETAIL_CACHE_LIMIT) {
    const oldest = detailCache.keys().next().value;
    if (oldest !== undefined) detailCache.delete(oldest);
  }
  detailCache.set(game.sourceId, game);
}

type SteamPlatforms = { windows?: boolean; mac?: boolean; linux?: boolean };

function platformNames(platforms: SteamPlatforms | undefined): string[] {
  const names: string[] = [];
  if (platforms?.windows) names.push('Windows');
  if (platforms?.mac) names.push('macOS');
  if (platforms?.linux) names.push('Linux');
  return names;
}

async function getById(sourceId: string, signal?: AbortSignal): Promise<Game | null> {
  const cached = detailCache.get(sourceId);
  if (cached) return cached;

  const url = `${STORE_BASE}/appdetails?appids=${encodeURIComponent(sourceId)}&l=${LANGUAGE}`;
  const json = await fetchJson<Record<string, SteamAppDetailsEntry>>(url, signal);

  const entry = json[sourceId];
  if (!entry?.success || !entry.data) return null;

  const data = entry.data;
  const releaseDate = data.release_date?.coming_soon ? null : (data.release_date?.date ?? null);

  const game: Game = {
    id: makeGameId('steam', sourceId),
    source: 'steam',
    sourceId,
    title: data.name ?? 'Unknown title',
    coverUrl: coverImage(sourceId),
    heroUrl: data.header_image ?? headerImage(sourceId),
    description: stripHtml(data.short_description) ?? stripHtml(data.detailed_description),
    releaseDate,
    releaseYear: yearFrom(releaseDate),
    developer: data.developers?.[0] ?? null,
    publisher: data.publishers?.[0] ?? null,
    genres: (data.genres ?? []).map((genre) => genre.description),
    platforms: platformNames(data.platforms),
    score: data.metacritic?.score ?? null,
    storeUrl: storeUrl(sourceId),
    screenshots: (data.screenshots ?? [])
      .map((shot) => shot.path_full)
      .filter((url): url is string => !!url),
  };

  rememberDetail(game);
  return game;
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

type SchemaResponse = {
  game?: {
    availableGameStats?: {
      achievements?: {
        name: string;
        displayName?: string;
        description?: string;
        icon?: string;
        hidden?: number;
      }[];
    };
  };
};

type GlobalPercentResponse = {
  achievementpercentages?: {
    achievements?: { name: string; percent: string | number }[];
  };
};

/**
 * Achievement definitions for a game.
 *
 * Two calls: the schema (needs a key) for names, descriptions and icons, plus
 * the global percentages endpoint (keyless) for rarity. The percentages call is
 * best-effort — if it fails we still return usable achievements.
 */
async function getAchievements(sourceId: string, signal?: AbortSignal): Promise<Achievement[]> {
  const key = webApiKey();
  if (!key) return [];

  const gameId = makeGameId('steam', sourceId);

  const [schema, globals] = await Promise.all([
    fetchJson<SchemaResponse>(
      `${WEB_API_BASE}/ISteamUserStats/GetSchemaForGame/v2/` +
        `?key=${encodeURIComponent(key)}&appid=${encodeURIComponent(sourceId)}`,
      signal
    ),
    fetchJson<GlobalPercentResponse>(
      `${WEB_API_BASE}/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/` +
        `?gameid=${encodeURIComponent(sourceId)}`,
      signal
    ).catch(() => ({}) as GlobalPercentResponse),
  ]);

  const percentByName = new Map<string, number>();
  for (const entry of globals.achievementpercentages?.achievements ?? []) {
    const percent = Number(entry.percent);
    if (Number.isFinite(percent)) percentByName.set(entry.name, percent);
  }

  return (schema.game?.availableGameStats?.achievements ?? []).map((raw) => ({
    id: `${gameId}:${raw.name}`,
    gameId,
    externalId: raw.name,
    name: raw.displayName || raw.name,
    description: raw.description ?? null,
    iconUrl: raw.icon ?? null,
    globalPercent: percentByName.get(raw.name) ?? null,
    hidden: raw.hidden === 1,
  }));
}

type PlayerAchievementsResponse = {
  playerstats?: {
    success?: boolean;
    error?: string;
    achievements?: { apiname: string; achieved: number; unlocktime?: number }[];
  };
};

export type SteamUnlock = { externalId: string; unlockedAt: string };

/**
 * Which achievements a specific Steam user has unlocked in one game.
 *
 * Requires the player's Steam profile (and game details) to be public — Steam
 * returns an error rather than an empty list otherwise, which is surfaced here
 * so the UI can explain why a sync found nothing.
 */
export async function fetchSteamUnlocks(
  steamId: string,
  appId: string,
  signal?: AbortSignal
): Promise<SteamUnlock[]> {
  const key = webApiKey();
  if (!key) throw new Error('Steam API key is not configured.');

  const json = await fetchJson<PlayerAchievementsResponse>(
    `${WEB_API_BASE}/ISteamUserStats/GetPlayerAchievements/v1/` +
      `?key=${encodeURIComponent(key)}&steamid=${encodeURIComponent(steamId)}` +
      `&appid=${encodeURIComponent(appId)}`,
    signal
  );

  const stats = json.playerstats;
  if (stats?.success === false) {
    throw new Error(
      stats.error ?? 'Steam returned no stats. Is the profile public and the game owned?'
    );
  }

  return (stats?.achievements ?? [])
    .filter((entry) => entry.achieved === 1)
    .map((entry) => ({
      externalId: entry.apiname,
      unlockedAt: entry.unlocktime
        ? new Date(entry.unlocktime * 1000).toISOString()
        : new Date().toISOString(),
    }));
}

export function isSteamAchievementSyncAvailable(): boolean {
  return webApiKey() !== null;
}

export const steamProvider: GameProvider = {
  source: 'steam',
  label: 'Steam',
  isEnabled: () => true, // Search and details need no API key.
  search,
  getById,
  getAchievements,
};
