import { editionKindFor, editionRank } from '../../constants/game-editions';
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

  /*
   * What kind of release this is. See `constants/game-editions.ts`.
   *
   * `game_type` is the current field; `category` is the deprecated one it
   * replaced, and the two carry the same numbers. Only `game_type` is
   * *requested* — asking for a field IGDB does not have fails the whole query,
   * and `GAME_FIELDS` is shared by every screen — but both are read, so a
   * response from an older deployment still resolves.
   */
  game_type?: number;
  /** @deprecated IGDB's own name for `game_type` before 2024. Read, never asked for. */
  category?: number;

  /** The base game, for a DLC, expansion, remake, remaster or port. */
  parent_game?: number;
  /**
   * The game this repackages, for a "Game of the Year Edition" and friends.
   *
   * Distinct from `parent_game`: a version is the *same game* in a different
   * box, where a remake is a different game. Every catalogue query in this app
   * filters on `version_parent = null`, so these surface only on the parent's
   * own page.
   */
  version_parent?: number;
  /** The marketing name of that repackage — "Definitive Edition". */
  version_title?: string;

  /**
   * Storefront listings. Only `category = 1` (Steam) is read here, for its
   * appid — see `steamAppIdOf`.
   */
  external_games?: { category?: number; uid?: string }[];
};

/** IGDB's `external_games.category` for Steam. */
const STEAM_EXTERNAL_CATEGORY = 1;

/**
 * The game's Steam appid, when it has a Steam listing.
 *
 * Read from the shared field list rather than through `getGameStores()`, which
 * is one request per game. A poster grid asks for artwork for fifty games at
 * once; fifty extra IGDB round trips to learn fifty appids would cost more than
 * the artwork is worth. The nested array is a few dozen bytes per row.
 *
 * Null for the many games that are not on Steam at all — every console
 * exclusive, and everything on itch.io. Those keep IGDB's own cover art.
 */
function steamAppIdOf(raw: IgdbGame): string | null {
  const listing = (raw.external_games ?? []).find(
    (entry) => entry.category === STEAM_EXTERNAL_CATEGORY && entry.uid
  );
  return listing?.uid ?? null;
}

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
         involved_companies.company.name,
         game_type, parent_game, version_parent, version_title,
         external_games.category, external_games.uid;
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
    ...editionOf(raw),
    steamAppId: steamAppIdOf(raw),
  };
}

/**
 * The release-type half of a `Game`: what kind of release it is, and what it
 * descends from.
 *
 * `parent_game` and `version_parent` are different relationships (see the field
 * notes above) but they answer the same question for a reader — *which game is
 * this a version of* — so they collapse into one `parentId`. The kind is what
 * keeps them distinguishable where it matters.
 */
function editionOf(raw: IgdbGame): Pick<Game, 'edition' | 'editionTitle' | 'parentId'> {
  const parent = raw.version_parent ?? raw.parent_game ?? null;

  return {
    edition: editionKindFor({
      // `category` is the pre-2024 name and is only read, never requested.
      gameType: raw.game_type ?? raw.category ?? null,
      versionParent: raw.version_parent ?? null,
    }),
    editionTitle: raw.version_title ?? null,
    parentId: parent === null ? null : makeGameId('igdb', parent),
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
    edition: game.edition,
    editionTitle: game.editionTitle,
    parentId: game.parentId,
    steamAppId: game.steamAppId,
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
/**
 * The clause that keeps a series rail to the games themselves.
 *
 * `version_parent = null` was already dropping repackages — "Game of the Year
 * Edition" and friends. `game_type = 0` additionally drops remakes, remasters,
 * ports, DLC, expansions and bundles, which were filling a franchise rail with
 * things that are not entries in the series: Mafia's rail listed Mafia, Mafia
 * II, Mafia III *and* three Definitive Editions, so the same games appeared
 * twice and the chronology stopped being one.
 *
 * They have not gone anywhere — the parent game's own page lists them under
 * "Editions & extras", which is the question they actually answer.
 */
const ORIGINALS_ONLY = 'version_parent = null & game_type = 0';

export async function getCollectionGames(
  collectionId: number,
  signal?: AbortSignal
): Promise<GameSearchResult[]> {
  const raw = await igdbQuery<IgdbGame[]>(
    'games',
    `${GAME_FIELDS}
     where collection = ${collectionId} & ${ORIGINALS_ONLY};
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
     where franchises = (${franchiseId}) & ${ORIGINALS_ONLY};
     sort first_release_date asc;
     limit 50;`,
    signal
  );
  return (raw ?? []).map(toGame).map(toSearchResult);
}

/**
 * Everything that descends from one game: its remakes, remasters, ports, DLC,
 * expansions, bundles and repackaged editions.
 *
 * One query, not eight. IGDB exposes this as reverse relations on the parent
 * (`remakes`, `dlcs`, `expansions`, …) and the obvious implementation reads
 * those arrays and then fetches each id — nine round trips to fill one rail.
 * Asking the *children* which parent they point at is the same answer in a
 * single request, and it catches both relationships at once: `parent_game` for
 * a remake or a DLC, `version_parent` for a repackage.
 *
 * Sorted here rather than by IGDB, because the useful order mixes two fields —
 * kind first (see `editionRank`: other versions of the game before add-ons to
 * it), release date second — and APIcalypse cannot express that.
 */
export async function getGameEditions(
  sourceId: string,
  signal?: AbortSignal
): Promise<GameSearchResult[]> {
  const numeric = Number(sourceId);
  if (!Number.isFinite(numeric)) return [];

  const raw = await igdbQuery<IgdbGame[]>(
    'games',
    `${GAME_FIELDS}
     where parent_game = ${numeric} | version_parent = ${numeric};
     limit 50;`,
    signal
  );

  return (raw ?? [])
    .map(toGame)
    .map(toSearchResult)
    .sort(
      (a, b) =>
        editionRank(a.edition) - editionRank(b.edition) ||
        (a.releaseYear ?? 0) - (b.releaseYear ?? 0)
    );
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

/* -------------------------------------------------------------------------
 * Filtered search
 *
 * The plain `search` above is the one every browse screen uses: a title, ranked
 * by IGDB's relevance, and nothing else. Award shows need the other question —
 * "what came out in 2019 that was a Nintendo Switch platformer" — where the term
 * is optional and the filters are the query.
 * ---------------------------------------------------------------------------- */

/** One entry from IGDB's `genres` or `platforms` reference tables. */
export type IgdbTag = { id: number; name: string };

/**
 * Every filter the award picker can apply. All optional; all combinable.
 *
 * Ids rather than names for genre and platform because IGDB indexes those and
 * matching on the nested name is both slower and ambiguous ("Adventure" also
 * matches "Point-and-click Adventure"). Studio is a name, because there is no
 * company picker to choose an id from — see `studio` below.
 */
export type GameFilters = {
  /** Free text. Optional: filters alone are a valid query. */
  term?: string;
  genreId?: number | null;
  platformId?: number | null;
  /** Developer or publisher name, matched case-insensitively as a substring. */
  studio?: string | null;
  /** Inclusive release year range. Either end may stand alone. */
  fromYear?: number | null;
  toYear?: number | null;
};

/** IGDB's earliest dated release is 1958 (Tennis for Two). */
export const EARLIEST_IGDB_YEAR = 1958;

/** Unix seconds for 1 January of `year`, which is how IGDB stores release dates. */
function yearStart(year: number): number {
  return Math.floor(Date.UTC(year, 0, 1) / 1000);
}

/** Escapes a value for an APIcalypse string literal. See `search`. */
function quote(value: string): string {
  return value.trim().replace(/"/g, '\\"');
}

/**
 * Search the catalogue with any combination of term, genre, platform, studio
 * and release-year range.
 *
 * ## Why the sort is conditional
 *
 * IGDB rejects `sort` on a `search` query — search results *are* an ordering, by
 * relevance, and asking for a second one is an error rather than a tiebreak. So
 * a query with a term keeps relevance order, and a query without one is sorted
 * newest-first, which is the only useful default when the filters are doing all
 * the work. Callers that want another order re-sort in memory with `sortGames`.
 *
 * ## Why `total_rating_count` on the filters-only path
 *
 * "Everything on Switch" is forty thousand rows and the first page of them by
 * date is shovelware. Requiring a handful of ratings is the cheapest available
 * proxy for "a real release", and it is only applied when there is no term —
 * with a term the user has already said what they want and filtering it out
 * because nobody rated it would be wrong.
 */
export async function searchGamesFiltered(
  filters: GameFilters,
  signal?: AbortSignal
): Promise<GameSearchResult[]> {
  const term = filters.term?.trim() ?? '';
  const where: string[] = ['version_parent = null'];

  if (filters.genreId) where.push(`genres = (${filters.genreId})`);
  if (filters.platformId) where.push(`platforms = (${filters.platformId})`);
  if (filters.studio?.trim()) {
    where.push(`involved_companies.company.name ~ *"${quote(filters.studio)}"*`);
  }
  if (filters.fromYear) where.push(`first_release_date >= ${yearStart(filters.fromYear)}`);
  // Exclusive upper bound on 1 Jan of the *next* year, so `toYear` is inclusive.
  if (filters.toYear) where.push(`first_release_date < ${yearStart(filters.toYear + 1)}`);

  if (!term) where.push('total_rating_count >= 5');

  const clause = `where ${where.join(' & ')};`;
  const body = term
    ? `search "${quote(term)}"; ${GAME_FIELDS} ${clause} limit 40;`
    : `${GAME_FIELDS} ${clause} sort first_release_date desc; limit 40;`;

  const raw = await igdbQuery<IgdbGame[]>('games', body, signal);
  return (raw ?? []).map(toGame).map(toSearchResult);
}

/**
 * IGDB's genre and platform vocabularies, for the filter pickers.
 *
 * Both endpoints are already on the Edge Function allowlist. The lists are
 * static in practice — IGDB adds a platform every few years — so callers should
 * cache them for the session rather than refetching per keystroke.
 *
 * Platforms are capped and sorted by `generation` descending so the console
 * someone is likely to mean is near the top; IGDB lists ~200 platforms
 * including arcade boards and calculators, and an unsorted picker of those is
 * unusable.
 */
export async function getGenres(signal?: AbortSignal): Promise<IgdbTag[]> {
  const raw = await igdbQuery<IgdbTag[]>(
    'genres',
    'fields name; sort name asc; limit 100;',
    signal
  );
  return (raw ?? []).filter((entry) => entry.name);
}

export async function getPlatforms(signal?: AbortSignal): Promise<IgdbTag[]> {
  const raw = await igdbQuery<(IgdbTag & { generation?: number })[]>(
    'platforms',
    'fields name, generation; where category = (1,5,6); sort generation desc; limit 100;',
    signal
  );
  return (raw ?? []).filter((entry) => entry.name).map(({ id, name }) => ({ id, name }));
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
