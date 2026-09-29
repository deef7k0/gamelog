import { useQuery } from '@tanstack/react-query';

import type { Game } from '@/lib/games';
import { getWikidataGameInfo, WikidataError, wikidataLookupFor } from '@/lib/wikidata';

/** A day, both ways. Awards are added after a ceremony, not by the minute. */
const DAY = 24 * 60 * 60_000;

/**
 * Wikidata's awards, cast and credits for one game.
 *
 * One query per game: finding the game's item, its claims, their labels and the
 * people check all run inside it, so the screen has one loading state and one
 * error state rather than four, and a failure in any step is a failure of the
 * whole — never half a screen cached as if it were the answer. The key is the
 * game's own id because the Q-ID is what the query *finds*; the Q-ID is inside
 * the result.
 *
 * - **Resolves to `null`** when no item could be matched with certainty, and
 *   without a request at all for a game with no identifier to search by. Null
 *   is a real answer and is cached like one, so a game Wikidata does not know
 *   is not searched for again on every visit.
 * - **Throws** `WikidataError` when a request fails. TanStack Query keeps no data
 *   for a failed query, so a dropped connection is never remembered as "no
 *   information", and the next visit asks again.
 * - **Cached for a day** (`staleTime`) and kept for a day unused (`gcTime`):
 *   reopening the screen is instant and costs nothing, and a stale answer is
 *   shown at once while a fresh one is fetched behind it.
 *
 * A rate-limited request is not retried — asking again straight away is
 * exactly what the limit is asking a client not to do.
 */
export function useWikidataGameInfo(game: Game | null | undefined) {
  const lookup = game ? wikidataLookupFor(game) : null;

  return useQuery({
    queryKey: ['wikidata-game-info', game?.id],
    queryFn: ({ signal }) => (lookup ? getWikidataGameInfo(lookup, signal) : null),
    enabled: !!game,
    staleTime: DAY,
    gcTime: DAY,
    retry: (failures, error) =>
      failures < 1 && !(error instanceof WikidataError && error.kind === 'rate-limited'),
  });
}
