import {
  EMPTY_ANSWERS,
  PICKS_COUNT,
  interleave,
  picksClause,
  pickingGridClause,
  type OnboardingAnswers,
} from '@/lib/onboarding';

import { getGamesWhere, getSimilarIds } from './igdb';
import type { Game } from './types';

/** The favourites step's grid before anything is typed: the most-rated games. */
export function getPickingGrid(signal?: AbortSignal): Promise<Game[]> {
  return getGamesWhere(pickingGridClause(), 18, signal);
}

/**
 * The six games on onboarding's last page — "you'll like these."
 *
 * Honest about what it is, as "Games for you" is: games IGDB calls similar to
 * the favourites just picked, narrowed by what was answered (platforms, genres,
 * solo or not), most-rated first. When that runs short it lets go of a rule at
 * a time — first the answers, then the favourites — and ends on the answers'
 * most-rated games, then the catalogue's. **Never empty**: the page always has
 * six games to offer, and never offers a favourite back.
 *
 * Three or four IGDB requests at most, all after the favourites are known.
 */
export async function getOnboardingPicks(
  answers: OnboardingAnswers,
  favouriteIds: readonly number[],
  signal?: AbortSignal
): Promise<Game[]> {
  const picks: Game[] = [];
  const excluded = () => [...favouriteIds, ...picks.map((game) => Number(game.sourceId))];
  const want = () => PICKS_COUNT - picks.length;

  if (favouriteIds.length > 0) {
    const similar = interleave(
      await getSimilarIds(favouriteIds, signal),
      new Set(favouriteIds),
      40
    );
    if (similar.length > 0) {
      picks.push(
        ...(await getGamesWhere(picksClause(answers, excluded(), similar), want(), signal))
      );
      if (want() > 0) {
        picks.push(
          ...(await getGamesWhere(picksClause(EMPTY_ANSWERS, excluded(), similar), want(), signal))
        );
      }
    }
  }

  if (want() > 0) {
    picks.push(...(await getGamesWhere(picksClause(answers, excluded()), want(), signal)));
  }
  if (want() > 0) {
    picks.push(...(await getGamesWhere(picksClause(EMPTY_ANSWERS, excluded()), want(), signal)));
  }

  return picks.slice(0, PICKS_COUNT);
}
