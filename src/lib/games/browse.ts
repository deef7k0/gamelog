import { makeGameId, type GameSearchResult } from './types';
import { igdbQuery, youtubeThumbnail } from './igdb';
import { precisionOf, monthStart, type CalendarGame } from './calendar';
import { COUNT_BATCH, PAGE_SIZE, countByProbing } from './paging';
import { LITE_FIELDS, toSearchResult, type IgdbGameLite } from '../news/discovery';

/**
 * The parts of IGDB's catalogue that are browsed rather than searched for by
 * title: the platform directory and a platform's games, page by page; studios
 * by name; events; and a year of releases.
 *
 * Everything goes through the `igdb` Edge Function like the rest of the
 * catalogue, and — with one exception, `games/count` — through endpoints that
 * function already allows, so none of it waits on a redeploy. Verified against
 * the deployed function:
 *
 *  - `search` is accepted by five endpoints only (characters, collections,
 *    games, platforms, themes). Companies and events answer a 400 to it, so
 *    both are matched with `name ~ *"…"*`, which is a case-insensitive
 *    substring and comes back **unranked**.
 *  - `platforms.category` is gone — it is `platform_type` now, and a `where` on
 *    the old name matches nothing rather than failing.
 *  - `offset` holds at least to 250,000, at about the same latency as 0.
 *
 * Not re-exported from `lib/games/index.ts`: this imports the News tab's lite
 * game mapper, which imports that index.
 */

/** Escapes a value for an APIcalypse string literal. */
function quote(value: string): string {
  return value.trim().replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * An IGDB image at a named size.
 *
 * `png` for a logo: most are drawn on a transparent ground, and IGDB flattens
 * that to black in a JPEG.
 */
function imageUrl(imageId: string | undefined, size: string, format: 'jpg' | 'png' = 'jpg') {
  return imageId
    ? `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.${format}`
    : null;
}

// ---------------------------------------------------------------------------
// Platforms
// ---------------------------------------------------------------------------

/** IGDB's `platform_type` ids, as the word a reader would use. */
const PLATFORM_KIND: Record<number, string> = {
  1: 'Console',
  2: 'Arcade',
  3: 'Platform',
  4: 'Operating system',
  5: 'Handheld',
  6: 'Computer',
};

export type PlatformEntry = {
  id: number;
  name: string;
  abbreviation: string | null;
  /** "Console", "Handheld", "Computer"… or null when IGDB does not say. */
  kind: string | null;
  /** Hardware generation, 1-9, where there is one. */
  generation: number | null;
  /** The vendor line — "PlayStation", "Nintendo" — where IGDB groups it. */
  family: string | null;
  /** The platform's logo, usually dark ink on a transparent ground. */
  logoUrl: string | null;
  /**
   * The year it first went on sale anywhere, or null: the earliest of its
   * versions' release dates. About 155 of the 220 have one.
   */
  year: number | null;
};

type IgdbPlatform = {
  id: number;
  name?: string;
  abbreviation?: string;
  generation?: number;
  platform_type?: number;
  platform_family?: { name?: string };
  platform_logo?: { image_id?: string };
  versions?: { platform_version_release_dates?: { y?: number }[] }[];
};

/** The earliest year any version of a platform was released, or null. */
function firstYear(entry: IgdbPlatform): number | null {
  let first: number | null = null;
  for (const version of entry.versions ?? []) {
    for (const release of version.platform_version_release_dates ?? []) {
      if (release.y && (first === null || release.y < first)) first = release.y;
    }
  }
  return first;
}

/**
 * Every platform IGDB lists, A to Z, with its logo and the year it came out.
 *
 * About 220 rows, in one request: IGDB adds a platform every year or two, so
 * the caller keeps this for the session and filters it in memory — a search
 * field over 220 names has no need of the network.
 *
 * **The year, and not how many games it has.** A tile's second line is the
 * year because that rides along in this one request (a platform's versions and
 * their release dates expand in place). A count is `games/count` once per
 * platform: 220 requests to fill a directory, against IGDB's four a second —
 * a limit the `igdb` function shares between every user of the app.
 */
export async function getPlatformDirectory(signal?: AbortSignal): Promise<PlatformEntry[]> {
  const raw = await igdbQuery<IgdbPlatform[]>(
    'platforms',
    `fields name, abbreviation, generation, platform_type, platform_family.name,
            platform_logo.image_id, versions.platform_version_release_dates.y;
     sort name asc;
     limit 500;`,
    signal
  );

  return (raw ?? [])
    .filter((entry) => !!entry.name)
    .map((entry) => ({
      id: entry.id,
      name: entry.name!,
      abbreviation: entry.abbreviation?.trim() || null,
      kind: entry.platform_type ? (PLATFORM_KIND[entry.platform_type] ?? null) : null,
      generation: entry.generation ?? null,
      family: entry.platform_family?.name ?? null,
      logoUrl: imageUrl(entry.platform_logo?.image_id, 'logo_med', 'png'),
      year: firstYear(entry),
    }));
}

/**
 * The platforms most people are looking for, in the order they are looked for.
 *
 * IGDB has no popularity figure for a platform, and `generation` cannot stand
 * in for one: it would lead with the Playdate and the Meta Quest 3 and bury the
 * PC, which has no generation at all. So the head of the directory is chosen by
 * hand; everything else follows A to Z. Ids are IGDB's, read from the live API.
 */
export const FEATURED_PLATFORM_IDS: readonly number[] = [
  6, // PC (Microsoft Windows)
  167, // PlayStation 5
  169, // Xbox Series X|S
  508, // Nintendo Switch 2
  130, // Nintendo Switch
  48, // PlayStation 4
  49, // Xbox One
  39, // iOS
  34, // Android
];

/** How a platform's games are ordered — and, for some, which of them. */
export type PlatformSort = 'popular' | 'rating' | 'newest' | 'upcoming' | 'oldest' | 'title';

/**
 * The games that count as "a game on this platform".
 *
 * Repackages are out (`version_parent = null`), as everywhere else in the app,
 * and so are the release types that are not a game on their own — DLC, bundles,
 * mods, episodes, seasons, packs and updates. Main games, standalone
 * expansions, remakes, remasters, expanded games and ports stay.
 */
const PLATFORM_GAMES = 'version_parent = null & game_type = (0,4,8,9,10,11)';

/**
 * "Top rated" needs this many ratings behind a score.
 *
 * Without a floor the top of every platform is a page of games rated 100 by one
 * person. Ten is low enough to keep a small platform's catalogue and high enough
 * to stop a single vote from ranking.
 */
const RATED_FLOOR = 10;

/**
 * Today, as a Unix second that only moves once a day.
 *
 * The "newest" and "upcoming" clauses compare against now, and the clause is
 * part of the query key and of the count — a value that changed every second
 * would make each page a different query from the one before it.
 */
function today(): number {
  return Math.floor(Date.now() / 86_400_000) * 86_400;
}

/** The `where` and `sort` one ordering resolves to. Built once, read twice. */
function platformQuery(platformId: number, sort: PlatformSort): { where: string; sort: string } {
  const base = `platforms = (${platformId}) & ${PLATFORM_GAMES}`;

  switch (sort) {
    case 'rating':
      return {
        where: `${base} & total_rating_count >= ${RATED_FLOOR}`,
        sort: 'total_rating desc',
      };
    case 'newest':
      /* Released, newest first. Unbounded, "newest" opens on a page of
         placeholder dates years away. */
      return {
        where: `${base} & first_release_date <= ${today()}`,
        sort: 'first_release_date desc',
      };
    case 'upcoming':
      return {
        where: `${base} & first_release_date > ${today()}`,
        sort: 'first_release_date asc',
      };
    case 'oldest':
      return { where: `${base} & first_release_date != null`, sort: 'first_release_date asc' };
    case 'title':
      return { where: base, sort: 'name asc' };
    default:
      /* How many people rated it, which is the nearest thing the catalogue has
         to "how well known". Unrated games follow, so the last pages are the
         long tail rather than missing. */
      return { where: base, sort: 'total_rating_count desc' };
  }
}

/**
 * What the count is filed under: the clause, since several orderings share one.
 * A query key for the caller, so two orderings of the same set count once.
 */
export function platformCountKey(platformId: number, sort: PlatformSort): string {
  return platformQuery(platformId, sort).where;
}

/** One page — `PAGE_SIZE` games — of a platform's catalogue. `page` is 1-based. */
export async function getPlatformGamesPage(
  platformId: number,
  sort: PlatformSort,
  page: number,
  signal?: AbortSignal
): Promise<GameSearchResult[]> {
  const query = platformQuery(platformId, sort);
  const offset = Math.max(0, page - 1) * PAGE_SIZE;

  const raw = await igdbQuery<IgdbGameLite[]>(
    'games',
    `${LITE_FIELDS}
     where ${query.where};
     sort ${query.sort};
     limit ${PAGE_SIZE};
     offset ${offset};`,
    signal
  );
  return (raw ?? []).map(toSearchResult);
}

/**
 * How many games a `where` clause matches.
 *
 * ## Two ways to ask, and why both exist
 *
 * IGDB publishes `/games/count` — one integer, exact. It is on the Edge
 * Function's allowlist in source, and **an allowlist entry does nothing until
 * the function is redeployed** (CLAUDE.md § Gotchas has the two times that has
 * already cost a feature). So the count endpoint is tried first, and when the
 * deployed function refuses it the same answer is worked out through `games`,
 * which has always been allowed: `fields id` windows, doubling and then halving
 * the offset (`countByProbing`). That is exact too; it is just a dozen small
 * requests for ten thousand games where the endpoint is one.
 *
 * `allowed` remembers a refusal for the session, so one platform's page pays
 * for finding out and the rest go straight to probing.
 */
let countEndpointAllowed = true;

async function countGames(where: string, signal?: AbortSignal): Promise<number> {
  if (countEndpointAllowed) {
    try {
      const answer = await igdbQuery<{ count?: number }>('games/count', `where ${where};`, signal);
      if (typeof answer?.count === 'number') return answer.count;
    } catch (error) {
      if (signal?.aborted) throw error;
      /* Refused, or failed some other way: either way the probe below can
         still answer, and a refusal will not change until the next deploy. */
      countEndpointAllowed = false;
    }
  }

  return countByProbing(
    async (limit, offset) => {
      const rows = await igdbQuery<{ id: number }[]>(
        'games',
        `fields id; where ${where}; limit ${limit}; offset ${offset};`,
        signal
      );
      return (rows ?? []).length;
    },
    { batch: COUNT_BATCH }
  );
}

/** How many games a platform's page lists, under one ordering. */
export function getPlatformGameCount(
  platformId: number,
  sort: PlatformSort,
  signal?: AbortSignal
): Promise<number> {
  return countGames(platformQuery(platformId, sort).where, signal);
}

// ---------------------------------------------------------------------------
// Studios
// ---------------------------------------------------------------------------

export type StudioResult = {
  id: number;
  name: string;
  logoUrl: string | null;
  /** Games it developed or published, which is also what it is ranked by. */
  gameCount: number;
};

type IgdbCompanyHit = {
  id: number;
  name?: string;
  logo?: { image_id?: string };
  developed?: number[];
  published?: number[];
};

/** How many companies one search weighs. */
const STUDIO_CANDIDATES = 50;
const STUDIO_RESULTS = 25;

/**
 * Studios by name.
 *
 * IGDB will not `search` companies, and a `name ~ *"…"*` match comes back in no
 * useful order — "naughty" returned eight companies before Naughty Dog. So the
 * ranking is done here, on the one signal the response carries: how many games
 * the company made. An exact name leads, then names that start with the term,
 * and inside each of those the bigger catalogue wins.
 *
 * Two things in the query make that work with only fifty candidates. Companies
 * with no games at all are dropped (IGDB lists thousands of empty shells), and
 * the candidates are taken **lowest id first**: ids are the order companies were
 * added, and the ones anybody is looking for were added long ago. "games"
 * matches thousands of companies; the fifty oldest are Rockstar, Epic and 2K.
 */
export async function searchStudios(term: string, signal?: AbortSignal): Promise<StudioResult[]> {
  const trimmed = term.trim();
  if (!trimmed) return [];

  const raw = await igdbQuery<IgdbCompanyHit[]>(
    'companies',
    `fields name, logo.image_id, developed, published;
     where name ~ *"${quote(trimmed)}"* & (developed != null | published != null);
     sort id asc;
     limit ${STUDIO_CANDIDATES};`,
    signal
  );

  const needle = trimmed.toLowerCase();
  const rank = (name: string) => {
    const lowered = name.toLowerCase();
    if (lowered === needle) return 0;
    if (lowered.startsWith(needle)) return 1;
    return 2;
  };

  return (raw ?? [])
    .filter((entry) => !!entry.name)
    .map((entry) => ({
      id: entry.id,
      name: entry.name!,
      logoUrl: imageUrl(entry.logo?.image_id, 'logo_med', 'png'),
      gameCount: new Set([...(entry.developed ?? []), ...(entry.published ?? [])]).size,
    }))
    .sort(
      (a, b) =>
        rank(a.name) - rank(b.name) || b.gameCount - a.gameCount || a.name.localeCompare(b.name)
    )
    .slice(0, STUDIO_RESULTS);
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type EventSummary = {
  id: number;
  name: string;
  /** Unix seconds, or null for an event with no announced date. */
  startTime: number | null;
  /** 16:9 key art for the event, or a frame of its stream, or null. */
  thumbnailUrl: string | null;
  liveStreamUrl: string | null;
  /** How many games were shown at it. */
  gameCount: number;
};

type IgdbEventRow = {
  id: number;
  name?: string;
  description?: string;
  start_time?: number;
  end_time?: number;
  event_logo?: { image_id?: string };
  live_stream_url?: string;
  event_networks?: { url?: string; network_type?: { name?: string } }[];
  games?: number[];
};

const EVENT_FIELDS =
  'fields name, start_time, event_logo.image_id, live_stream_url, event_networks.url, games;';

/**
 * An event's picture: IGDB's own art, else a frame of the stream it links to.
 *
 * Nearly every event carries an `event_logo` now — the live API returned one
 * for all 500 it would list — so the YouTube frame is a second rung for the
 * stragglers rather than the main supply it was when the game page's
 * "Featured in" rail was written.
 */
function eventThumbnail(row: IgdbEventRow, size: string): string | null {
  return (
    imageUrl(row.event_logo?.image_id, size) ??
    youtubeThumbnail(row.live_stream_url) ??
    youtubeThumbnail(row.event_networks?.find((entry) => youtubeThumbnail(entry.url))?.url)
  );
}

function toEventSummary(row: IgdbEventRow): EventSummary {
  return {
    id: row.id,
    name: row.name ?? 'Untitled event',
    startTime: row.start_time ?? null,
    /* 569×320: a row's thumbnail is ~120dp wide, 360px on a 3× phone. */
    thumbnailUrl: eventThumbnail(row, 'screenshot_med'),
    liveStreamUrl: row.live_stream_url ?? null,
    gameCount: row.games?.length ?? 0,
  };
}

/**
 * Showcases, conferences and award shows: the next ones and the latest ones,
 * newest first — or, with a term, the ones whose name holds it.
 *
 * One request either way. Untyped, sixty rows sorted by start reach from the
 * events announced for the coming months back through the last year or so; the
 * caller splits them around today.
 */
export async function getEvents(term: string, signal?: AbortSignal): Promise<EventSummary[]> {
  const trimmed = term.trim();
  const raw = await igdbQuery<IgdbEventRow[]>(
    'events',
    trimmed
      ? `${EVENT_FIELDS} where name ~ *"${quote(trimmed)}"*; sort start_time desc; limit 50;`
      : `${EVENT_FIELDS} sort start_time desc; limit 60;`,
    signal
  );
  return (raw ?? []).filter((row) => !!row.name).map(toEventSummary);
}

export type EventLink = { url: string; label: string };

export type EventDetail = EventSummary & {
  description: string | null;
  endTime: number | null;
  /** The banner at the size a full-width header draws. */
  bannerUrl: string | null;
  /** Where the event lives — its site, its channels. */
  links: EventLink[];
  /** IGDB ids of the games shown, in IGDB's order. */
  gameIds: number[];
};

/** One event, in full. Null when IGDB has no such id. */
export async function getEvent(eventId: number, signal?: AbortSignal): Promise<EventDetail | null> {
  const raw = await igdbQuery<IgdbEventRow[]>(
    'events',
    `fields name, description, start_time, end_time, event_logo.image_id, live_stream_url,
            event_networks.url, event_networks.network_type.name, games;
     where id = ${eventId};
     limit 1;`,
    signal
  );

  const row = raw?.[0];
  if (!row) return null;

  const links: EventLink[] = [];
  for (const entry of row.event_networks ?? []) {
    if (!entry.url || links.some((link) => link.url === entry.url)) continue;
    links.push({ url: entry.url, label: entry.network_type?.name?.trim() || 'Link' });
  }

  return {
    ...toEventSummary(row),
    description: row.description?.trim() || null,
    endTime: row.end_time ?? null,
    bannerUrl: eventThumbnail(row, '720p'),
    links,
    gameIds: row.games ?? [],
  };
}

/** The most games an event's page draws. The Game Awards shows about sixty. */
const EVENT_GAMES = 120;

/** The games shown at an event, in the order IGDB lists them. */
export async function getEventGames(
  gameIds: readonly number[],
  signal?: AbortSignal
): Promise<GameSearchResult[]> {
  const ids = gameIds.slice(0, EVENT_GAMES);
  if (ids.length === 0) return [];

  const raw = await igdbQuery<IgdbGameLite[]>(
    'games',
    `${LITE_FIELDS} where id = (${ids.join(',')}); limit ${ids.length};`,
    signal
  );

  /* `id = (…)` answers in IGDB's own order, not the list's. */
  const order = new Map(ids.map((id, index) => [id, index]));
  return (raw ?? [])
    .slice()
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .map(toSearchResult);
}

// ---------------------------------------------------------------------------
// The release calendar
// ---------------------------------------------------------------------------

type IgdbCalendarGame = {
  id: number;
  name?: string;
  first_release_date?: number;
  hypes?: number;
  total_rating?: number;
  total_rating_count?: number;
  cover?: { image_id?: string };
  release_dates?: { date?: number; date_format?: number }[];
};

const CALENDAR_FIELDS = `fields name, first_release_date, hypes, total_rating, total_rating_count,
         cover.image_id, release_dates.date, release_dates.date_format;`;

/** How many games each of the two rankings contributes to a year. */
const CALENDAR_AWAITED = 300;
const CALENDAR_PLAYED = 200;

/**
 * A year's notable releases, for the calendar.
 *
 * ## Two rankings, merged
 *
 * "The top releases of the year" and "the most anticipated games still to
 * come" are the same list read on either side of today, and IGDB has a number
 * for each side: `hypes` (follows before release) and `total_rating_count`
 * (ratings after). Neither covers the whole year — an unreleased game has no
 * ratings, and a surprise hit had no follows (Palworld: 295 ratings, 1 hype) —
 * so the year is the union of the top of both. A third of the second list is
 * not in the first.
 *
 * Two requests, about 280 KB for a current year, kept by the caller for hours.
 * Most of that is `release_dates`, which is what says whether a date is a day,
 * a month or only a year (`precisionOf`); without it every game known only as
 * "2026" lands on 31 December.
 */
export async function getReleaseCalendar(
  year: number,
  signal?: AbortSignal
): Promise<CalendarGame[]> {
  const window = `first_release_date >= ${monthStart(year, 0)}
       & first_release_date < ${monthStart(year + 1, 0)}
       & cover != null & version_parent = null`;

  const [awaited, played] = await Promise.all([
    igdbQuery<IgdbCalendarGame[]>(
      'games',
      `${CALENDAR_FIELDS} where ${window} & hypes != null;
       sort hypes desc; limit ${CALENDAR_AWAITED};`,
      signal
    ),
    igdbQuery<IgdbCalendarGame[]>(
      'games',
      `${CALENDAR_FIELDS} where ${window} & total_rating_count != null;
       sort total_rating_count desc; limit ${CALENDAR_PLAYED};`,
      signal
    ),
  ]);

  const byId = new Map<number, IgdbCalendarGame>();
  for (const row of [...(awaited ?? []), ...(played ?? [])]) {
    if (row.name && row.first_release_date && !byId.has(row.id)) byId.set(row.id, row);
  }

  return [...byId.values()].map((row) => ({
    id: makeGameId('igdb', row.id),
    title: row.name!,
    coverImageId: row.cover?.image_id ?? null,
    releasedAt: row.first_release_date!,
    precision: precisionOf(row.first_release_date!, row.release_dates),
    hypes: row.hypes ?? 0,
    ratings: row.total_rating_count ?? 0,
    score: typeof row.total_rating === 'number' ? Math.round(row.total_rating) : null,
  }));
}

/** A calendar game's cover at a named IGDB size, or null. */
export function calendarCover(game: Pick<CalendarGame, 'coverImageId'>, size: string) {
  return imageUrl(game.coverImageId ?? undefined, size);
}
