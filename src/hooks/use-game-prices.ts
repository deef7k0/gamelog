import { useQuery } from '@tanstack/react-query';

import { parseGameId } from '@/lib/games';
import { getGameExtras } from '@/lib/games/igdb';
import { getStorePrices, lookupItadGame, type StorePrice } from '@/lib/games/itad';
import type { StoreLink } from '@/lib/games/storefronts';

export type GameStorefronts = {
  /** The official stores IGDB links the game to, in drawing order. */
  stores: StoreLink[];
  /** The game's Steam appid, when it has a Steam listing. */
  steamAppId: string | null;
  /** True once the answer is known — or known to be unavailable. */
  settled: boolean;
};

/**
 * A game's official stores and its Steam appid.
 *
 * For an IGDB game they ride on `getGameExtras`, under the game page's own key
 * and arguments — `['game-extras', gameId]`, the same function, the same
 * `staleTime` — so this is the page's request, not another one. A legacy
 * `steam:` game is its own Steam listing. Anything else has none.
 *
 * The appid is what the Where to buy card prices by, what the Platforms
 * section's price prices by, and what the Steam Awards card and the events
 * rail ask Steam about.
 */
export function useGameStorefronts(gameId: string): GameStorefronts {
  const parsed = parseGameId(gameId);
  const igdbId = parsed?.source === 'igdb' ? parsed.sourceId : null;

  const extras = useQuery({
    queryKey: ['game-extras', gameId],
    queryFn: ({ signal }) => getGameExtras(igdbId!, signal),
    enabled: !!igdbId,
    staleTime: 30 * 60_000,
  });

  if (parsed?.source === 'steam') {
    return {
      stores: [{ key: 'steam', url: `https://store.steampowered.com/app/${parsed.sourceId}` }],
      steamAppId: parsed.sourceId,
      settled: true,
    };
  }
  if (!igdbId) return { stores: [], steamAppId: null, settled: true };

  return {
    stores: extras.data?.stores ?? [],
    steamAppId: extras.data?.steamAppId ?? null,
    /* `isFetched`, not `isSuccess`: a failed record still lets the price
       lookup go ahead by title. */
    settled: extras.isFetched,
  };
}

/**
 * What a game costs, at every shop IsThereAnyDeal tracks, cheapest first —
 * and the stores it is sold at.
 *
 * Two requests, chained: the game's ITAD id (by Steam appid, else by its exact
 * title — see `lookupItadGame`), then its prices. The id is an identity and is
 * kept for good; prices are kept for a quarter of an hour, because being
 * current is the point. Waits for the stores so the appid path gets its turn.
 *
 * `['itad-game', …]` replaced `['itad-id', …]` when the title path started
 * checking what ITAD's fuzzy search answers: the old key's answers are kept on
 * the device for good, and some of them are another game's.
 */
export function useGamePrices(gameId: string, title: string | null | undefined) {
  const storefronts = useGameStorefronts(gameId);
  const { steamAppId } = storefronts;

  const itadId = useQuery({
    queryKey: ['itad-game', gameId, steamAppId, title ?? null],
    queryFn: ({ signal }) => lookupItadGame({ steamAppId, title: title ?? null }, signal),
    enabled: storefronts.settled,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  const prices = useQuery({
    queryKey: ['itad-prices', itadId.data],
    queryFn: ({ signal }) => getStorePrices(itadId.data!, signal),
    enabled: !!itadId.data,
    // Short: a sale that ended an hour ago is the one thing this must not show.
    staleTime: 15 * 60_000,
    retry: false,
  });

  const list: StorePrice[] = prices.data ?? [];

  return {
    storefronts,
    prices: list,
    /** Still finding out; false once there is an answer, an empty one included. */
    loading: !storefronts.settled || itadId.isLoading || prices.isLoading,
  };
}
