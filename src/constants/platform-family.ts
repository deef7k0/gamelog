import type { PlatformKey } from './platform-cases';

/**
 * A platform *family*, which is not the same thing as a platform.
 *
 * `PLATFORMS` in `platform-cases.ts` models the thing you hold — a PS5 is not a
 * PS4, and the two have different cases, different stores and different box
 * art. That distinction is right on a game's own page, where the reader is
 * choosing which version they own.
 *
 * In a list it is noise. A game on PS4, PS5, Xbox 360, Xbox One and Xbox Series
 * produces five chips saying almost nothing, and the row is 74dp tall. What a
 * reader actually wants there is "PlayStation and Xbox" — two marks, two words.
 * So a family collapses every generation of a vendor's hardware into one entry,
 * and the row shows each family at most once.
 *
 * This is deliberately *not* a second source of truth for platform metadata: a
 * family points back at a `PlatformKey` so price lookups, store ids and case
 * templates keep coming from `PLATFORMS`.
 */
export type PlatformFamilyKey = 'pc' | 'playstation' | 'xbox' | 'switch' | 'ios' | 'android';

export type PlatformFamily = {
  key: PlatformFamilyKey;
  /** The word beside the mark. Short by design — this sits in a chip. */
  label: string;
  /** Ionicons glyph. Nintendo has no mark in the set; see `PLATFORMS`. */
  icon:
    | 'logo-playstation'
    | 'logo-xbox'
    | 'logo-steam'
    | 'logo-apple'
    | 'logo-google-playstore'
    | 'game-controller';
  /** Vendor brand colour, used on the glyph only. See the note in the chip. */
  accent: string;
  /**
   * Which `PlatformKey` this family resolves to when something needs a single
   * concrete platform — a price lookup, a store id. The newest generation, so
   * "PlayStation" prices against the PS5 storefront rather than a dead one.
   */
  platform: PlatformKey;
  /**
   * Matches the provider's own platform strings. IGDB is verbose and
   * inconsistent — "PC (Microsoft Windows)", "Xbox Series X|S", "PlayStation 4"
   * — so this matches loosely rather than against an enumerated list that would
   * silently drop a platform the day IGDB renames one.
   */
  match: RegExp;
};

/**
 * Ordered. A row renders families in this sequence regardless of the order the
 * provider listed them, so two games never disagree about where PC goes.
 *
 * Desktop is one family. Windows, macOS and Linux as three chips is three
 * quarters of the row spent on a distinction almost no reader is making at
 * this altitude, and "PC" is what every storefront calls it anyway.
 */
export const PLATFORM_FAMILIES: readonly PlatformFamily[] = [
  {
    key: 'pc',
    label: 'PC',
    icon: 'logo-steam',
    accent: '#9BA7B8',
    platform: 'pc',
    match: /^(pc\b|windows|mac\b|macos|os x|linux)/i,
  },
  {
    key: 'playstation',
    label: 'PS',
    icon: 'logo-playstation',
    accent: '#4C8DFF',
    platform: 'ps5',
    match: /playstation|^ps[1-5]\b|^psp\b|^ps vita/i,
  },
  {
    key: 'xbox',
    label: 'XBOX',
    icon: 'logo-xbox',
    accent: '#5DD45D',
    platform: 'xbox',
    match: /xbox/i,
  },
  {
    key: 'switch',
    label: 'SWITCH',
    icon: 'game-controller',
    accent: '#FF6B6B',
    platform: 'switch',
    match: /nintendo switch/i,
  },
  {
    key: 'ios',
    label: 'iOS',
    icon: 'logo-apple',
    accent: '#C9C9C9',
    platform: 'ios',
    match: /^ios\b|iphone|ipad/i,
  },
  {
    key: 'android',
    label: 'ANDROID',
    icon: 'logo-google-playstore',
    accent: '#7BD88F',
    platform: 'android',
    match: /android/i,
  },
];

/**
 * The families a game belongs to, deduplicated and in `PLATFORM_FAMILIES` order.
 *
 * A platform string that matches nothing is dropped rather than shown raw. The
 * alternative — passing "Nintendo 3DS" or "Sega Saturn" through as a bare word
 * — puts an unstyled chip with no mark beside four that have one, which reads
 * as a rendering fault rather than as information.
 */
export function platformFamilies(platforms: readonly string[]): PlatformFamily[] {
  return PLATFORM_FAMILIES.filter((family) =>
    platforms.some((platform) => family.match.test(platform.trim()))
  );
}

/**
 * Which platform to quote a price for, given what the game runs on.
 *
 * Steam first whenever the game is on PC, because that is the number a reader
 * recognises and the one storefront ITAD tracks most completely. Otherwise the
 * first console family the game actually has — there is no point quoting a
 * PlayStation price for a Switch exclusive, and quoting *some other platform's*
 * price would be the kind of quiet substitution PRODUCT.md forbids.
 *
 * Returns null for a game that is only on mobile: `PLATFORM_STORE_IDS` has no
 * shops for iOS or Android, so there is no price to find and the row shows none.
 */
export function pricingPlatformFor(families: readonly PlatformFamily[]): PlatformKey | null {
  const order: PlatformFamilyKey[] = ['pc', 'playstation', 'xbox', 'switch'];

  for (const key of order) {
    const family = families.find((candidate) => candidate.key === key);
    if (family) return family.platform;
  }

  return null;
}
