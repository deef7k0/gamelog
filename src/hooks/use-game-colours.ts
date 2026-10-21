import { useQuery, useQueryClient } from '@tanstack/react-query';

import { loadGameColours, saveGameColours } from '@/lib/game-colours';
import { useAuth } from '@/store/auth';

/**
 * Whether the screens about one game wear its colours, and the switch for it
 * (`lib/game-colours.ts`, Settings → Game colours).
 *
 * One device store read, under a query, so every game screen reads the answer
 * the switch last wrote and changes the moment it is flipped — a screen
 * underneath Settings included. The root layout reads it once a session is
 * known (`<GameColoursWarmup>`), so the answer is in memory before the first
 * game's page opens and a page that is off never opens in colour first.
 *
 * Never written to the query cache on disk (`NEVER_PERSIST`): the device
 * store is the record.
 */
export function useGameColours(): {
  /** True unless this account turned game colours off. */
  on: boolean;
  ready: boolean;
  setOn: (on: boolean) => void;
} {
  const userId = useAuth((state) => state.session?.user.id) ?? null;
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['game-colours', userId],
    queryFn: () => loadGameColours(userId!),
    enabled: !!userId,
    staleTime: Infinity,
  });

  return {
    on: query.data ?? true,
    ready: !userId || query.isSuccess,
    setOn: (on) => {
      queryClient.setQueryData(['game-colours', userId], on);
      if (userId) void saveGameColours(userId, on);
    },
  };
}

/**
 * Reads the switch as soon as there is an account, and draws nothing: mounted
 * once in the root layout so the first game page finds the answer in memory.
 * Its own component, so the read re-renders this and nothing else.
 */
export function GameColoursWarmup(): null {
  useGameColours();
  return null;
}
