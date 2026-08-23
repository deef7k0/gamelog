import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { setLiked, type Engagement, type TargetType } from '@/lib/api';
import { useAuth } from '@/store/auth';

/**
 * A like button's state, with the optimistic toggle already handled.
 *
 * Engagement is fetched in bulk and only refreshed on pull-to-refresh, so
 * without the local override a tapped heart would stay grey until the next
 * refetch. That was written once inside `<EngagementBar>`; the collection
 * masthead now needs the same behaviour on a completely different-looking
 * control, and a second copy of an optimistic-update rule is exactly the kind
 * of duplication that drifts silently — one of them gets the "toggling back
 * cancels out" fix and the other does not.
 */
export function useLikeToggle(
  targetType: TargetType,
  targetId: string,
  engagement?: Engagement
): {
  liked: boolean;
  likeCount: number;
  commentCount: number;
  toggle: () => void;
} {
  const queryClient = useQueryClient();
  const userId = useAuth((state) => state.session?.user.id);

  const [override, setOverride] = useState<{ liked: boolean; delta: number } | null>(null);

  const liked = override?.liked ?? engagement?.likedByViewer ?? false;
  const likeCount = (engagement?.likes ?? 0) + (override?.delta ?? 0);

  const mutation = useMutation({
    mutationFn: async (next: boolean) => {
      if (!userId) throw new Error('You must be signed in.');
      await setLiked(userId, targetType, targetId, next);
    },
    onMutate: (next: boolean) => {
      const base = engagement?.likedByViewer ?? false;
      // Delta is relative to the server value, so toggling back to the original
      // state cancels out to zero rather than drifting.
      setOverride({ liked: next, delta: next === base ? 0 : next ? 1 : -1 });
    },
    onError: () => setOverride(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return {
    liked,
    likeCount,
    commentCount: engagement?.comments ?? 0,
    toggle: () => mutation.mutate(!liked),
  };
}
