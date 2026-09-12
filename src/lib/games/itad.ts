import { shopsForPlatform } from '@/constants/stores';
import { supabase } from '../supabase';

/**
 * IsThereAnyDeal — where a game is sold, and for how much.
 *
 * IGDB publishes no pricing at all, and before this the app could only quote
 * Steam, through Steam's own undocumented store endpoint. ITAD aggregates
 * around forty storefronts, which turns one number into the actual question a
 * reader has: *where is this cheapest right now*.
 *
 * ## Nothing here talks to ITAD directly
 *
 * The API key cannot ship in a bundle, so every call goes through the `itad`
 * Edge Function — same arrangement as `igdb`, and it means prices are only
 * available to signed-in users. Fine: the game page is behind the auth guard.
 *
 * ## Two calls, and why they are cached differently
 *
 * The lookup (our game → ITAD's uuid) is an identity that never changes, so it
 * is cached hard. Prices are the opposite and are the reason the whole feature
 * exists, so they get a short life. Both are TanStack Query's job at the call
 * site; the functions here are plain fetches.
 */

/** Prices are quoted in USD for now. Passed through to ITAD's `country`. */
export const PRICE_COUNTRY = 'US';

async function itadCall<T>(body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const { data, error } = await supabase.functions.invoke('itad', {
    body,
    ...(signal ? { signal } : {}),
  });

  if (error) throw new Error(`IsThereAnyDeal request failed: ${error.message}`);
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error(String((data as { error: unknown }).error));
  }
  return data as T;
}

type LookupResponse = {
  found?: boolean;
  game?: { id?: string; slug?: string; title?: string };
};

/**
 * Resolve one of our games to an ITAD id.
 *
 * Steam appid first, title second, and the order matters. The appid is an
 * identity match; the title is a string comparison against a catalogue that
 * contains three different games called "Mafia", and ITAD's own docs are blunt
 * that title lookup "will only return IDs for titles that match precisely".
 * When both fail the game simply has no prices, which is the honest outcome for
 * something that is not sold anywhere ITAD tracks.
 *
 * @param steamAppId From IGDB's `external_games` or Steam game sourceId.
 */
export async function lookupItadGame(
  input: { steamAppId?: string | null; title?: string | null },
  signal?: AbortSignal
): Promise<string | null> {
  const appid = input.steamAppId ? Number(input.steamAppId) : NaN;

  if (Number.isFinite(appid) && appid > 0) {
    const byAppId = await itadCall<LookupResponse>(
      { action: 'lookup', appid, title: input.title?.trim() || undefined },
      signal
    );
    if (byAppId?.found && byAppId.game?.id) return byAppId.game.id;
  }

  const title = input.title?.trim();
  if (!title) return null;

  const byTitle = await itadCall<LookupResponse>({ action: 'lookup', title }, signal);
  return byTitle?.found && byTitle.game?.id ? byTitle.game.id : null;
}

type ItadMoney = { amount?: number; currency?: string };

type ItadDeal = {
  shop?: { id?: number; name?: string };
  price?: ItadMoney;
  regular?: ItadMoney;
  cut?: number;
  url?: string;
  historyLow?: ItadMoney;
};

type ItadPriceRow = { id?: string; deals?: ItadDeal[] };

/** One storefront's current offer for a game. */
export type StorePrice = {
  /** ITAD's shop id — stable, and what the brand lookup keys on. */
  shopId: number;
  shopName: string;
  /** Current price in `currency`, or 0 for a giveaway. */
  amount: number;
  /** Undiscounted price. Equal to `amount` when there is no cut. */
  regular: number;
  currency: string;
  /** Whole-percent discount, 0 when there is none. */
  cut: number;
  /** ITAD's outbound link to the store page. */
  url: string;
  /** Historical lowest price recorded for this game on this store, if reported. */
  historyLow?: { amount: number; currency: string } | null;
  /** Whether the current deal matches or beats the historical lowest price. */
  isAllTimeLow?: boolean;
};

/**
 * Current prices for a game, cheapest first.
 *
 * Sorted here rather than by ITAD, because the ordering the page wants is not
 * one ITAD offers: cheapest first is what makes a row of store buttons worth
 * scanning, and a tie between two stores at the same price is broken by the
 * bigger discount so the more interesting deal leads.
 *
 * Rows with no usable price are dropped rather than rendered as a store with a
 * blank number — a button that says "Fanatical" and nothing else is a worse
 * answer than one fewer button.
 */
export async function getStorePrices(itadId: string, signal?: AbortSignal): Promise<StorePrice[]> {
  const byId = await getStorePricesBatch([itadId], signal);
  return byId[itadId] ?? [];
}

/**
 * The same question asked for many games at once.
 *
 * ITAD's prices endpoint has always taken an array of ids — `getStorePrices`
 * sent one and dropped every row past the first, which is fine for a game page
 * and ruinous for a list. A rail of twelve games priced one at a time is twelve
 * round trips through the Edge Function; here it is one.
 *
 * Returns a map rather than an array so a caller can index by the id it already
 * holds, and so a game ITAD returned nothing for is simply absent instead of
 * shifting every subsequent index by one.
 */
export async function getStorePricesBatch(
  itadIds: string[],
  signal?: AbortSignal
): Promise<Record<string, StorePrice[]>> {
  const ids = [...new Set(itadIds.filter(Boolean))];
  if (ids.length === 0) return {};

  const rows = await itadCall<ItadPriceRow[]>(
    { action: 'prices', ids, country: PRICE_COUNTRY },
    signal
  );

  const result: Record<string, StorePrice[]> = {};
  for (const row of rows ?? []) {
    if (row?.id) result[row.id] = mapDeals(row.deals ?? []);
  }

  return result;
}

function mapDeals(deals: ItadDeal[]): StorePrice[] {
  return deals
    .flatMap((deal): StorePrice[] => {
      const amount = deal.price?.amount;
      const shopId = deal.shop?.id;
      const shopName = deal.shop?.name;
      const url = deal.url;

      if (typeof amount !== 'number' || !shopId || !shopName || !url) return [];

      const regular = deal.regular?.amount ?? amount;
      const currency = deal.price?.currency ?? 'USD';
      const cut = typeof deal.cut === 'number' ? Math.round(deal.cut) : 0;
      const historyLowAmount = deal.historyLow?.amount;
      const hasHistoryLow = typeof historyLowAmount === 'number';
      const isAllTimeLow = hasHistoryLow && amount <= historyLowAmount && cut > 0;

      return [
        {
          shopId,
          shopName,
          amount,
          regular,
          currency,
          cut,
          url,
          historyLow: hasHistoryLow
            ? { amount: historyLowAmount, currency: deal.historyLow?.currency ?? currency }
            : null,
          isAllTimeLow,
        },
      ];
    })
    .sort((a, b) => a.amount - b.amount || b.cut - a.cut);
}

/**
 * Find the best price / deal available for a specific platform.
 *
 * If a game is selected for PC, returns the cheapest offer across PC storefronts.
 * For Xbox/PlayStation/Switch, returns the price at their respective store if tracked.
 */
export function getBestPriceForPlatform(
  prices: StorePrice[] | undefined | null,
  platform: string
): StorePrice | null {
  if (!prices || prices.length === 0) return null;

  const validShopIds = shopsForPlatform(platform);
  if (validShopIds.length === 0) {
    // If platform has no specific storefront mapping (e.g. mobile), return null
    return null;
  }

  const shopSet = new Set(validShopIds);
  const matching = prices.filter((price) => shopSet.has(price.shopId));
  return matching.length > 0 ? matching[0] : null;
}

/**
 * Format a price the way a storefront would.
 *
 * `Intl.NumberFormat` rather than a `$` template, because ITAD returns the
 * currency alongside the amount and this app will not always be quoting USD —
 * see `PRICE_COUNTRY`. Free is a word, not `$0.00`: a giveaway and a
 * one-cent sale are different things and the number alone hides that.
 */
export function formatPrice(amount: number, currency: string): string {
  if (amount <= 0) return 'Free';

  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    // An unknown currency code should not take the row down with it.
    return `${amount.toFixed(2)} ${currency}`;
  }
}
