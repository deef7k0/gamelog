import { supabase } from '../supabase';
import { makeGameId, yearFrom, type Game, type GameProvider, type GameSearchResult } from './types';

/**
 * IGDB provider.
 *
 * IGDB is the only source with true portrait box art, which the poster-led UI is
 * built around — so this is the preferred provider.
 *
 * Requests do not go to IGDB directly. Its auth needs a Twitch `client_secret`,
 * which cannot ship in an app bundle, so everything is relayed through the
 * `igdb` Supabase Edge Function (see supabase/functions/igdb/index.ts). That
 * also means IGDB is only available to signed-in users, which is fine — every
 * screen that searches is already behind the auth guard.
 *
 * Queries use APIcalypse, IGDB's own query language:
 *   https://api-docs.igdb.com/#apicalypse
 */

type IgdbImage = { image_id?: string };

type IgdbGame = {
  id: number;
  name?: string;
  summary?: string;
  storyline?: string;
  cover?: IgdbImage;
  artworks?: IgdbImage[];
  screenshots?: IgdbImage[];
  /** Unix seconds. */
  first_release_date?: number;
  genres?: { name?: string }[];
  platforms?: { name?: string; abbreviation?: string }[];
  involved_companies?: {
    developer?: boolean;
    publisher?: boolean;
    company?: { name?: string };
  }[];
  /** 0-100 already. */
  total_rating?: number;
  url?: string;
};

/**
 * IGDB returns image ids, not URLs; you pick a size when building the URL.
 * t_cover_big  = 264x374 portrait
 * t_screenshot_huge / t_1080p = landscape
 */
function imageUrl(image: IgdbImage | undefined, size: string): string | null {
  if (!image?.image_id) return null;
  return `https://images.igdb.com/igdb/image/upload/t_${size}/${image.image_id}.jpg`;
}

/** Common field list so search and detail return the same shape. */
const GAME_FIELDS = `
  fields name, summary, storyline, url, total_rating, first_release_date,
         cover.image_id, artworks.image_id, screenshots.image_id,
         genres.name, platforms.name, platforms.abbreviation,
         involved_companies.developer, involved_companies.publisher,
         involved_companies.company.name;
`;

/**
 * Every query is relayed through the Edge Function, which attaches the real
 * IGDB credentials. `supabase.functions.invoke` adds the caller's session JWT.
 */
export async function igdbQuery<T>(
  endpoint: string,
  body: string,
  signal?: AbortSignal
): Promise<T> {
  const { data, error } = await supabase.functions.invoke('igdb', {
    body: { endpoint, query: body },
    ...(signal ? { signal } : {}),
  });

  if (error) {
    throw new Error(`IGDB request failed: ${error.message}`);
  }
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error(String((data as { error: unknown }).error));
  }
  return data as T;
}

function companyNamed(raw: IgdbGame, role: 'developer' | 'publisher'): string | null {
  const match = raw.involved_companies?.find((entry) => entry[role]);
  return match?.company?.name ?? null;
}

function toGame(raw: IgdbGame): Game {
  const releaseDate = raw.first_release_date
    ? new Date(raw.first_release_date * 1000).toISOString().slice(0, 10)
    : null;

  return {
    id: makeGameId('igdb', raw.id),
    source: 'igdb',
    sourceId: String(raw.id),
    title: raw.name ?? 'Untitled',
    coverUrl: imageUrl(raw.cover, 'cover_big'),
    // Artworks are proper key art; screenshots are the fallback backdrop.
    heroUrl: imageUrl(raw.artworks?.[0], '1080p') ?? imageUrl(raw.screenshots?.[0], '1080p'),
    description: raw.summary ?? raw.storyline ?? null,
    releaseDate,
    releaseYear: yearFrom(releaseDate),
    developer: companyNamed(raw, 'developer'),
    publisher: companyNamed(raw, 'publisher'),
    genres: (raw.genres ?? []).map((genre) => genre.name).filter((name): name is string => !!name),
    platforms: (raw.platforms ?? [])
      .map((platform) => platform.name)
      .filter((name): name is string => !!name),
    score: typeof raw.total_rating === 'number' ? Math.round(raw.total_rating) : null,
    storeUrl: raw.url ?? null,
    screenshots: (raw.screenshots ?? [])
      .map((shot) => imageUrl(shot, 'screenshot_huge'))
      .filter((url): url is string => !!url),
  };
}

function toSearchResult(game: Game): GameSearchResult {
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
}

async function search(term: string, signal?: AbortSignal): Promise<GameSearchResult[]> {
  const trimmed = term.trim();
  if (!trimmed) return [];

  // Escaping quotes keeps a title like `Marathon "Durandal"` from breaking the
  // APIcalypse string literal.
  const escaped = trimmed.replace(/"/g, '\\"');

  const raw = await igdbQuery<IgdbGame[]>(
    'games',
    `search "${escaped}"; ${GAME_FIELDS} where version_parent = null; limit 30;`,
    signal
  );

  return (raw ?? []).map(toGame).map(toSearchResult);
}

async function getById(sourceId: string, signal?: AbortSignal): Promise<Game | null> {
  const numeric = Number(sourceId);
  if (!Number.isFinite(numeric)) return null;

  const raw = await igdbQuery<IgdbGame[]>(
    'games',
    `${GAME_FIELDS} where id = ${numeric}; limit 1;`,
    signal
  );

  const first = raw?.[0];
  return first ? toGame(first) : null;
}

/**
 * IGDB's own "you might also like" list for a game.
 *
 * `similar_games` is a field on `games`, not a separate endpoint, so this needs
 * no change to the Edge Function allowlist. Only meaningful for IGDB-sourced
 * games — Steam, RAWG and itch.io ids have no equivalent, and the aggregator in
 * index.ts returns an empty list for them rather than guessing.
 */
export async function getSimilarGames(
  sourceId: string,
  signal?: AbortSignal
): Promise<GameSearchResult[]> {
  const numeric = Number(sourceId);
  if (!Number.isFinite(numeric)) return [];

  const raw = await igdbQuery<{ similar_games?: IgdbGame[] }[]>(
    'games',
    `fields similar_games.name, similar_games.total_rating,
            similar_games.first_release_date, similar_games.cover.image_id,
            similar_games.artworks.image_id, similar_games.screenshots.image_id;
     where id = ${numeric};
     limit 1;`,
    signal
  );

  const similar = raw?.[0]?.similar_games ?? [];
  return similar.map((game) => toSearchResult(toGame(game)));
}

// ---------------------------------------------------------------------------
// Franchise, studio and cast
// ---------------------------------------------------------------------------

export type GameCompany = { id: number; name: string; role: 'developer' | 'publisher' };

/** A game's series, its franchises, and the companies behind it. */
export type GameExtras = {
  /** IGDB's `collection` — the numbered series, e.g. "Grand Theft Auto". */
  collection: { id: number; name: string } | null;
  /** Broader franchises the game belongs to. A game can be in several. */
  franchises: { id: number; name: string }[];
  companies: GameCompany[];
};

type IgdbExtras = {
  collection?: { id: number; name?: string };
  franchises?: { id: number; name?: string }[];
  involved_companies?: {
    developer?: boolean;
    publisher?: boolean;
    company?: { id: number; name?: string };
  }[];
};

/**
 * The identifiers the Overview tab needs to make its sections navigable.
 *
 * Kept separate from `getById` because `Game` is the shared cross-provider shape
 * and only IGDB has these — putting nullable IGDB ids on every Steam and RAWG
 * game to serve one screen would be the wrong trade.
 */
export async function getGameExtras(
  sourceId: string,
  signal?: AbortSignal
): Promise<GameExtras | null> {
  const numeric = Number(sourceId);
  if (!Number.isFinite(numeric)) return null;

  const raw = await igdbQuery<IgdbExtras[]>(
    'games',
    `fields collection.id, collection.name, franchises.id, franchises.name,
            involved_companies.developer, involved_companies.publisher,
            involved_companies.company.id, involved_companies.company.name;
     where id = ${numeric};
     limit 1;`,
    signal
  );

  const first = raw?.[0];
  if (!first) return null;

  const companies: GameCompany[] = [];
  for (const entry of first.involved_companies ?? []) {
    if (!entry.company?.id || !entry.company.name) continue;
    // A company can be both; the developer credit is the more interesting one.
    const role = entry.developer ? 'developer' : entry.publisher ? 'publisher' : null;
    if (!role) continue;
    if (companies.some((existing) => existing.id === entry.company!.id)) continue;
    companies.push({ id: entry.company.id, name: entry.company.name, role });
  }

  return {
    collection:
      first.collection?.id && first.collection.name
        ? { id: first.collection.id, name: first.collection.name }
        : null,
    franchises: (first.franchises ?? [])
      .filter((entry): entry is { id: number; name: string } => !!entry.id && !!entry.name)
      .map((entry) => ({ id: entry.id, name: entry.name })),
    companies,
  };
}

/**
 * Every game in a series, oldest first.
 *
 * Ordered by release rather than rating because a franchise list is read as a
 * chronology — "what came before this one" — not as a leaderboard.
 */
export async function getCollectionGames(
  collectionId: number,
  signal?: AbortSignal
): Promise<GameSearchResult[]> {
  const raw = await igdbQuery<IgdbGame[]>(
    'games',
    `${GAME_FIELDS}
     where collection = ${collectionId} & version_parent = null;
     sort first_release_date asc;
     limit 50;`,
    signal
  );
  return (raw ?? []).map(toGame).map(toSearchResult);
}

export async function getFranchiseGames(
  franchiseId: number,
  signal?: AbortSignal
): Promise<GameSearchResult[]> {
  const raw = await igdbQuery<IgdbGame[]>(
    'games',
    `${GAME_FIELDS}
     where franchises = (${franchiseId}) & version_parent = null;
     sort first_release_date asc;
     limit 50;`,
    signal
  );
  return (raw ?? []).map(toGame).map(toSearchResult);
}

/**
 * A studio's catalogue.
 *
 * `version_parent = null` drops the "Game of the Year Edition" style duplicates
 * that would otherwise fill a prolific publisher's grid with the same titles.
 */
export async function getCompanyGames(
  companyId: number,
  signal?: AbortSignal
): Promise<GameSearchResult[]> {
  const raw = await igdbQuery<IgdbGame[]>(
    'games',
    `${GAME_FIELDS}
     where involved_companies.company = ${companyId}
       & version_parent = null
       & cover != null;
     sort first_release_date desc;
     limit 100;`,
    signal
  );
  return (raw ?? []).map(toGame).map(toSearchResult);
}

// ---------------------------------------------------------------------------
// Storefronts
// ---------------------------------------------------------------------------

/** One storefront listing for a game, keyed by IGDB's `external_games.category`. */
export type GameStoreLink = {
  /** IGDB category: 1 Steam, 11 Microsoft, 13 Apple, 15 Android, 36 PlayStation. */
  category: number;
  /** The store's own id. For Steam this is the appid, which unlocks pricing. */
  uid: string;
  url: string | null;
};

type IgdbExternal = { category?: number; uid?: string; url?: string };

/**
 * Where a game can actually be bought, per storefront.
 *
 * Queried through `games` with a nested `external_games` expansion rather than
 * the `external_games` endpoint directly, so the Edge Function allowlist needs
 * no change and no redeploy.
 *
 * This is the closest thing to pricing IGDB offers: it says *where* a game is
 * sold and gives each store's own identifier, but never what it costs. The
 * Steam `uid` is the one that goes further — it is the appid, and Steam's own
 * store endpoint will quote a price for it.
 */
export async function getGameStores(
  sourceId: string,
  signal?: AbortSignal
): Promise<GameStoreLink[]> {
  const numeric = Number(sourceId);
  if (!Number.isFinite(numeric)) return [];

  try {
    const raw = await igdbQuery<{ external_games?: IgdbExternal[] }[]>(
      'games',
      `fields external_games.category, external_games.uid, external_games.url;
       where id = ${numeric};
       limit 1;`,
      signal
    );

    const entries = raw?.[0]?.external_games ?? [];
    const seen = new Set<number>();
    const links: GameStoreLink[] = [];

    for (const entry of entries) {
      if (entry.category === undefined || !entry.uid) continue;
      // A game can list the same store twice (regional SKUs); the first wins.
      if (seen.has(entry.category)) continue;
      seen.add(entry.category);
      links.push({ category: entry.category, uid: entry.uid, url: entry.url ?? null });
    }
    return links;
  } catch {
    // A missing store row is not worth failing the page over.
    return [];
  }
}

export type GameCharacter = {
  id: number;
  name: string;
  description: string | null;
  portraitUrl: string | null;
  /**
   * Who played or voiced them.
   *
   * Always null from IGDB: its v4 API has a `characters` endpoint but no actor,
   * credits or people data of any kind — the `credits` endpoint from v2/v3 was
   * removed and never replaced. The field exists so a provider that does have it
   * can populate it without changing this shape or the UI.
   */
  actor: string | null;
};

type IgdbCharacter = {
  id: number;
  name?: string;
  description?: string;
  mug_shot?: IgdbImage;
};

/** Characters appearing in a game, for the Overview tab's Cast section. */
export async function getGameCharacters(
  sourceId: string,
  signal?: AbortSignal
): Promise<GameCharacter[]> {
  const numeric = Number(sourceId);
  if (!Number.isFinite(numeric)) return [];

  try {
    const raw = await igdbQuery<IgdbCharacter[]>(
      'characters',
      `fields name, description, mug_shot.image_id;
       where games = (${numeric}) & mug_shot != null;
       limit 24;`,
      signal
    );

    return (raw ?? [])
      .filter((entry) => entry.name)
      .map((entry) => ({
        id: entry.id,
        name: entry.name!,
        description: entry.description ?? null,
        portraitUrl: imageUrl(entry.mug_shot, 'thumb'),
        actor: null,
      }));
  } catch {
    // `characters` needs adding to the Edge Function allowlist and a redeploy.
    // Until then the Cast section simply does not appear.
    return [];
  }
}

export const igdbProvider: GameProvider = {
  source: 'igdb',
  label: 'IGDB',
  // Enabled whenever Supabase is reachable — the Edge Function holds the keys,
  // so there is nothing for the client to configure.
  isEnabled: () => process.env.EXPO_PUBLIC_IGDB_ENABLED !== 'false',
  search,
  getById,
};
