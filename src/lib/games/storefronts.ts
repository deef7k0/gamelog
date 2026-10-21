/**
 * Where a game is sold, from IGDB, and which price goes with which store.
 *
 * Pure, so `npm test` holds it (`storefronts.test.ts`, against IGDB's real
 * answers in `fixtures/igdb-stores.json`). It imports nothing; the prices are
 * passed in, typed only by the fields read here.
 *
 * ## The owner's rule (2026-10-16)
 *
 * "Display all available links to buy the game at different official stores
 * from IGDB. If one of those stores has a price on the API we use for game
 * prices, display the price, but the link and the store is always shown and
 * taken from IGDB (except unofficial stores, who are taken from the prices
 * API)."
 *
 * So an **official store** — a platform's own shop: Steam, GOG, Epic, the
 * Microsoft Store, the PlayStation Store, the Nintendo eShop, the App Store,
 * Google Play, Meta's, itch.io, Game Jolt — is a row whenever IGDB lists it,
 * with IGDB's link, priced or not. IsThereAnyDeal, which tracks PC shops only,
 * prices the four it can (`ITAD_SHOP_OF_STORE`). **Every other shop ITAD
 * quotes** — Humble, Fanatical, Green Man Gaming, the key sellers — is a row
 * from ITAD, with ITAD's link.
 *
 * One case the rule does not name: ITAD prices an official store IGDB does not
 * list (a Steam price on a game whose IGDB record has no Steam link). That row
 * is kept, with ITAD's link, among the official stores: dropping a real price
 * on a first-party shop because the catalogue missed a link would be the worse
 * answer.
 */

export type OfficialStoreKey =
  | 'steam'
  | 'gog'
  | 'epic'
  | 'microsoft'
  | 'playstation'
  | 'nintendo'
  | 'apple'
  | 'google'
  | 'meta'
  | 'itch'
  | 'gamejolt';

/** The order the rows are drawn in: PC, consoles, phones, the rest. */
export const OFFICIAL_STORE_ORDER: readonly OfficialStoreKey[] = [
  'steam',
  'gog',
  'epic',
  'microsoft',
  'playstation',
  'nintendo',
  'apple',
  'google',
  'meta',
  'itch',
  'gamejolt',
];

/**
 * IGDB's `websites.type` for each store — `category` until IGDB renamed it,
 * the same rename as `external_games`. Read off live records on 2026-10-16:
 * 13 store.steampowered.com, 16 epicgames.com, 17 gog.com, 22 xbox.com's store,
 * 23 store.playstation.com, 24 nintendo.com, 10 and 11 apps.apple.com (iPhone
 * and iPad: one store), 12 play.google.com, 15 itch.io, 25 meta.com, 26
 * gamejolt.com.
 */
export const STORE_OF_WEBSITE: Readonly<Record<number, OfficialStoreKey>> = {
  13: 'steam',
  16: 'epic',
  17: 'gog',
  22: 'microsoft',
  23: 'playstation',
  24: 'nintendo',
  10: 'apple',
  11: 'apple',
  12: 'google',
  15: 'itch',
  25: 'meta',
  26: 'gamejolt',
};

/**
 * IGDB's `external_games.external_game_source` for each store, the second
 * place IGDB keeps store links. Also read off live records: 1 Steam, 5 GOG,
 * 26 Epic, 11 xbox.com's store, 54 microsoft.com's, 36 the PlayStation Store
 * (US), 13 iTunes, 15 Google Play, 28 Meta, 30 itch.io, 55 Game Jolt.
 *
 * Left out on purpose: 20 and 23 (Amazon — a retailer, not a platform's
 * store, and its listings are box SKUs by region), 31 (the Xbox 360
 * Marketplace, closed), 37 (a publisher's own shop), and the ones that are not
 * shops at all — 3 Giant Bomb, 10 YouTube, 14 Twitch.
 */
export const STORE_OF_SOURCE: Readonly<Record<number, OfficialStoreKey>> = {
  1: 'steam',
  5: 'gog',
  26: 'epic',
  11: 'microsoft',
  54: 'microsoft',
  36: 'playstation',
  13: 'apple',
  15: 'google',
  28: 'meta',
  30: 'itch',
  55: 'gamejolt',
};

/**
 * The official stores IsThereAnyDeal prices, by ITAD's shop id — read off its
 * live answers (2026-10-16), and checked by following its links: ITAD's
 * "Microsoft Store" (48) lands on xbox.com's store page for the same product
 * IGDB's Xbox link names. ITAD tracks no PlayStation, Nintendo or mobile shop,
 * so those rows are links without a price, always.
 */
export const ITAD_SHOP_OF_STORE: Readonly<Partial<Record<OfficialStoreKey, number>>> = {
  steam: 61,
  gog: 35,
  epic: 16,
  microsoft: 48,
};

const OFFICIAL_ITAD_SHOPS = new Map<number, OfficialStoreKey>(
  Object.entries(ITAD_SHOP_OF_STORE).map(([key, shop]) => [shop as number, key as OfficialStoreKey])
);

/** The fields of an IGDB game this reads. */
export type IgdbStoreFields = {
  websites?: { type?: number; url?: string }[];
  external_games?: { external_game_source?: number; uid?: string; url?: string }[];
};

export type StoreLink = { key: OfficialStoreKey; url: string };

export type Storefronts = {
  /** One link per official store, in `OFFICIAL_STORE_ORDER`. */
  stores: StoreLink[];
  /** The game's Steam appid, when it has a Steam listing. */
  steamAppId: string | null;
};

/**
 * A game's official stores and its Steam appid, from its IGDB record.
 *
 * `websites` first: it is the curated list, one link a store. `external_games`
 * fills a store `websites` lacks — and is not trusted first, because it holds
 * whatever was matched: Disco Elysium's GOG entry there is a bundle with
 * another game, where its website is the game's own page. One link per store;
 * the first that is a real http(s) address wins, moved to https.
 */
export function pickStorefronts(raw: IgdbStoreFields | null | undefined): Storefronts {
  const found = new Map<OfficialStoreKey, string>();

  const offer = (key: OfficialStoreKey | undefined, url: string | undefined) => {
    if (!key || found.has(key)) return;
    const safe = webUrl(url);
    if (safe) found.set(key, safe);
  };

  for (const site of raw?.websites ?? []) {
    offer(site.type === undefined ? undefined : STORE_OF_WEBSITE[site.type], site.url);
  }
  for (const listing of raw?.external_games ?? []) {
    const source = listing.external_game_source;
    offer(source === undefined ? undefined : STORE_OF_SOURCE[source], listing.url);
  }

  const stores = OFFICIAL_STORE_ORDER.flatMap((key) => {
    const url = found.get(key);
    return url ? [{ key, url }] : [];
  });

  return { stores, steamAppId: steamAppIdOf(raw) };
}

/**
 * The Steam appid: the Steam listing's uid, else the number in the Steam
 * website's address (`store.steampowered.com/app/632470`).
 */
export function steamAppIdOf(raw: IgdbStoreFields | null | undefined): string | null {
  for (const listing of raw?.external_games ?? []) {
    if (listing.external_game_source === 1 && /^\d+$/.test(listing.uid ?? '')) {
      return listing.uid!;
    }
  }
  for (const site of raw?.websites ?? []) {
    if (site.type !== 13) continue;
    const id = steamAppIdFromUrl(site.url);
    if (id) return id;
  }
  return null;
}

export function steamAppIdFromUrl(url: string | undefined | null): string | null {
  return url?.match(/store\.steampowered\.com\/app\/(\d+)/)?.[1] ?? null;
}

/** An http(s) address, on https; anything else is not a link. */
function webUrl(url: string | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed || !/^https?:\/\/[^\s/]+\.[^\s/]+/i.test(trimmed)) return null;
  return trimmed.replace(/^http:\/\//i, 'https://');
}

/** What this needs to know about a price; `StorePrice` in `itad.ts` is one. */
export type ShopPrice = { shopId: number; url: string };

/** An official store's row: IGDB's link, and ITAD's price when it has one. */
export type OfficialOffer<P extends ShopPrice> = {
  key: OfficialStoreKey;
  url: string;
  /** Where the link came from: IGDB, or ITAD for a store IGDB did not list. */
  source: 'igdb' | 'itad';
  price: P | null;
};

export type ArrangedOffers<P extends ShopPrice> = {
  official: OfficialOffer<P>[];
  /** Every other shop ITAD prices, in the order given (cheapest first). */
  others: P[];
};

/**
 * The owner's rule as rows: every official store IGDB lists, each with ITAD's
 * price when ITAD has one, then the shops only ITAD knows.
 *
 * `prices` is expected cheapest first (`getStorePrices` sorts it), so the
 * first price for a shop is its best and the others keep that order.
 */
export function arrangeOffers<P extends ShopPrice>(
  stores: readonly StoreLink[],
  prices: readonly P[]
): ArrangedOffers<P> {
  const priceOf = new Map<OfficialStoreKey, P>();
  const others: P[] = [];

  for (const price of prices) {
    const official = OFFICIAL_ITAD_SHOPS.get(price.shopId);
    if (!official) others.push(price);
    else if (!priceOf.has(official)) priceOf.set(official, price);
  }

  const linked = new Map(stores.map((store) => [store.key, store.url]));

  const official = OFFICIAL_STORE_ORDER.flatMap((key): OfficialOffer<P>[] => {
    const url = linked.get(key);
    const price = priceOf.get(key) ?? null;
    if (url) return [{ key, url, source: 'igdb', price }];
    if (price) return [{ key, url: price.url, source: 'itad', price }];
    return [];
  });

  return { official, others };
}
