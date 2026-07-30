import {
  makeGameId,
  stripHtml,
  yearFrom,
  type Game,
  type GameProvider,
  type GameSearchResult,
} from './types';

/**
 * itch.io provider.
 *
 * Unlike Steam, itch.io has no keyless search — every documented endpoint
 * returns `{"errors":["invalid key"]}` without one. So this provider stays
 * dormant until EXPO_PUBLIC_ITCH_API_KEY is set, and `searchGames()` simply
 * skips it. Everything else in the app keeps working.
 *
 * Get a key at https://itch.io/user/settings/api-keys — note it is a *personal*
 * key tied to your account, so this is really a development convenience rather
 * than something to ship publicly.
 *
 * Docs: https://itch.io/docs/api/serverside
 */

const API_BASE = 'https://itch.io/api/1';

function apiKey(): string | null {
  const key = process.env.EXPO_PUBLIC_ITCH_API_KEY?.trim();
  return key ? key : null;
}

type ItchGame = {
  id: number;
  title?: string;
  short_text?: string;
  cover_url?: string;
  url?: string;
  published_at?: string;
  created_at?: string;
  user?: { display_name?: string; username?: string };
  classification?: string;
};

type ItchSearchResponse = {
  games?: ItchGame[];
  errors?: string[];
};

async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const key = apiKey();
  if (!key) throw new Error('itch.io API key is not configured');

  const response = await fetch(`${API_BASE}/${key}${path}`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`itch.io request failed (${response.status})`);
  }

  const json = (await response.json()) as T & { errors?: string[] };
  if (json.errors?.length) {
    throw new Error(`itch.io: ${json.errors.join(', ')}`);
  }
  return json;
}

function toGame(raw: ItchGame): Game {
  const released = raw.published_at ?? raw.created_at ?? null;

  return {
    id: makeGameId('itch', raw.id),
    source: 'itch',
    sourceId: String(raw.id),
    title: raw.title ?? 'Untitled',
    // itch cover art is a 630x500 landscape-ish thumbnail, not box art.
    coverUrl: null,
    heroUrl: raw.cover_url ?? null,
    description: stripHtml(raw.short_text),
    releaseDate: released,
    releaseYear: yearFrom(released),
    developer: raw.user?.display_name ?? raw.user?.username ?? null,
    publisher: null,
    // itch.io has user-defined tags rather than a fixed genre list, and the
    // search payload does not include them.
    genres: [],
    platforms: [],
    score: null,
    storeUrl: raw.url ?? null,
    screenshots: [],
  };
}

async function search(query: string, signal?: AbortSignal): Promise<GameSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const json = await fetchJson<ItchSearchResponse>(
    `/search/games?query=${encodeURIComponent(trimmed)}`,
    signal
  );

  return (json.games ?? []).map((raw) => {
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
  const json = await fetchJson<{ game?: ItchGame }>(
    `/game/${encodeURIComponent(sourceId)}`,
    signal
  );
  return json.game ? toGame(json.game) : null;
}

export const itchProvider: GameProvider = {
  source: 'itch',
  label: 'itch.io',
  isEnabled: () => apiKey() !== null,
  search,
  getById,
};
