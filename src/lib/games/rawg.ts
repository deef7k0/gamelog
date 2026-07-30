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
 * RAWG provider.
 *
 * RAWG's strength is breadth (console titles IGDB sometimes misses) and its
 * per-game achievement lists, which IGDB does not have at all. Its weakness is
 * imagery: `background_image` is landscape key art, never portrait box art, so
 * RAWG results fall back to the hero image in poster slots.
 *
 * Auth is a single `key` query param. Get one free at https://rawg.io/apidocs
 * — no OAuth, no secret, so unlike IGDB this can run straight from the client.
 * The key is still visible in the bundle; RAWG keys are free and rotatable, so
 * that is an accepted trade rather than a problem.
 */

const API_BASE = 'https://api.rawg.io/api';

function apiKey(): string | null {
  const key = process.env.EXPO_PUBLIC_RAWG_API_KEY?.trim();
  return key ? key : null;
}

type RawgGame = {
  id: number;
  name?: string;
  slug?: string;
  description_raw?: string;
  description?: string;
  background_image?: string;
  background_image_additional?: string;
  released?: string;
  /** 0-100 */
  metacritic?: number;
  /** 0-5 */
  rating?: number;
  genres?: { name?: string }[];
  platforms?: { platform?: { name?: string } }[];
  parent_platforms?: { platform?: { name?: string } }[];
  developers?: { name?: string }[];
  publishers?: { name?: string }[];
  short_screenshots?: { image?: string }[];
};

type RawgList<T> = { results?: T[]; detail?: string };

type RawgAchievement = {
  id: number;
  name?: string;
  description?: string;
  image?: string;
  /** RAWG returns this as a string percentage, e.g. "42.13". */
  percent?: string;
};

async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const key = apiKey();
  if (!key) throw new Error('RAWG API key is not configured');

  const separator = path.includes('?') ? '&' : '?';
  const response = await fetch(`${API_BASE}${path}${separator}key=${encodeURIComponent(key)}`, {
    signal,
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`RAWG request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

/**
 * RAWG reports two scores: `metacritic` (0-100, often absent) and `rating`
 * (0-5, almost always present). Prefer Metacritic, scale the community rating
 * when it is missing, so the UI has something to show either way.
 */
function normalizeScore(raw: RawgGame): number | null {
  if (typeof raw.metacritic === 'number') return raw.metacritic;
  if (typeof raw.rating === 'number' && raw.rating > 0) return Math.round(raw.rating * 20);
  return null;
}

function names(list: { name?: string }[] | undefined): string[] {
  return (list ?? []).map((entry) => entry.name).filter((name): name is string => !!name);
}

function toGame(raw: RawgGame): Game {
  return {
    id: makeGameId('rawg', raw.id),
    source: 'rawg',
    sourceId: String(raw.id),
    title: raw.name ?? 'Untitled',
    // RAWG has no portrait art. Leaving this null lets the UI fall back to the
    // hero rather than stretching a landscape image into a poster slot.
    coverUrl: null,
    heroUrl: raw.background_image ?? null,
    description: raw.description_raw ?? stripHtml(raw.description),
    releaseDate: raw.released ?? null,
    releaseYear: yearFrom(raw.released),
    developer: names(raw.developers)[0] ?? null,
    publisher: names(raw.publishers)[0] ?? null,
    genres: names(raw.genres),
    platforms: (raw.platforms ?? [])
      .map((entry) => entry.platform?.name)
      .filter((name): name is string => !!name),
    score: normalizeScore(raw),
    storeUrl: raw.slug ? `https://rawg.io/games/${raw.slug}` : null,
    screenshots: (raw.short_screenshots ?? [])
      .map((shot) => shot.image)
      .filter((url): url is string => !!url),
  };
}

async function search(term: string, signal?: AbortSignal): Promise<GameSearchResult[]> {
  const trimmed = term.trim();
  if (!trimmed) return [];

  const json = await fetchJson<RawgList<RawgGame>>(
    `/games?search=${encodeURIComponent(trimmed)}&page_size=30`,
    signal
  );

  return (json.results ?? []).map((raw) => {
    const game = toGame(raw);
    return {
      id: game.id,
      source: game.source,
      sourceId: game.sourceId,
      title: game.title,
      coverUrl: game.coverUrl,
      heroUrl: game.heroUrl,
      releaseYear: game.releaseYear,
      developer: game.developer,
      genres: game.genres,
      platforms: game.platforms,
      score: game.score,
    };
  });
}

async function getById(sourceId: string, signal?: AbortSignal): Promise<Game | null> {
  const json = await fetchJson<RawgGame & { detail?: string }>(
    `/games/${encodeURIComponent(sourceId)}`,
    signal
  );
  // RAWG answers 200 with `{detail: "Not found."}` rather than a 404.
  if (!json || json.detail) return null;
  return toGame(json);
}

async function getAchievements(sourceId: string, signal?: AbortSignal): Promise<Achievement[]> {
  const gameId = makeGameId('rawg', sourceId);
  const json = await fetchJson<RawgList<RawgAchievement>>(
    `/games/${encodeURIComponent(sourceId)}/achievements?page_size=100`,
    signal
  );

  return (json.results ?? []).map((raw) => {
    const percent = raw.percent === undefined ? NaN : Number(raw.percent);
    return {
      id: `${gameId}:${raw.id}`,
      gameId,
      externalId: String(raw.id),
      name: raw.name ?? 'Unnamed achievement',
      description: raw.description ?? null,
      iconUrl: raw.image ?? null,
      globalPercent: Number.isFinite(percent) ? percent : null,
      hidden: false,
    };
  });
}

export const rawgProvider: GameProvider = {
  source: 'rawg',
  label: 'RAWG',
  isEnabled: () => apiKey() !== null,
  search,
  getById,
  getAchievements,
};
