import { IDENTITY_KEYS, type IdentityKey, type ThemePalette } from './theme';

/**
 * A game's identity hue.
 *
 * ## Where the colour comes from, and where it does not
 *
 * It comes from the game's **genres**, which are real IGDB data the app already
 * carries on `Game.genres`. It is *not* sampled from the cover art, and nothing
 * in the UI claims it is: reading pixels needs a native module, which rules it
 * out under Expo Go, and guessing would put us squarely against PRODUCT.md's
 * second principle. The actual artwork gets shown as itself instead — see
 * `components/ui/ambience.tsx`, which blurs the real cover behind the page. The
 * hue is the *label's* colour; the wash is the *art's*.
 *
 * A game with no genres we recognise gets the house blue rather than a hash of
 * its id. A deterministic-but-arbitrary colour would look exactly like a derived
 * one and mean nothing, which is the failure mode worth avoiding: better to say
 * "no data" in the app's own colour than to invent a fact.
 *
 * ## Why priority rather than "first genre wins"
 *
 * IGDB returns genres unordered and most games carry three or four. "Indie" and
 * "Adventure" are on half the catalogue and describe almost nothing; "Fighting"
 * and "Racing" describe almost everything about the game that has them. So the
 * list below is ordered by *how much the genre tells you*, and the first match
 * wins. Doom is a Shooter that is also an Adventure; it should be ember.
 *
 * Families deliberately share a hue — every strategy subgenre is cobalt, both
 * melee-combat genres are crimson. Ten hues across twenty-three genres is the
 * point: the wall of covers should sort into readable families, not into
 * twenty-three near-identical colours.
 */

/**
 * IGDB's genre vocabulary, strongest signal first.
 *
 * Matched as a lowercased substring, the way `platform-cases.ts` matches
 * platform names, because providers punctuate them differently
 * ("Role-playing (RPG)", "Hack and slash/Beat 'em up"). Order matters twice
 * over: for priority, and because 'strategy' would otherwise swallow
 * 'real time strategy'.
 */
const GENRE_IDENTITY: readonly { match: string; key: IdentityKey }[] = [
  { match: 'fighting', key: 'identityCrimson' },
  { match: 'hack and slash', key: 'identityCrimson' },
  { match: 'shooter', key: 'identityEmber' },
  { match: 'racing', key: 'identityLime' },
  { match: 'role-playing', key: 'identityGold' },
  { match: 'rpg', key: 'identityGold' },
  { match: 'music', key: 'identityMagenta' },
  { match: 'pinball', key: 'identityMagenta' },
  { match: 'puzzle', key: 'identityViolet' },
  { match: 'visual novel', key: 'identityViolet' },
  { match: 'point-and-click', key: 'identityViolet' },
  { match: 'sport', key: 'identityJade' },
  { match: 'card & board', key: 'identityJade' },
  { match: 'real time strategy', key: 'identityCobalt' },
  { match: 'turn-based strategy', key: 'identityCobalt' },
  { match: 'tactical', key: 'identityCobalt' },
  { match: 'moba', key: 'identityCobalt' },
  { match: 'strategy', key: 'identityCobalt' },
  { match: 'simulator', key: 'identitySky' },
  { match: 'platform', key: 'identitySky' },
  { match: 'quiz', key: 'identityGold' },
  { match: 'arcade', key: 'identityMagenta' },
  // The two weakest descriptors in the vocabulary, and so the last to win.
  { match: 'adventure', key: 'identityAqua' },
  { match: 'indie', key: 'identityAqua' },
];

/** The ramp entry for a game's genres, or null when none of them are known. */
export function identityKeyFor(genres: readonly string[] | null | undefined): IdentityKey | null {
  if (!genres || genres.length === 0) return null;

  const lowered = genres.map((genre) => genre.toLowerCase());
  for (const entry of GENRE_IDENTITY) {
    if (lowered.some((genre) => genre.includes(entry.match))) return entry.key;
  }
  return null;
}

/**
 * The hue a game lights its page with.
 *
 * Falls back to the house accent, which is the honest answer for a game whose
 * genres we have nothing for — every Steam-era row logged before the IGDB
 * cutover, for one.
 */
export function identityColorFor(
  genres: readonly string[] | null | undefined,
  theme: ThemePalette
): string {
  const key = identityKeyFor(genres);
  return key ? theme[key] : theme.primary;
}

/** Every hue in the ramp, for a swatch row or a picker. */
export function identityRamp(theme: ThemePalette): string[] {
  return IDENTITY_KEYS.map((key) => theme[key]);
}
