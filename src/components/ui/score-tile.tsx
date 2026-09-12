import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Text } from '@/components/ui/text';
import { labelFor, scoreColor } from '@/constants/score';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { readableInk } from '@/lib/color';

export type ScoreTileSize = 'small' | 'medium' | 'large';

/**
 * The three sizes, and what the number does at each.
 *
 * `band` is whether the verdict word fits underneath. At 44dp it does not —
 * eight-point type under a 20px number in a 44dp square is two lines of nothing
 * — so the small tile carries the number alone and lets its neighbours say what
 * the number means.
 */
const SIZES: Record<ScoreTileSize, { box: number; number: number; band: boolean }> = {
  small: { box: 44, number: 19, band: false },
  medium: { box: 62, number: 26, band: true },
  large: { box: 84, number: 38, band: true },
};

export type ScoreTileProps = {
  score: number;
  size?: ScoreTileSize;
  style?: ViewStyle;
};

/**
 * A score as a coloured square.
 *
 * **Square, with the corner just taken off.** It ran at `Radius.none` for a
 * while and at `Radius.image` (4dp) before that. 4 was the wrong number in the
 * other direction: at 44–84dp a 4dp corner does not read as "rounded", it reads
 * as one corner having gone soft while the rest look sharp. `Radius.lg` (8) is
 * the step where the softening is legible as a deliberate shape at every one of
 * the three sizes, and it is still far from `Radius.control` (6)… which is to
 * say it is *near* it, and that is the one thing to keep an eye on: the tile
 * must not start reading as a button. It does not, because it holds a numeral
 * rather than a word and never takes a press state.
 *
 * The shape is still doing work: it is the one element on these surfaces that is
 * not a fully rounded rectangle or a pill, which is what separates the score
 * from the controls around it without spending a second colour on the
 * distinction.
 *
 * ## The colour
 *
 * `scoreColor()` and nothing else. Score is one of the three sources CLAUDE.md
 * permits colour to come from, and this aliases onto the existing ramp rather
 * than inventing a hex — an 88 is the same green here, in a metadata row and on
 * a review page. The ink is `readableInk()`, so green and amber take the dark
 * number they need while red keeps a light one; a single fixed ink fails on at
 * least one band.
 *
 * ## Why the word is under the number
 *
 * The verdict is the second carrier. A band is a colour and a number, and
 * neither survives a protanopic reader alone — the word does, and `labelFor()`
 * is already the app's name for it.
 */
export function ScoreTile({ score, size = 'medium', style }: ScoreTileProps) {
  const theme = useTheme();
  const { box, number, band } = SIZES[size];

  const tint = scoreColor(score, theme);
  const ink = readableInk(tint);

  return (
    <View
      style={[styles.tile, { width: box, height: box, backgroundColor: tint }, style]}
      accessible
      accessibilityLabel={`Rated ${score} out of 100, ${labelFor(score)}`}>
      <Text
        variant="display"
        style={[styles.number, { color: ink, fontSize: number, lineHeight: number + 2 }]}>
        {score}
      </Text>
      {band && (
        <Text variant="caption" style={[styles.band, { color: ink }]} numberOfLines={1}>
          {labelFor(score).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  /*
   * A rectangle, and the corner is what keeps it one.
   *
   * `Radius.image` (4) rather than `Radius.lg` or the pill. A pill is this app's
   * shape for metadata you cannot press (`<Chip>`), and a run of them is exactly
   * what this sits in — so a pill here would disappear into the row it is meant
   * to lead. Four points of corner reads as a printed box score, which is what
   * it is.
   *
   * No fixed width: it is `just enough for the number and the word`, so the
   * padding sets it and "100 MASTERPIECE" grows while "7 AWFUL" does not.
   */
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.x4 + 2,
    paddingHorizontal: Spacing.x8,
    paddingVertical: 3,
    borderRadius: Radius.image,
  },
  /* The band rides slightly darker than the number on the same fill — it is the
     gloss on the figure, not a second reading of it. */
  chipBand: { opacity: 0.82 },
  /* Tight leading and negative tracking: at display size in a square this small
     the default line box pushes the band label off the bottom. */
  number: { letterSpacing: -0.5 },
  band: { fontSize: 8, letterSpacing: 0.4, opacity: 0.75, paddingHorizontal: 2 },
});

/**
 * The score as a small filled **rectangle**: "61 FAIR", the number and its word
 * on one line.
 *
 * ## Why this is not `<ScoreTile>`
 *
 * `<ScoreTile>` is a square, and a square is what you draw where the score
 * stands in for artwork — a review row's leading slot, a review page's
 * masthead. This is the opposite situation: a fact on a metadata line, sharing a
 * row with a platform mark and a playtime. A square there is a tall object in a
 * line of short ones and it sets the row's height; a rectangle sits *in* the
 * line, which is what a run of facts needs.
 *
 * It is also not `<ScoreLine>` — bare coloured digits and a word, no fill. That
 * is right where the score is the only coloured thing around. Here it shares a
 * row with a platform's brand mark and a trophy, and a fill is what keeps the
 * verdict from reading as a third icon.
 *
 * ## The colour
 *
 * `scoreColor()` fills it and `readableInk()` writes on it — the same pair
 * `<ScoreTile>` uses, for the same reason: green and amber need a dark number
 * while red needs a light one, and a single fixed ink fails on at least one
 * band. Aliasing the existing ramp rather than inventing a hex is the house rule
 * for anything that is data.
 *
 * The word is inside the fill, not beside it. Colour is never the only carrier
 * here (CLAUDE.md), and "61" alone asks the reader to supply a scale.
 */
export function ScoreChip({ score }: { score: number }) {
  const theme = useTheme();

  const rounded = Math.round(score);
  const tint = scoreColor(score, theme);
  const ink = readableInk(tint);

  return (
    <View
      style={[styles.chip, { backgroundColor: tint }]}
      accessible
      accessibilityLabel={`Rated ${rounded} out of 100, ${labelFor(score)}`}>
      <Text variant="h5" style={{ color: ink }}>
        {rounded}
      </Text>
      <Text variant="label" style={[styles.chipBand, { color: ink }]} numberOfLines={1}>
        {labelFor(score).toUpperCase()}
      </Text>
    </View>
  );
}
