import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { labelFor, scoreColor } from '@/constants/score';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ScoreSize = 'small' | 'medium' | 'large' | 'hero';

const SIZES: Record<ScoreSize, { box: number; number: number; radius: number }> = {
  small: { box: 32, number: 15, radius: Radius.small },
  medium: { box: 44, number: 20, radius: Radius.medium },
  large: { box: 62, number: 28, radius: Radius.medium },
  hero: { box: 84, number: 40, radius: Radius.large },
};

export type ScorePillProps = {
  score: number;
  size?: ScoreSize;
  /** Show the verdict word beside the number ("Excellent"). */
  showLabel?: boolean;
};

/**
 * The 0-100 score, colour-coded by verdict.
 *
 * A filled tinted block rather than an outline — at `hero` size this is meant to
 * be the loudest element on a review, per the design brief.
 */
export function ScorePill({ score, size = 'medium', showLabel = false }: ScorePillProps) {
  const theme = useTheme();
  const tint = scoreColor(score, theme);
  const dimensions = SIZES[size];
  const label = labelFor(score);

  const box = (
    <View
      style={[
        styles.box,
        {
          minWidth: dimensions.box,
          height: dimensions.box,
          borderRadius: dimensions.radius,
          backgroundColor: `${tint}22`,
          borderColor: tint,
        },
      ]}>
      <Text style={[styles.number, { fontSize: dimensions.number, color: tint }]}>
        {Math.round(score)}
      </Text>
    </View>
  );

  if (!showLabel) return box;

  return (
    <View style={styles.withLabel}>
      {box}
      <View style={styles.labelBlock}>
        <Text variant="bodyStrong" style={{ color: tint }}>
          {label}
        </Text>
        <Text variant="micro" color="textMuted">
          out of 100
        </Text>
      </View>
    </View>
  );
}

/** The review card's badge. See `ReviewMeta` — these numbers are its spec. */
export const SCORE_SQUARE = { size: 54, radius: 12, border: 1.5, number: 24 } as const;

/**
 * The square score badge: the review's anchor.
 *
 * 54×54 with a 24px numeral. It was 80 with a 40px numeral for one revision and
 * that was a mistake worth recording: at 80 the badge plus its padding stood
 * taller than the 2:3 cover beside it, so the block that is supposed to *sit
 * under* the artwork hung below it instead. The score leads the reading order;
 * it does not have to be the biggest object on screen to do that, and the cover
 * is the one element allowed to win on size.
 *
 * Outlined with a barely-there tint rather than filled: a solid block of Ember
 * would be the loudest thing on the page, and the box art is meant to be the
 * only thing carrying real colour.
 */
export function ScoreSquare({ score }: { score: number }) {
  const theme = useTheme();
  const tint = scoreColor(score, theme);

  return (
    <View
      accessibilityLabel={`Scored ${Math.round(score)} out of 100 — ${labelFor(score)}`}
      style={[styles.square, { backgroundColor: `${tint}1A`, borderColor: tint }]}>
      <Text style={[styles.number, { fontSize: SCORE_SQUARE.number, color: tint }]}>
        {Math.round(score)}
      </Text>
    </View>
  );
}

/**
 * The score as a phrase: the number, then the word for it. "82 Very Good".
 *
 * For rows too tight for the square badge — a compact list, a diary entry. Both
 * halves carry the verdict colour, so the line is parseable at a glance the way
 * five green stars are, but a 100-point scale has fifteen verdicts and the word
 * is what stops 82 and 88 reading as the same opinion.
 */
export function ScoreLine({ score, size = 'small' }: { score: number; size?: 'small' | 'medium' }) {
  const theme = useTheme();
  const tint = scoreColor(score, theme);

  return (
    <View
      style={styles.line}
      accessibilityLabel={`Rated ${Math.round(score)} out of 100 — ${labelFor(score)}`}>
      <Text style={[styles.number, { fontSize: size === 'small' ? 17 : 21, color: tint }]}>
        {Math.round(score)}
      </Text>
      <Text
        variant={size === 'small' ? 'caption' : 'bodyStrong'}
        style={{ color: tint, fontFamily: FontFamily.semibold }}>
        {labelFor(score)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  /* Bold is reserved for page titles *and* for scores: a score is the one piece
     of data in this app that has to be readable at arm's length. */
  number: { fontFamily: FontFamily.bold },
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    paddingHorizontal: Spacing.two,
  },
  square: {
    width: SCORE_SQUARE.size,
    height: SCORE_SQUARE.size,
    borderRadius: SCORE_SQUARE.radius,
    borderWidth: SCORE_SQUARE.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  withLabel: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  labelBlock: { gap: 1 },
  /* `baseline` rather than `center`: the number is twice the label's size, and
     centring them makes the word look like it is floating. */
  line: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
});
