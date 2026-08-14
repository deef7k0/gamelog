import type { ThemePalette } from './theme';

/**
 * Achievement rarity, from a global unlock percentage.
 *
 * Steam reports what fraction of all owners has unlocked each achievement, and
 * the app has been rendering that as a bare number — "4.2%" — which is a fact
 * the reader has to rank for themselves against every other number on the
 * screen. The five-step ramp does the ranking: a player sees *legendary* before
 * they read 0.4%.
 *
 * This is the one place the app borrows a genre convention wholesale rather than
 * inventing a vocabulary, and it should stay that way. Common-through-legendary
 * in grey/green/blue/purple/gold is read fluently by everyone who has played a
 * game with loot in it, which is the entire audience.
 *
 * **Only Steam supplies the input.** IGDB has no achievement data at all, so a
 * game added through search has no rarity to show and `rarityFor(null)` returns
 * null rather than a guessed band — see PRODUCT.md's second principle.
 */
export type RarityBand = {
  /** Inclusive upper bound on the global unlock percentage. */
  below: number;
  label: string;
  token: keyof Pick<
    ThemePalette,
    'rarityCommon' | 'rarityUncommon' | 'rarityRare' | 'rarityEpic' | 'rarityLegendary'
  >;
};

/**
 * Ordered rarest → most common; the first band whose bound is met wins.
 *
 * The cuts are where Steam's own distribution actually bends rather than round
 * numbers for their own sake: below 1% is the "did anyone finish this" tier,
 * and above 50% is an achievement almost everyone gets by playing normally.
 */
export const RARITY_BANDS: readonly RarityBand[] = [
  { below: 1, label: 'Legendary', token: 'rarityLegendary' },
  { below: 5, label: 'Epic', token: 'rarityEpic' },
  { below: 20, label: 'Rare', token: 'rarityRare' },
  { below: 50, label: 'Uncommon', token: 'rarityUncommon' },
  { below: Infinity, label: 'Common', token: 'rarityCommon' },
];

export function rarityFor(globalPercent: number | null | undefined): RarityBand | null {
  if (globalPercent === null || globalPercent === undefined || !Number.isFinite(globalPercent)) {
    return null;
  }
  return RARITY_BANDS.find((band) => globalPercent < band.below) ?? RARITY_BANDS.at(-1)!;
}

export function rarityColor(
  globalPercent: number | null | undefined,
  theme: ThemePalette
): string | null {
  const band = rarityFor(globalPercent);
  return band ? theme[band.token] : null;
}
