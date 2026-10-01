/**
 * The one personalised rail on Search: "Because you loved Hades".
 *
 * Built from what the user has logged — no recommendation service, no
 * embedding model. The rail's games are IGDB's own `similar_games` for one seed
 * (`getSimilarTo`, under the same `['similar', gameId]` key the game page's
 * Similar tab uses), and the heading names that seed, so the suggestion can be
 * agreed or disagreed with. An unexplained row of recommendations is
 * indistinguishable from an ad.
 *
 * **One seed, and it is the game you reviewed last.** This used to build a rail
 * for each of the four best-rated games, which put four "Because you…" bands in
 * a row on a screen that was meant to be simple, and never moved: a 95 from a
 * year ago outranked everything written since. The seed is now the most
 * recently reviewed game — written about or scored — so the rail follows what
 * you are playing, and saving a review (which invalidates `['user-logs', …]`)
 * moves it on. Pure, so `npm test` covers it.
 */

/** A score at or above this is "loved" rather than merely "played". */
const LOVED_THRESHOLD = 80;

/** What a seed needs of a log — `LogWithRelations` has all of it. */
export type SeedLog = {
  game_id: string;
  rating: number | null;
  review: string | null;
  updated_at: string;
  game?: { title?: string | null } | null;
};

export type RecommendationSeed = {
  gameId: string;
  title: string;
  reason: 'loved' | 'played';
  /** "Because you loved Hades" */
  heading: string;
};

/**
 * The game the rail is built from: the most recently reviewed IGDB game — the
 * latest log with writing or a score, by when it was last written — or, for
 * somebody who has never reviewed anything, the latest game they logged at all.
 * Null with nothing logged.
 *
 * IGDB games only: `similar_games` is an IGDB field, and the Steam, RAWG and
 * itch.io ids a legacy log may carry have no equivalent.
 */
export function recommendationSeed(logs: readonly SeedLog[]): RecommendationSeed | null {
  const candidates = logs
    .filter((log) => log.game_id.startsWith('igdb:') && log.game)
    .slice()
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  const reviewed = candidates.find((log) => !!log.review?.trim() || log.rating !== null);
  const seed = reviewed ?? candidates[0];
  if (!seed) return null;

  const title = seed.game?.title?.trim() || 'a game';
  const loved = (seed.rating ?? 0) >= LOVED_THRESHOLD;
  return {
    gameId: seed.game_id,
    title,
    reason: loved ? 'loved' : 'played',
    heading: loved ? `Because you loved ${title}` : `Because you played ${title}`,
  };
}
