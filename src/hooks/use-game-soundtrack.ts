import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getGameSoundtrack } from '@/lib/soundcloud/api';
import type { SoundtrackLookup } from '@/lib/soundcloud/types';

/** A found soundtrack — or a searched-for nothing — stands for the session. */
const SETTLED_MS = 60 * 60_000;

export type GameSoundtrackRequest = {
  /** The app-wide game id. */
  gameId: string | null | undefined;
  title: string | null | undefined;
  /** Whose uploads count as official. */
  developer?: string | null;
  /** False until the soundtrack is wanted — the game page asks when its tab is opened. */
  enabled?: boolean;
};

/**
 * A game's soundtrack on SoundCloud: one query, shared by the game page's
 * Soundtrack tab, the soundtrack screen and Surprise Me.
 *
 * One key — `['soundtrack', gameId]` — so the screen "Listen" opens is already
 * loaded by the tab it was pressed on, and dealing back to a game in Surprise
 * Me costs nothing. The key's first word is in `NEVER_PERSIST`: what SoundCloud
 * says about a track may not be written to the device.
 *
 * `lookAgain` is the search run again, past a stored "nothing found". The
 * server honours it at most every ten minutes per game, so it cannot be leant
 * on; it is for the one case where a soundtrack went up after the last look.
 */
export function useGameSoundtrack({
  gameId,
  title,
  developer,
  enabled = true,
}: GameSoundtrackRequest) {
  const queryClient = useQueryClient();
  const key = ['soundtrack', gameId] as const;

  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) =>
      getGameSoundtrack({ gameId: gameId!, title: title!, developer, signal }),
    enabled: enabled && !!gameId && !!title,
    /*
     * "Not connected" and "slow down" are not answers about the game, so they
     * are not kept: the next screen to ask finds out afresh, which is how the
     * feature switches itself on the day the keys are set.
     */
    staleTime: (current) => {
      const status = current.state.data?.status;
      return status === 'ok' || status === 'none' ? SETTLED_MS : 0;
    },
    retry: false,
  });

  const again = useMutation({
    mutationFn: () =>
      getGameSoundtrack({ gameId: gameId!, title: title!, developer, refresh: true }),
    onSuccess: (answer: SoundtrackLookup) => {
      queryClient.setQueryData(key, answer);
    },
  });

  return {
    query,
    /** Search again. Only for a `none`; anything else is `query.refetch()`. */
    lookAgain: () => again.mutate(),
    isLookingAgain: again.isPending,
    /** The second look failed outright — the first answer is still what is shown. */
    lookAgainFailed: again.isError,
  };
}
