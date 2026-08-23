import type Ionicons from '@expo/vector-icons/Ionicons';

/**
 * How a storefront presents itself.
 *
 * ## Why there are no logo images here
 *
 * IsThereAnyDeal returns a shop's *name* and nothing else — no logo, no colour,
 * no icon. Every real logo would have to be a bundled asset, and storefront
 * logos are trademarks whose usage terms differ per company; shipping forty of
 * them because they were convenient is the kind of thing that is fine until it
 * is not.
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
 *
 * ## Keyed by ITAD's shop id
 *
 * Not by name. Names get re-cased and re-branded ("Epic Game Store" →
 * "Epic Games Store"), and matching on them means a store silently loses its
 * colour when ITAD tidies a string. Ids are stable. Anything not listed falls
 * back to a neutral mark, which is the correct treatment for the long tail of
 * key resellers nobody has heard of.
 */
export type StoreBrand = {
  /** The store's own colour, for the mark. */
  color: string;
  /** An Ionicons glyph when one genuinely exists for this platform. */
  icon?: keyof typeof Ionicons.glyphMap;
};

/**
 * ITAD shop ids, from `GET /shops/v1`.
 *
 * Only the storefronts a reader is likely to recognise. Adding one is a line
 * here and nothing else — an unlisted shop already renders, just neutrally.
 */
export const STORE_BRANDS: Record<number, StoreBrand> = {
  61: { color: '#1B2838', icon: 'logo-steam' }, // Steam
  35: { color: '#8B00CC' }, // GOG
  16: { color: '#2D2D2D' }, // Epic Games Store
  37: { color: '#CB2C2E' }, // Humble Store
  6: { color: '#F27B24' }, // Fanatical
  20: { color: '#4A9E4A' }, // Green Man Gaming
  62: { color: '#0078D4', icon: 'logo-xbox' }, // Microsoft Store
  48: { color: '#003791', icon: 'logo-playstation' }, // PlayStation Store
  50: { color: '#E60012' }, // Nintendo eShop
  27: { color: '#E4002B' }, // IndieGala
  4: { color: '#FA5C5C' }, // itch.io
  13: { color: '#0070FF' }, // Ubisoft Store
  29: { color: '#00AEFF' }, // Battle.net
  3: { color: '#2D75D8' }, // GamersGate
};

/**
 * Maps app PlatformKey to ITAD storefront IDs that sell games for that platform.
 */
export const PLATFORM_STORE_IDS: Record<string, number[]> = {
  pc: [61, 35, 16, 37, 6, 20, 27, 4, 13, 29, 3, 62],
  xbox: [62],
  ps5: [48],
  ps4: [48],
  switch: [50],
  ios: [],
  android: [],
};

/** The mark for a store nobody has a brand entry for. */
export const STORE_FALLBACK_COLOR = '#5A5A5A';

export function storeBrand(shopId: number): StoreBrand {
  return STORE_BRANDS[shopId] ?? { color: STORE_FALLBACK_COLOR };
}

/** Returns the shop IDs associated with a platform family. */
export function shopsForPlatform(platform: string): number[] {
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
