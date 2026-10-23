import { useQuery } from '@tanstack/react-query';

import { getRawgTags, rawgTagsAvailable } from '@/lib/games/rawg-tags';

/**
 * RAWG's most-used tags, for "Search by", the title-search suggestions and
 * Surprise Me's settings. Kept a week — RAWG's vocabulary barely moves — and
 * never asked for in a build without a RAWG key.
 */
export function useRawgTags(enabled = true) {
  return useQuery({
    queryKey: ['rawg-tags'],
    queryFn: ({ signal }) => getRawgTags(signal),
    enabled: enabled && rawgTagsAvailable(),
    staleTime: 7 * 24 * 60 * 60_000,
  });
}
