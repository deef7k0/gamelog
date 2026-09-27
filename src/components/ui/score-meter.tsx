import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { MAX_SCORE, MIN_SCORE, clampScore, labelFor, scoreColor } from '@/constants/score';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';

/**
 * The number's size **and its line box**, and the second one is the fix.
 *
 * The readout used to set `fontSize` and nothing else, on a `<Text>` whose
 * variant defaults to `body` — so a 35px number sat in body copy's 18px line.
 * Android clips glyphs to their line box, and what showed was the middle band of
 * each digit with its top and bottom cut away. Any `fontSize` set outside `Type`
 * brings its own `lineHeight`, or it inherits one written for 12px type.
 */
const NUMBER_SIZE = 46;
const NUMBER_LINE = 54;

/**
 * Room for "100" at `NUMBER_SIZE`, when the readout is ranged left beside a
 * control. Tabular figures make every score the same width per digit, and this
 * floor makes 7 and 100 the same width too, so the verdict beside it does not
 * move as a score is dragged across a digit boundary.
 */
const NUMBER_FLOOR = 92;

/** The bar's thickness. A thumb's target is the input's job, not the bar's. */
export const SCORE_TRACK_HEIGHT = 14;

export type ScoreReadoutProps = {
  /** 0-100, or null when unscored. */
  score: number | null;
  /**
   * Replaces "out of 100" — the log form's "averaged from 3 metrics", or the
   * instruction it gives before anything is scored.
   */
  hint?: string;
  /**
   * `center` on a review, where the score is the verdict on the art above it and
   * sits on its axis; `start` in the form, beside the clear button.
   */
  align?: 'start' | 'center';
};

/**
 * The score as one line: the number, its verdict, and "out of 100" beside the
 * verdict — `87  AMAZING out of 100`.
 *
 * "out of 100" used to sit on a second line *under* the verdict, which made the
 * readout a two-line block beside a one-line number and set the phrase apart
 * from the word it qualifies. On the verdict's own line it reads as what it is:
 * the scale the number is on.
 *
 * The verdict and its qualifier are one `<Text>` with a nested span, so a long
 * hint wraps after the verdict instead of pushing it off the row, and the two
 * share a baseline without a layout pass. The number sits on the same baseline
 * as both — `alignItems: 'baseline'` on the row.
 *
 * Shared by the review page and the log form, so a score you set is drawn the
 * way it will be read.
 */
export function ScoreReadout({ score, hint, align = 'start' }: ScoreReadoutProps) {
  const theme = useTheme();
  const accent = useAccent();

  const scored = score !== null;
  const tint = scored ? scoreColor(score, theme) : accent.quietInk;
  const verdict = scored ? labelFor(score) : 'Not scored';
  const aside = hint ?? (scored ? 'out of 100' : null);

  return (
    <View
      style={[styles.readout, align === 'center' && styles.centred]}
      accessible
      accessibilityLabel={[scored ? `Scored ${score} out of 100 — ${verdict}` : verdict, hint]
        .filter(Boolean)
        .join('. ')}>
      <Text style={[styles.number, align === 'start' && styles.numberFloor, { color: tint }]}>
        {scored ? score : '—'}
      </Text>
      <Text variant="h2" style={[styles.verdict, { color: tint }]}>
        {/* Uppercased in the string, not by `textTransform`: the span below
            inherits every text style from this one, and "OUT OF 100" is not
            what it says. */}
        {verdict.toUpperCase()}
        {aside && (
          <Text variant="body" style={[styles.aside, { color: accent.quietInk }]}>
            {`  ${aside}`}
          </Text>
        )}
      </Text>
    </View>
  );
}

/**
 * The score as a length: a pill track, filled as far as the score reaches, in
 * the score's own colour.
 *
 * The fill is the ramp colour, not the accent. The number and the verdict above
 * it are drawn in the ramp, and a green 92 over a bar in the game's blue would be
 * two colours making one claim — `constants/score.ts` is the one place a score's
 * colour comes from. The *track* is the accent's: `accent.elevated`, the same
 * M3 container every control on a game's screens sits in.
 */
export function ScoreBar({ score, dim = false }: { score: number | null; dim?: boolean }) {
  const theme = useTheme();
  const accent = useAccent();

  const fraction = score === null ? 0 : (clampScore(score) - MIN_SCORE) / (MAX_SCORE - MIN_SCORE);
  const tint = score === null ? accent.quietInk : scoreColor(score, theme);

  return (
    <View
      style={[styles.track, { backgroundColor: accent.elevated, opacity: dim ? 0.55 : 1 }]}
      pointerEvents="none">
      <View style={[styles.fill, { width: `${fraction * 100}%`, backgroundColor: tint }]} />
    </View>
  );
}

/**
 * A score to read rather than set: the readout, centred, over its bar.
 *
 * The review page's; the log form composes the same two pieces around its own
 * touch handling in `<ScoreInput>`.
 */
export function ScoreMeter({ score }: { score: number }) {
  return (
    <View style={styles.meter}>
      <ScoreReadout score={score} align="center" />
      {/* Hidden from assistive tech: the readout already said the number, and
          a bar reads out as nothing more than a second copy of it. */}
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <ScoreBar score={score} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.x12 },
  centred: { justifyContent: 'center' },
  number: {
    fontFamily: FontFamily.bold,
    fontSize: NUMBER_SIZE,
    lineHeight: NUMBER_LINE,
    letterSpacing: -1,
    /* Every digit the same width, so the verdict does not shuffle sideways as a
       score is dragged from 79 to 81. */
    fontVariant: ['tabular-nums'],
  },
  numberFloor: { minWidth: NUMBER_FLOOR },
  /* Shrinks and wraps rather than overflowing: an instruction in place of
     "out of 100" can run longer than the line. */
  verdict: { flexShrink: 1, letterSpacing: 0.4 },
  aside: { letterSpacing: 0 },
  track: {
    height: SCORE_TRACK_HEIGHT,
    borderRadius: Radius.pill,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  fill: { height: '100%', borderRadius: Radius.pill },
  meter: { gap: Spacing.x12 },
});
