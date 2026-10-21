import { useQuery, useQueryClient } from '@tanstack/react-query';

import { parseGameId } from '@/lib/games';
import { getGameExtras } from '@/lib/games/igdb';
import { getSteamTrailer, type SteamTrailer } from '@/lib/games/steam-trailer';
import { loadTrailers, saveTrailers } from '@/lib/trailers';
import { useAuth } from '@/store/auth';

/**
 * A day, at the owner's direction (2026-10-17). The answer is written to the
 * device with every other query (`lib/query-persist`), so a game opened in the
 * last day knows its trailer — or that it has none — before any request, and
 * is refreshed behind the page past this.
 */
const TRAILER_STALE_MS = 24 * 60 * 60_000;

/**
 * A game's trailer, from its Steam listing (`lib/games/steam-trailer.ts`):
 * the game page's hero and the studio page's banner game. `undefined` while
 * unknown, `null` when the game has no Steam listing or the listing has no
 * trailer.
 *
 * **"None" is an answer and is kept.** SimpMusic writes its artist's motion
 * row on every success, the empty one included, because that negative answer
 * is what stops the requests from running again on the page of an artist who
 * has none. Here the query's `null` is that row, kept for the day like any
 * answer. A failure throws instead and is not kept — a dropped connection is
 * not a fact about the game.
 *
 * The appid comes from the game page's own record (`['game-extras', id]`,
 * the same function and `staleTime` as `useGameStorefronts`), so on the game
 * page it is the request the page makes anyway, and from the studio page it
 * leaves the banner game's page warm. A legacy `steam:` game is its own
 * listing. Two requests to Steam after that, both small: the listing's
 * movies, then the chosen trailer's master playlist.
 */
export function useGameTrailer(gameId: string | null): SteamTrailer | null | undefined {
  const client = useQueryClient();
  const parsed = gameId ? parseGameId(gameId) : null;
  const igdbId = parsed?.source === 'igdb' ? parsed.sourceId : null;
  const steamId = parsed?.source === 'steam' ? parsed.sourceId : null;

  const trailer = useQuery({
    queryKey: ['game-trailer', gameId],
    queryFn: async ({ signal }) => {
      let appId = steamId;
      if (!appId) {
        const extras = await client.ensureQueryData({
          queryKey: ['game-extras', gameId],
          queryFn: () => getGameExtras(igdbId!),
          staleTime: 30 * 60_000,
        });
        appId = extras?.steamAppId ?? null;
      }
      return appId ? getSteamTrailer(appId, signal) : null;
    },
    enabled: !!igdbId || !!steamId,
    staleTime: TRAILER_STALE_MS,
    gcTime: 30 * 60_000,
    retry: 1,
  });

  if (!gameId) return undefined;
  if (!igdbId && !steamId) return null;
  return trailer.data;
}

/**
 * The trailers switch (`lib/trailers.ts`), shared by the game page and the
 * studio page. One device read under a query, so every page reads the answer
 * the last one wrote; never written to the query cache on disk
 * (`NEVER_PERSIST`) — the device store is the record. Until it has been read,
 * nothing plays.
 */
export function useTrailerSetting(): {
  on: boolean;
  ready: boolean;
  setOn: (on: boolean) => void;
} {
  const userId = useAuth((state) => state.session?.user.id) ?? null;
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['trailers', userId],
    queryFn: () => loadTrailers(userId!),
    enabled: !!userId,
    staleTime: Infinity,
  });

  return {
    on: query.data ?? true,
    ready: !userId || query.isSuccess,
    setOn: (on) => {
      queryClient.setQueryData(['trailers', userId], on);
      if (userId) void saveTrailers(userId, on);
    },
  };
}
