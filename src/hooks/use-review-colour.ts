import { useQuery, useQueryClient } from '@tanstack/react-query';

import { loadReviewColour, saveReviewColour } from '@/lib/review-colour';
import { useAuth } from '@/store/auth';

/**
 * Whether a review's page wears its game's colours, and the switch for it
 * (`lib/review-colour.ts`). One device store read, under a query so every
 * review open reads the answer the last one wrote; `ready` is false until it
 * has, so a page that is off does not open in colour and then go grey.
 *
 * Never written to the query cache on disk (`NEVER_PERSIST`): the device
 * store is the record.
 */
export function useReviewColour(): {
  colourful: boolean;
  ready: boolean;
  setColourful: (colourful: boolean) => void;
} {
  const userId = useAuth((state) => state.session?.user.id) ?? null;
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['review-colour', userId],
    queryFn: () => loadReviewColour(userId!),
    enabled: !!userId,
    staleTime: Infinity,
  });

  return {
    colourful: query.data ?? true,
    ready: !userId || query.isSuccess,
    setColourful: (colourful) => {
      queryClient.setQueryData(['review-colour', userId], colourful);
      if (userId) void saveReviewColour(userId, colourful);
    },
  };
}
