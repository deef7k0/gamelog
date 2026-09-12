import { useQuery } from '@tanstack/react-query';

import { getEngagement, type Engagement } from '@/lib/api';

/**
 * Likes and comments for a screenful of collections, in one round trip.
 *
 * `lists` has no foreign key to `likes` or `comments` and cannot have one: both
 * are polymorphic over `(target_type, target_id)`, which is the whole reason a
 * new likeable thing costs a CHECK constraint instead of a table. PostgREST
 * therefore cannot embed or aggregate them onto a list row, so the counts cannot
 * ride along with `getLists` and have to be fetched beside it.
 *
 * `getEngagement` already batches — two queries total for the whole set, tallied
 * in JS — so this is one request per screen rather than one per tile. Without it
 * a wall of twenty collections would be forty.
 *
 * The key is the joined id string rather than the array, because an array
 * literal is a fresh reference on every render and would make the query refetch
 * forever. Callers should keep the id list stable (derive it from query data,
 * not from a filter recomputed inline).
 */
export function useCollectionEngagement(
  listIds: string[],
  viewerId: string | null
): Record<string, Engagement> | undefined {
  const key = listIds.join(',');

  const query = useQuery({
    queryKey: ['engagement', 'list', key, viewerId],
    queryFn: () => getEngagement('list', listIds, viewerId),
    enabled: listIds.length > 0,
  });

  return query.data;
}
