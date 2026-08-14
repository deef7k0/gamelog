import { getSimilarTo } from '@/lib/games';
import type { GameSearchResult } from '@/lib/games/types';

/**
 * "Games for you" — recommendations seeded from what the viewer actually played.
 *
 * There is no recommender service and there is not going to be one, so this is
 * built from the two things the app genuinely has: the viewer's own logs, and
 * IGDB's `similar_games` edge. Take the games they rated highest, ask IGDB what
 * each one is like, and drop anything they have already logged.
 *
 * That makes the band honest about itself. It is not "games we think you'll
 * like" in the machine-learning sense; it is "more like the ones you rated
 * well", which is a claim the data actually supports. `seeds` comes back with
 * the result so the UI can say so.
 *
 * ## Why seeds are ranked by score and not by recency
 *
 * The most recent thing someone logged is often the thing they bounced off. A
 * 90 is a much stronger signal than a Tuesday. Unrated logs are still eligible
 * but sort last — a played game with no score says something, just less.
 *
 * ## Cost
 *
 * One IGDB request per seed, so `SEED_COUNT` is the dial that matters. Three
 * covers the "what do I like" question — a fourth mostly returns games the
 * first three already suggested, because similarity is not that discriminating
 * within one person's taste.
 */

/** How many of the viewer's games to ask IGDB about. */
const SEED_COUNT = 3;

/** Logs below this score are not treated as an endorsement worth extending. */
const MIN_SEED_RATING = 60;

export type LogSeed = {
  gameId: string;
  title: string;
  rating: number | null;
};

export type Recommendations = {
  games: GameSearchResult[];
  /** The games these were derived from, best first. Empty when nothing seeded. */
  seeds: LogSeed[];
};

const EMPTY: Recommendations = { games: [], seeds: [] };

/**
 * Recommend games from a viewer's logs.
 *
 * Returns `EMPTY` rather than throwing when there is nothing to work from: a
 * new account with no logs, or a library of games that IGDB has no similarity
 * data for. Home renders the band only when `games` is non-empty, so an account
 * that cannot be recommended to simply does not see the section — which is the
 * right answer, and better than a rail of "popular" games pretending to be
 * personal.
 *
 * @param logs   The viewer's logs, any order.
 * @param limit  Maximum games to return.
 */
export async function recommendFromLogs(
  logs: readonly { game_id: string; rating: number | null; game?: { title?: string } | null }[],
  limit = 12,
  signal?: AbortSignal
): Promise<Recommendations> {
  if (logs.length === 0) return EMPTY;

  /*
   * Everything the viewer has already logged, including the low-rated ones.
   * Recommending back a game someone has played is the fastest way to make a
   * band like this look broken, and it happens constantly without this — a
   * sequel is "similar to" its predecessor in both directions.
   */
  const known = new Set(logs.map((log) => log.game_id));

  const seeds: LogSeed[] = logs
    .filter((log) => log.rating === null || log.rating >= MIN_SEED_RATING)
    .map((log) => ({
      gameId: log.game_id,
      title: log.game?.title ?? 'a game you played',
      rating: log.rating,
    }))
    // Rated first and highest-first; unrated logs keep their incoming order
    // behind them, which is recency, since `getUserLogs` sorts by created_at.
    .sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1))
    .slice(0, SEED_COUNT);

  if (seeds.length === 0) return EMPTY;

  /*
   * In parallel. These are independent reads and the band is already the
   * slowest thing on Home; three sequential round trips to an Edge Function
   * that proxies IGDB is most of a second for no reason.
   */
  const results = await Promise.all(seeds.map((seed) => getSimilarTo(seed.gameId, signal)));

  /*
   * Interleave rather than concatenate.
   *
   * Concatenating puts every recommendation from the top seed first, so the
   * rail opens with eight games that are all like one thing and the other two
   * seeds are past the fold. Round-robin means the first screenful spans the
   * viewer's taste, which is what the band is claiming to do.
   */
  const games: GameSearchResult[] = [];
  const taken = new Set<string>();

  for (let rank = 0; games.length < limit; rank += 1) {
    let foundAtThisRank = false;

    for (const result of results) {
      const candidate = result[rank];
      if (!candidate) continue;
      foundAtThisRank = true;

      if (known.has(candidate.id) || taken.has(candidate.id)) continue;
      taken.add(candidate.id);
      games.push(candidate);
      if (games.length >= limit) break;
    }

    // Every seed is exhausted; nothing deeper to interleave.
    if (!foundAtThisRank) break;
  }

  return { games, seeds };
}
