import { getUserLogs } from '../api/core';
import { getSimilarTo, type GameSearchResult } from '../games';

/**
 * Personalised recommendation modules for the Discover feed.
 *
 * Built entirely from what the user has already logged — no recommendation
 * service, no embedding model. The reasoning is IGDB's own `similar_games`,
 * seeded from the games this person actually rated highly, which is both cheap
 * and explainable: every row can say *why* it is there.
 *
 * That "because" line is the point. An unexplained recommendation row is
 * indistinguishable from an ad; one that names the game it came from is a
 * suggestion the reader can agree or disagree with.
 */

export type RecommendationReason = 'loved' | 'played';

export type RecommendationModule = {
  /** Stable key for lists — derived from the seed, not the position. */
  id: string;
  reason: RecommendationReason;
  /** The game this module was generated from. */
  seedTitle: string;
  seedGameId: string;
  /** "Because you loved Hades" */
  heading: string;
  games: GameSearchResult[];
};

/** A score at or above this is treated as "loved" rather than merely "played". */
const LOVED_THRESHOLD = 80;

/** How many seed games to expand. Each costs one IGDB request. */
const MAX_MODULES = 4;

/**
 * Build recommendation modules for a user.
 *
 * Seeds are chosen highest-rated first so the strongest signal leads, then
 * recently played as a fallback for someone who logs without scoring. Only
 * IGDB-sourced games can seed a module — `similar_games` is an IGDB field and
 * Steam/RAWG/itch ids have no equivalent.
 */
export async function getRecommendations(
  userId: string,
  signal?: AbortSignal
): Promise<RecommendationModule[]> {
  const logs = await getUserLogs(userId);
  if (logs.length === 0) return [];

  const seeds = logs
    .filter((log) => log.game_id.startsWith('igdb:') && log.game)
    .sort((a, b) => {
      // Rated games first, best first; unrated fall back to recency.
      const aScore = a.rating ?? -1;
      const bScore = b.rating ?? -1;
      if (aScore !== bScore) return bScore - aScore;
      return b.created_at.localeCompare(a.created_at);
    })
    .slice(0, MAX_MODULES);

  const modules = await Promise.all(
    seeds.map(async (log): Promise<RecommendationModule | null> => {
      const title = log.game?.title ?? 'a game';
      const loved = (log.rating ?? 0) >= LOVED_THRESHOLD;

      try {
        const similar = await getSimilarTo(log.game_id, signal);
        if (similar.length === 0) return null;

        return {
          id: `rec:${log.game_id}`,
          reason: loved ? 'loved' : 'played',
          seedTitle: title,
          seedGameId: log.game_id,
          heading: loved ? `Because you loved ${title}` : `Because you played ${title}`,
          games: similar.slice(0, 12),
        };
      } catch {
        // One seed failing must not empty the whole Discover feed.
        return null;
      }
    })
  );

  return modules.filter((entry): entry is RecommendationModule => entry !== null);
}
