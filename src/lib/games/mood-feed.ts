import { getGamesWhere, igdbQuery } from './igdb';
import {
  SHELF_FETCH,
  STUDIO_MIN_GAMES,
  atClock,
  distinctShelves,
  moodStudio,
  moodWhere,
  quickPicksWhere,
  shelfSort,
  shelfWhere,
  type CreditRow,
  type HomeFeed,
} from './moods';
import type { Game } from './types';

/**
 * A feed — a mood or a genre — from IGDB: its shelves, its Quick picks and its
 * studio, the three things SimpMusic's Home draws for a mood, from the clauses
 * in `moods.ts` and `genre-feed.ts`. Every request goes through the `igdb`
 * Edge Function.
 *
 * ## Paced
 *
 * A mood is about nine requests (a shelf each, Quick picks, three for its
 * studio), and IGDB answers more than four a second with 429 — for the whole
 * app, whose credentials every phone shares. So this module starts its requests
 * at least `GAP_MS` apart, in the order they were asked for: the lead shelf
 * first, which is what the page's glow is taken from.
 */
const GAP_MS = 270;

let nextStart = 0;

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error('Aborted'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, ms);
    const abort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new Error('Aborted'));
    };
    signal?.addEventListener('abort', abort, { once: true });
  });
}

/** Run `request` no sooner than `GAP_MS` after the last one this module started. */
async function paced<T>(request: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  const now = Date.now();
  const at = Math.max(now, nextStart);
  nextStart = at + GAP_MS;
  if (at > now) await wait(at - now, signal);
  return request();
}

/**
 * Every shelf of a mood, each without a game a shelf above it shows, in the
 * mood's order. A shelf that failed or came back short is empty; the page
 * draws nothing for it. Fails only when every shelf did.
 */
export async function getMoodShelves(feed: HomeFeed, signal?: AbortSignal): Promise<Game[][]> {
  /* The clock, read as the request is made: "New releases" is the last 120 days. */
  const now = Date.now() / 1000;
  const settled = await Promise.allSettled(
    feed.shelves.map((shelf) =>
      paced(
        () => getGamesWhere(atClock(shelfWhere(shelf), now), SHELF_FETCH, signal, shelfSort(shelf)),
        signal
      )
    )
  );
  if (settled.every((result) => result.status === 'rejected')) {
    throw (settled[0] as PromiseRejectedResult).reason;
  }
  return distinctShelves(
    settled.map((result) => (result.status === 'fulfilled' ? result.value : []))
  );
}

/**
 * One cover for a feed's tile at the foot of Home — SimpMusic's
 * `loadMoodArtwork`, which browses a mood category for one playlist's artwork
 * because its own category list carries none.
 *
 * The smallest request in this module: the feed's whole pool, its most-rated
 * game, one field. It is `t_cover_small` because the slot is a 64dp square
 * turned 25° — a 90×128 file is already more pixels than that uses, and twenty
 * tiles of `t_cover_big` would be half a megabyte to decorate a grid.
 *
 * Paced with everything else here, so a tile's cover never delays the shelf
 * somebody is looking at; `null` where IGDB has nothing, which the tile is
 * built to look finished without.
 */
export async function getFeedArtwork(feed: HomeFeed, signal?: AbortSignal): Promise<string | null> {
  const now = Date.now() / 1000;
  const rows = await paced(
    () =>
      igdbQuery<{ cover?: { image_id?: string } }[]>(
        'games',
        `fields cover.image_id;
         where ${atClock(moodWhere(feed), now)};
         sort total_rating_count desc;
         limit 1;`,
        signal
      ),
    signal
  );
  const image = rows?.[0]?.cover?.image_id;
  return image ? `https://images.igdb.com/igdb/image/upload/t_cover_small/${image}.jpg` : null;
}

/** How many Quick picks are asked for, so twenty are left once the logged ones go. */
const QUICK_PICKS_FETCH = 40;

/**
 * The mood's best-scored games, from any of its shelves — Quick picks before
 * this person's own logs are taken out (`quickPicksFor`, on the screen, where
 * the logs are).
 */
export function getMoodQuickPicks(feed: HomeFeed, signal?: AbortSignal): Promise<Game[]> {
  return paced(
    () => getGamesWhere(quickPicksWhere(feed), QUICK_PICKS_FETCH, signal, 'total_rating desc'),
    signal
  );
}

/** The mood's studio: a name, its logo, and the games of the mood it made. */
export type MoodStudio = {
  id: number;
  name: string;
  logoUrl: string | null;
  games: Game[];
};

/** How far down a mood's most-rated games the studio is counted. */
const STUDIO_POOL = 150;
/** How many of the studio's games its shelf shows. */
const STUDIO_SHELF = 10;

/**
 * The studio that made the most of a mood's games — the shelf YouTube heads
 * with an artist's round picture, here a studio's logo and name.
 *
 * Three requests, each small: the credits of the mood's 150 most-rated games
 * (ids only), the winner's name and logo, then its games among them as whole
 * records. The studio page's own rule holds — never `games where
 * involved_companies.company = X`, which is seconds slower than asking by id.
 * Null when no studio made `STUDIO_MIN_GAMES` of them.
 */
export async function getMoodStudio(
  feed: HomeFeed,
  signal?: AbortSignal
): Promise<MoodStudio | null> {
  const credits = await paced(
    () =>
      igdbQuery<CreditRow[]>(
        'games',
        `fields involved_companies.developer, involved_companies.company;
         where ${moodWhere(feed)};
         sort total_rating_count desc;
         limit ${STUDIO_POOL};`,
        signal
      ),
    signal
  );
  const pick = moodStudio(credits ?? []);
  if (!pick) return null;

  const [company] =
    (await paced(
      () =>
        igdbQuery<{ id: number; name?: string; logo?: { image_id?: string } }[]>(
          'companies',
          `fields name, logo.image_id; where id = ${pick.companyId}; limit 1;`,
          signal
        ),
      signal
    )) ?? [];
  if (!company?.name) return null;

  const games = await paced(
    () => getGamesWhere(`id = (${pick.gameIds.join(',')})`, pick.gameIds.length, signal),
    signal
  );
  const [shelf] = distinctShelves([games], STUDIO_SHELF, STUDIO_MIN_GAMES);
  if (shelf.length === 0) return null;

  const logo = company.logo?.image_id;
  return {
    id: company.id,
    name: company.name,
    /* `.png`, `t_logo_med`: IGDB flattens a logo's alpha to black in a JPEG
       (CLAUDE.md § Search). */
    logoUrl: logo ? `https://images.igdb.com/igdb/image/upload/t_logo_med/${logo}.png` : null,
    games: shelf,
  };
}
