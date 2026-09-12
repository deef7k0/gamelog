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
  /* `t_` is added here, so callers pass a bare size — 'cover_big', not
     't_cover_big'. Passing the prefixed form builds `.../upload/t_t_cover_big/`,
     which IGDB 404s, and a 404 on an `<Image>` is a silent blank rather than an
     error. Stripping a leading `t_` costs nothing and removes the trap. */
  const bare = size.startsWith('t_') ? size.slice(2) : size;
  return `https://images.igdb.com/igdb/image/upload/t_${bare}/${image.image_id}.jpg`;
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
    releaseDate: game.releaseDate,
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

/* -------------------------------------------------------------------------
 * Surprise Me — one batch of candidate games
 * ---------------------------------------------------------------------- */

/** Which slice of the catalogue a roll draws from. */
export type SurprisePool = 'random' | 'popular' | 'hidden';

/**
 * The narrowing a roll may carry on top of its pool.
 *
 * Separate from `SurprisePool` because the two answer different questions. The
 * pool is *which slice of the catalogue* — famous, obscure, anything — and is
 * one of three. These are *what the game has to be*, and every one of them is
 * optional, combinable and orthogonal to the pool: "a hidden gem, isometric,
 * rated 80 or better" is a coherent request and needs no fourth pool.
 *
 * Every field is a list or a bound rather than a single value, so an empty list
 * and a null bound mean "no constraint" and nothing has to encode "all".
 */
export type SurprisePoolFilters = {
  /**
   * IGDB genre ids, **matched as "any of"**.
   *
   * `(a,b,c)` in APIcalypse, not `{a,b,c}`. Picking three genres means "I would
   * take any of these", which is what a person choosing *more* boxes expects
   * from a discovery feature — and "all of" is the reading that quietly returns
   * nothing, since a game tagged Platformer **and** Horror **and** Racing
   * roughly does not exist. Widening as you select is the only behaviour here
   * that cannot dead-end.
   */
  genreIds?: readonly number[];
  /** IGDB player-perspective ids, matched the same way. See `constants/player-perspectives.ts`. */
  perspectiveIds?: readonly number[];
  /**
   * A floor on IGDB's own aggregate, 0-100, or null for none.
   *
   * IGDB's number, not the app's: this filters the *catalogue*, and `logs.rating`
   * only exists for games somebody here has already logged — which is almost
   * none of the pool a roll draws from. The masthead already labels the same
   * figure `COMMUNITY`, so the two agree about whose score it is.
   */
  minRating?: number | null;
};

/**
 * How many games one request brings back.
 *
 * This is the number that decides the feature's API cost. The screen keeps the
 * batch and walks a cursor through it, so "Another game" is fifty presses of
 * free before a second request is needed. IGDB's own ceiling is 500, but a
 * larger batch is dead weight — nobody rerolls fifty times, and the unused rows
 * are paid for in latency on the roll that matters, the first one.
 */
const SURPRISE_BATCH = 50;

/**
 * The furthest into a sorted result set a roll will reach.
 *
 * `offset` is not used anywhere else in this codebase and IGDB's own behaviour
 * at large offsets is documented only as "degrades", so this stays well short
 * of anywhere interesting happens. `SURPRISE_BATCH` is subtracted so
 * `offset + limit` never crosses 5000.
 */
const MAX_OFFSET = 5000 - SURPRISE_BATCH;

/**
 * The same ceiling, for a roll that carries filters.
 *
 * An unfiltered pool is tens of thousands of rows deep and a random offset
 * anywhere in the first 5,000 lands on something. One genre plus a rating floor
 * can be a few hundred rows in total, and at that size the *usual* outcome of a
 * 5,000-deep offset is an empty page — the retry at `offset 0` then serves the
 * top of the list, so "completely random with two boxes ticked" would quietly
 * become "the same forty games, every time".
 *
 * 450 keeps the offset inside the range a narrow filter plausibly has, and a
 * pool smaller than that still falls back to its own first page, which for a
 * pool that small genuinely is a fine answer.
 */
const FILTERED_MAX_OFFSET = 450;

/**
 * Orderings for the `random` pool.
 *
 * A single fixed sort plus a capped offset can only ever reach the first
 * `MAX_OFFSET` games of one ordering — the same ~5,000 rows, roll after roll,
 * which would make "Completely random" a claim the code does not honour.
 * Choosing the ordering at random too multiplies the reachable window by eight
 * for the cost of an array. `id` is included because it is effectively catalogue
 * insertion order, which correlates with nothing a player would notice — the
 * most genuinely arbitrary axis available.
 */
const RANDOM_SORTS = [
  'id asc',
  'id desc',
  'first_release_date asc',
  'first_release_date desc',
  'total_rating_count asc',
  'total_rating_count desc',
  'total_rating asc',
  'total_rating desc',
] as const;

function randomInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

function pickOne<T>(values: readonly T[]): T {
  return values[randomInt(values.length)];
}

/**
 * A batch of candidate games for one Surprise Me roll.
 *
 * ## Why three pools rather than one query with knobs
 *
 * "Popular", "hidden gem" and "random" are not three intensities of the same
 * filter — they are three different questions, and each one needs a different
 * `sort` as well as a different `where`. Hidden gems in particular cannot be
 * expressed as "popular, but less": the defining trait is a *high rating from
 * few raters*, which is a ratio, and reversing the popular sort just returns
 * the games nobody rated because they are bad.
 *
 * ## The shared floor
 *
 * Every pool requires `cover != null` (the whole interface is box art, and a
 * lettered placeholder is not a discovery) and `version_parent = null`, so a
 * roll lands on Dark Souls rather than on Dark Souls: Prepare to Die Edition.
 * `searchGamesFiltered` applies the same two for the same reasons.
 *
 * ## Randomness
 *
 * IGDB has no `sort random`, so the randomness is a random `offset` into a
 * sorted set — plus, for the `random` pool, a random ordering to sort by. An
 * empty response means the offset landed past the end of that pool; the one
 * retry at `offset 0` is there because a pool small enough for that to happen
 * is small enough that the first page is a fine answer.
 *
 * ## Filters sit on top of the pool, not beside it
 *
 * `filters` adds `where` clauses and changes nothing else — not the sort, not
 * the batch size, not the retry. A pool is a slice of the catalogue and a filter
 * is a property of a game, so they compose: "hidden gem" keeps its rating
 * ceiling and its rating-descending sort whether or not a genre is also named.
 * The one thing they do change is how deep the random offset may reach; see
 * `FILTERED_MAX_OFFSET`.
 */
export async function getSurprisePool(
  pool: SurprisePool,
  filters: SurprisePoolFilters = {},
  signal?: AbortSignal
): Promise<GameSearchResult[]> {
  const where = ['cover != null', 'version_parent = null'];
  let sort: string;

  if (pool === 'popular') {
    // Two hundred ratings is roughly "a game people have heard of". Sorting by
    // the count rather than the score is deliberate: this pool answers "famous",
    // and the best-*reviewed* games are a different, much narrower list.
    where.push('total_rating_count >= 200');
    sort = 'total_rating_count desc';
  } else if (pool === 'hidden') {
    // Well liked, by few. The upper bound is what makes it a hidden gem rather
    // than a good game; the lower bound is what keeps it from being an accident
    // of three friends rating their mate's jam entry.
    where.push('total_rating >= 75', 'total_rating_count >= 8', 'total_rating_count <= 60');
    sort = 'total_rating desc';
  } else {
    // The same shovelware floor `searchGamesFiltered` uses on its filters-only
    // path. Without it "random" mostly returns store listings nobody has played.
    where.push('total_rating_count >= 5');
    sort = pickOne(RANDOM_SORTS);
  }

  /*
   * `(…)` is "has any of these", which is the reading that widens as you tick
   * more boxes. See `SurprisePoolFilters.genreIds` for why the alternative is
   * a dead end rather than a preference.
   */
  const genreIds = filters.genreIds ?? [];
  const perspectiveIds = filters.perspectiveIds ?? [];
  if (genreIds.length > 0) where.push(`genres = (${genreIds.join(',')})`);
  if (perspectiveIds.length > 0) {
    where.push(`player_perspectives = (${perspectiveIds.join(',')})`);
  }
  /*
   * `> 0` rather than `!= null`: zero is the "no minimum" value the picker
   * writes, and a `total_rating >= 0` clause is not harmless — it silently drops
   * every unrated game, which is most of the catalogue and exactly what the
   * "Any" option promises to keep.
   */
  if (filters.minRating != null && filters.minRating > 0) {
    where.push(`total_rating >= ${Math.round(filters.minRating)}`);
  }

  const filtered = genreIds.length > 0 || perspectiveIds.length > 0 || !!filters.minRating;
  const clause = `where ${where.join(' & ')};`;

  async function fetchAt(offset: number): Promise<GameSearchResult[]> {
    const body = `${GAME_FIELDS} ${clause} sort ${sort}; limit ${SURPRISE_BATCH}; offset ${offset};`;
    const raw = await igdbQuery<IgdbGame[]>('games', body, signal);
    return (raw ?? []).map(toGame).map(toSearchResult);
  }

  const offset = randomInt(filtered ? FILTERED_MAX_OFFSET : MAX_OFFSET);
  const games = await fetchAt(offset);
  if (games.length > 0 || offset === 0) return games;

  return fetchAt(0);
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

// ---------------------------------------------------------------------------
// Time to beat
// ---------------------------------------------------------------------------

/**
 * How long a game takes, in seconds, from IGDB's own aggregation.
 *
 * Three lengths and the number of submissions behind them. `count` is not
 * decoration: a "55 hours to complete" drawn from two people is a different
 * claim from one drawn from four hundred, and the widget prints it for exactly
 * that reason.
 */
export type TimeToBeat = {
  /** Straight through, skipping what can be skipped. */
  hastily: number | null;
  /** The way most people play it. */
  normally: number | null;
  /** Everything. */
  completely: number | null;
  /** How many players submitted times. */
  count: number;
};

type IgdbTimeToBeat = {
  game_id?: number;
  hastily?: number;
  normally?: number;
  completely?: number;
  count?: number;
};

/**
 * IGDB's `game_time_to_beat` endpoint.
 *
 * A separate endpoint keyed by `game_id`, not a field on `games` — it cannot be
 * folded into `GAME_FIELDS` and has to be its own request.
 *
 * **Seconds, not hours.** The API returns raw seconds and the widget divides;
 * treating them as minutes (the obvious guess) puts every game at sixty times
 * its real length, which reads as plausible for a long RPG and is the kind of
 * wrong that ships.
 *
 * Returns null rather than zeroes when IGDB has nothing, so the caller can drop
 * the section instead of drawing "0 H" three times.
 */
export async function getTimeToBeat(
  sourceId: string,
  signal?: AbortSignal
): Promise<TimeToBeat | null> {
  const numeric = Number(sourceId);
  if (!Number.isFinite(numeric)) return null;

  const raw = await igdbQuery<IgdbTimeToBeat[]>(
    'game_time_to_beat',
    `fields hastily, normally, completely, count;
     where game_id = ${numeric};
     limit 1;`,
    signal
  );

  const first = raw?.[0];
  if (!first) return null;

  const value = {
    hastily: first.hastily ?? null,
    normally: first.normally ?? null,
    completely: first.completely ?? null,
    count: first.count ?? 0,
  };

  // Every length missing is the same as no record at all.
  if (value.hastily === null && value.normally === null && value.completely === null) return null;
  return value;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/** A showcase, conference or award show a game appeared at. */
export type GameEvent = {
  id: number;
  name: string;
  /** Unix seconds. Null for an event with no announced date. */
  startTime: number | null;
  description: string | null;
  /** Landscape key art for the event itself, not for the game. */
  logoUrl: string | null;
  /** The event's own page, when it publishes one. */
  liveStreamUrl: string | null;
};

type IgdbEvent = {
  id: number;
  name?: string;
  start_time?: number;
  description?: string;
  event_logo?: IgdbImage;
  live_stream_url?: string;
  event_networks?: { url?: string }[];
};

/**
 * A YouTube thumbnail for a watch/live/short URL, or null.
 *
 * **This is the fallback that makes the events widget worth having.** IGDB's
 * `event_logo` is populated for a minority of events — the big publisher
 * showcases have one and almost nothing else does — so a widget that only read
 * that field rendered a column of blank cards for most games that had any events
 * at all.
 *
 * Every event that streamed has a URL, and in practice that URL is YouTube.
 * `img.youtube.com/vi/<id>/hqdefault.jpg` is a static path with no API, no key
 * and no quota, and it exists for every public video — so the stream link the
 * event already carries is also a picture of it.
 *
 * `hqdefault` rather than `maxresdefault`: the latter 404s for any video not
 * uploaded at 1080p or above, which includes most streams from before ~2016,
 * and a 404 here would put us back at the blank card. 480×360 is more than a
 * card this size needs.
 */
export function youtubeThumbnail(url: string | null | undefined): string | null {
  if (!url) return null;

  // youtu.be/<id>, /watch?v=<id>, /live/<id>, /embed/<id>, /shorts/<id>
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|live\/|embed\/|shorts\/))([\w-]{11})/
  );
  if (!match) return null;
  return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
}

/**
 * Every event a game was featured in, most recent first.
 *
 * Queried from the `events` endpoint filtered on its `games` array rather than
 * from the game — `games` is a many-to-many and IGDB exposes the join only in
 * this direction, so there is no `game.events` field to add to `GAME_FIELDS`.
 *
 * Most games have none, which is the point: an appearance at The Game Awards or
 * a Nintendo Direct is a fact about the game's life that no other section of the
 * page carries, and it is worth a widget precisely because it is rare.
 */
export async function getGameEvents(sourceId: string, signal?: AbortSignal): Promise<GameEvent[]> {
  const numeric = Number(sourceId);
  if (!Number.isFinite(numeric)) return [];

  /*
   * Two attempts, richest first.
   *
   * IGDB rejects an *entire* query when one field expansion is not valid for the
   * endpoint, so a single bad name here costs every event rather than one field
   * of them — and the failure surfaces as an empty widget with nothing to say
   * why. The narrow retry is the field set `lib/news/discovery.ts` has been
   * running against this endpoint all along, so it is known-good: worst case the
   * section renders without artwork instead of not rendering at all.
   */
  const raw = await igdbQuery<IgdbEvent[]>(
    'events',
    `fields name, start_time, description, event_logo.image_id, live_stream_url,
            event_networks.url;
     where games = (${numeric});
     sort start_time desc;
     limit 10;`,
    signal
  ).catch(() =>
    igdbQuery<IgdbEvent[]>(
      'events',
      `fields name, start_time, description, live_stream_url;
       where games = (${numeric});
       sort start_time desc;
       limit 10;`,
      signal
    ).catch(() => [] as IgdbEvent[])
  );

  return (raw ?? [])
    .filter((entry) => !!entry.name)
    .map((entry) => ({
      id: entry.id,
      name: entry.name!,
      startTime: entry.start_time ?? null,
      description: entry.description ?? null,
      /* IGDB's own art first, then a frame of the stream it links to. Both can
         be null, and the widget draws a lettered placeholder when they are —
         but between the two, most events now have a picture. */
      logoUrl:
        imageUrl(entry.event_logo, 'screenshot_med') ??
        youtubeThumbnail(entry.live_stream_url) ??
        youtubeThumbnail(entry.event_networks?.[0]?.url),
      liveStreamUrl: entry.live_stream_url ?? entry.event_networks?.[0]?.url ?? null,
    }));
}

// ---------------------------------------------------------------------------
// The full detail sheet
// ---------------------------------------------------------------------------

/** One age rating, already resolved to a readable organisation and grade. */
export type AgeRating = {
  /** "ESRB", "PEGI", "USK"… */
  organization: string;
  /** "M", "18", "Teen"… */
  rating: string;
};

/**
 * Everything the "More information" sheet prints.
 *
 * All of it is IGDB-only and none of it belongs on the shared `Game` shape —
 * `Game` is the cross-provider contract and hanging fifteen nullable IGDB fields
 * off it to serve one sheet would make every Steam and RAWG row carry them too.
 */
export type GameDetails = {
  developers: string[];
  publishers: string[];
  genres: string[];
  themes: string[];
  gameModes: string[];
  playerPerspectives: string[];
  /** IGDB's `collection` — the numbered series. */
  series: string | null;
  franchises: string[];
  engines: string[];
  ageRatings: AgeRating[];
  /** Languages with any support at all, deduped and sorted. */
  languages: string[];
};

type IgdbNamed = { id?: number; name?: string };

type IgdbDetails = {
  involved_companies?: { developer?: boolean; publisher?: boolean; company?: IgdbNamed }[];
  genres?: IgdbNamed[];
  themes?: IgdbNamed[];
  game_modes?: IgdbNamed[];
  player_perspectives?: IgdbNamed[];
  collection?: IgdbNamed;
  franchises?: IgdbNamed[];
  game_engines?: IgdbNamed[];
  age_ratings?: {
    organization?: { name?: string };
    rating_category?: { rating?: string };
  }[];
  language_supports?: { language?: { name?: string } }[];
};

/** Unique, non-empty names, in the order IGDB returned them. */
function namesOf(list: IgdbNamed[] | undefined): string[] {
  const out: string[] = [];
  for (const entry of list ?? []) {
    const name = entry.name?.trim();
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

/**
 * One request for everything the detail sheet shows.
 *
 * Deliberately one query rather than six: these are all fields on `games`, and
 * the sheet opens as a unit, so splitting them would be six round trips to fill
 * one panel.
 *
 * **`age_ratings` and `language_supports` are the two that changed shape.** IGDB
 * moved both from integer enums to referenced rows — `rating_category.rating`
 * and `organization.name` replace the old numeric `category`/`rating` pair, and
 * a client still mapping those integers gets nothing back rather than an error.
 * Expanding the references is what makes them readable without a lookup table
 * this app would then have to keep in sync.
 */
export async function getGameDetails(
  sourceId: string,
  signal?: AbortSignal
): Promise<GameDetails | null> {
  const numeric = Number(sourceId);
  if (!Number.isFinite(numeric)) return null;

  const raw = await igdbQuery<IgdbDetails[]>(
    'games',
    `fields involved_companies.developer, involved_companies.publisher,
            involved_companies.company.name,
            genres.name, themes.name, game_modes.name, player_perspectives.name,
            collection.name, franchises.name, game_engines.name,
            age_ratings.organization.name, age_ratings.rating_category.rating,
            language_supports.language.name;
     where id = ${numeric};
     limit 1;`,
    signal
  );

  const first = raw?.[0];
  if (!first) return null;

  const developers: string[] = [];
  const publishers: string[] = [];
  for (const entry of first.involved_companies ?? []) {
    const name = entry.company?.name?.trim();
    if (!name) continue;
    // A company can be both, and both credits are worth printing.
    if (entry.developer && !developers.includes(name)) developers.push(name);
    if (entry.publisher && !publishers.includes(name)) publishers.push(name);
  }

  const ageRatings: AgeRating[] = [];
  for (const entry of first.age_ratings ?? []) {
    const organization = entry.organization?.name?.trim();
    const rating = entry.rating_category?.rating?.trim();
    if (!organization || !rating) continue;
    if (ageRatings.some((existing) => existing.organization === organization)) continue;
    ageRatings.push({ organization, rating });
  }

  const languages: string[] = [];
  for (const entry of first.language_supports ?? []) {
    const name = entry.language?.name?.trim();
    // One row per language *per support type* — audio, subtitles, interface —
    // so the same language arrives up to three times.
    if (name && !languages.includes(name)) languages.push(name);
  }
  languages.sort((a, b) => a.localeCompare(b));

  return {
    developers,
    publishers,
    genres: namesOf(first.genres),
    themes: namesOf(first.themes),
    gameModes: namesOf(first.game_modes),
    playerPerspectives: namesOf(first.player_perspectives),
    series: first.collection?.name?.trim() ?? null,
    franchises: namesOf(first.franchises),
    engines: namesOf(first.game_engines),
    ageRatings,
    languages,
  };
}
