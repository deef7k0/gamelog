import type Ionicons from '@expo/vector-icons/Ionicons';

import type { OfficialStoreKey } from '@/lib/games/storefronts';

/**
 * How a storefront presents itself.
 *
 * ## Why there are no logo images here
 *
 * IsThereAnyDeal returns a shop's *name* and nothing else — no logo, no colour,
 * no icon — and IGDB returns a link. Every real logo would have to be a bundled
 * asset, and storefront logos are trademarks whose usage terms differ per
 * company; shipping forty of them because they were convenient is the kind of
 * thing that is fine until it is not.
 *
 * So a store is drawn as a **brand-coloured mark**: the platform glyph where
 * Ionicons happens to ship one (Steam, Xbox, PlayStation, the two mobile
 * stores), and the store's initial in its own colour where it does not. That is
 * recognisable at a glance — GOG's purple and Epic's near-black do most of the
 * work before you read anything — and it is honest about being our rendering
 * rather than the company's asset.
 *
 * The brand colours below are the storefronts' own. `readableInk()` is what
 * puts type on them, so a light brand like Fanatical's orange gets dark ink
 * without anyone hand-checking the contrast — see the note in CLAUDE.md about
 * verifying colour with `lib/color.ts` rather than by eye.
 */
export type StoreBrand = {
  /** The store's own colour, for the mark. */
  color: string;
  /** An Ionicons glyph when one genuinely exists for this platform. */
  icon?: keyof typeof Ionicons.glyphMap;
};

/**
 * The platforms' own stores — the rows "Where to buy" takes from IGDB
 * (`lib/games/storefronts.ts`), with the name each is printed under.
 */
export const OFFICIAL_STORES: Record<OfficialStoreKey, StoreBrand & { name: string }> = {
  steam: { name: 'Steam', color: '#1B2838', icon: 'logo-steam' },
  gog: { name: 'GOG', color: '#8B00CC' },
  epic: { name: 'Epic Games Store', color: '#2D2D2D' },
  /* xbox.com's store, which is the Microsoft Store — the name ITAD and the
     platform keys already use. Xbox's green behind Xbox's glyph. */
  microsoft: { name: 'Microsoft Store', color: '#107C10', icon: 'logo-xbox' },
  playstation: { name: 'PlayStation Store', color: '#003791', icon: 'logo-playstation' },
  nintendo: { name: 'Nintendo eShop', color: '#E60012' },
  apple: { name: 'App Store', color: '#0D84FF', icon: 'logo-apple-appstore' },
  google: { name: 'Google Play', color: '#01875F', icon: 'logo-google-playstore' },
  meta: { name: 'Meta Horizon Store', color: '#0467DF' },
  itch: { name: 'itch.io', color: '#FA5C5C' },
  gamejolt: { name: 'Game Jolt', color: '#2F7F6F' },
};

/**
 * ITAD shop ids, keyed as ITAD numbers them — read off its live answers on
 * 2026-10-16, not from memory.
 *
 * **These were wrong until then**, and silently: 48 was filed as the
 * PlayStation Store (it is the Microsoft Store — ITAD tracks no PlayStation
 * shop), 20 as Green Man Gaming (GameBillet; GMG is 36), 27 as IndieGala
 * (GamesPlanet DE; IndieGala is 42), 4 as itch.io (Blizzard). The worst of it:
 * picking PS5 in a game's Platforms section quoted the Microsoft Store's price
 * as the PS5's.
 *
 * Only the storefronts a reader is likely to recognise. Adding one is a line
 * here and nothing else — an unlisted shop already renders, just neutrally.
 * Keyed by id, not name: names get re-cased and re-branded.
 */
export const STORE_BRANDS: Record<number, StoreBrand> = {
  61: { color: '#1B2838', icon: 'logo-steam' }, // Steam
  35: { color: '#8B00CC' }, // GOG
  16: { color: '#2D2D2D' }, // Epic Game Store
  48: { color: '#107C10', icon: 'logo-xbox' }, // Microsoft Store
  37: { color: '#CB2C2E' }, // Humble Store
  6: { color: '#F27B24' }, // Fanatical
  36: { color: '#4A9E4A' }, // GreenManGaming
  42: { color: '#E4002B' }, // IndieGala Store
  24: { color: '#2D75D8' }, // GamersGate
  4: { color: '#148EFF' }, // Blizzard (Battle.net)
};

/**
 * Which ITAD shops sell a platform's games, for the price under the
 * Platforms section's platform button.
 *
 * ITAD tracks PC shops only. So the PC is priced by any of them, an Xbox by
 * the Microsoft Store — the same store and product page as the console's, per
 * `ITAD_SHOP_OF_STORE` — and every other platform by none: no price is the
 * truth there, where a PC price under a PS5 box was a quiet substitution.
 */
export const PLATFORM_STORE_IDS: Record<string, number[] | 'any'> = {
  pc: 'any',
  xbox: [48],
};

/** The mark for a store nobody has a brand entry for. */
export const STORE_FALLBACK_COLOR = '#5A5A5A';

export function storeBrand(shopId: number): StoreBrand {
  return STORE_BRANDS[shopId] ?? { color: STORE_FALLBACK_COLOR };
}

/** The ITAD shops that price a platform family: every one, some, or none. */
export function shopsForPlatform(platform: string): number[] | 'any' {
  return PLATFORM_STORE_IDS[platform] ?? [];
}

/**
 * The letter shown when there is no glyph.
 *
 * First character of the store's name, which is what a reader would abbreviate
 * it to anyway — G for GOG, E for Epic, H for Humble.
 */
export function storeInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}
