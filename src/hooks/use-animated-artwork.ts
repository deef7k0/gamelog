import { useQuery, useQueryClient } from '@tanstack/react-query';

import { loadAnimatedArtwork, saveAnimatedArtwork } from '@/lib/animated-artwork';
import { useAuth } from '@/store/auth';

/**
 * Whether covers move by themselves, and the switch for it
 * (`lib/animated-artwork.ts`, Settings → Animated artwork, and onboarding).
 *
 * One device store read under a query, as `useGameColours` is, so every
 * animated cover on screen stops or starts the moment the switch is flipped —
 * onboarding's example included. Never written to the query cache on disk
 * (`NEVER_PERSIST`): the device store is the record.
 */
export function useAnimatedArtwork(): {
  /** True unless this account turned animated artwork off. */
  on: boolean;
  ready: boolean;
  setOn: (on: boolean) => void;
} {
  const userId = useAuth((state) => state.session?.user.id) ?? null;
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['animated-artwork', userId],
    queryFn: () => loadAnimatedArtwork(userId!),
    enabled: !!userId,
    staleTime: Infinity,
  });

  return {
    on: query.data ?? true,
    ready: !userId || query.isSuccess,
    setOn: (on) => {
      queryClient.setQueryData(['animated-artwork', userId], on);
      if (userId) void saveAnimatedArtwork(userId, on);
    },
  };
}
