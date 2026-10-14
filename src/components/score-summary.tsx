import { StyleSheet, View } from 'react-native';

import { FiguredScore } from '@/components/ui/score-figure';
import { Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { ratingVerdict } from '@/constants/score';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { RatingBreakdown } from '@/lib/api';

/** The bar's three segments, in the order they are drawn. */
const SEGMENTS = [
  { key: 'low', tone: 'scoreLow' as const, from: 0, to: 4 },
  { key: 'mid', tone: 'scoreMid' as const, from: 5, to: 6 },
  { key: 'high', tone: 'scoreHigh' as const, from: 7, to: 9 },
];

export type ScoreSummaryProps = {
  breakdown: RatingBreakdown | null;
  /** Hold the summary's shape while the numbers are on their way. */
  loading?: boolean;
  /**
   * Print "Based on N reviews" under the verdict. Off where the count is
   * already in the heading beside it.
   */
  counted?: boolean;
};

/**
 * GameLog's own verdict on a game: the word, the average as its drawing and
 * its number, and how the scores divide — positive, mixed, negative — as one
 * bar.
 *
 * ```text
 *   Great                     (o_o)
 *   Based on 128 reviews       /|\  84
 *
 *   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ▒▒▒▒  ░░
 * ```
 *
 * The average was a number in a coloured square. It is the score's drawing
 * with the number beside it now (`<FiguredScore>`): "the symbol + the number
 * rating", the owner's. This graph — here and in the reviews sheet — and a
 * review's own page are the only places the drawing is; see `<ScoreFigure>`.
 *
 * Three segments, sized by how many scores fall in each band — so a game with
 * eighty positives and two negatives shows a sliver of red, which is the
 * honest picture and the thing an average alone cannot say.
 *
 * **One component, two places**, at the owner's direction (2026-10-09): it
 * was the head of the reviews sheet, and is now also the Ratings card on a
 * game's Overview — "the very same one". It was lifted out of the sheet so
 * the two cannot drift; neither restates it. In both it stands under a heading
 * that says whose numbers these are, so it carries no label of its own.
 *
 * Every number is GameLog's own, from scores given here.
 */
export function ScoreSummary({ breakdown, loading = false, counted = true }: ScoreSummaryProps) {
  const theme = useTheme();

  if (loading) {
    return (
      <View style={styles.summary}>
        <View style={styles.text}>
          <Skeleton width="55%" height={13} radius={Radius.sm} />
          <Skeleton width="40%" height={11} radius={Radius.sm} />
        </View>
        {/* The drawing and the number beside it. */}
        <Skeleton width={104} height={56} radius={Radius.image} />
      </View>
    );
  }

  if (!breakdown) return null;

  const verdict = ratingVerdict(breakdown.average, breakdown.total);
  const counts = SEGMENTS.map((segment) =>
    breakdown.buckets.slice(segment.from, segment.to + 1).reduce((sum, n) => sum + n, 0)
  );
  const total = counts.reduce((sum, n) => sum + n, 0) || 1;

  return (
    <View style={styles.block}>
      <View style={styles.summary}>
        <View style={styles.text}>
          <Text variant="h4">{verdict.label}</Text>
          {counted && (
            <Text variant="caption" color="textMuted">
              Based on {breakdown.total} {breakdown.total === 1 ? 'review' : 'reviews'}
            </Text>
          )}
        </View>
        <FiguredScore score={breakdown.average} />
      </View>

      {/* Each segment is a flex weight, so the three always fill the bar exactly
          and no rounding gap opens between them. A band with no reviews renders
          nothing at all rather than a 1px sliver claiming one. */}
      <View
        style={styles.bar}
        accessible
        accessibilityLabel={`${counts[2]} positive, ${counts[1]} mixed, ${counts[0]} negative`}>
        {SEGMENTS.map((segment, index) =>
          counts[index] > 0 ? (
            <View
              key={segment.key}
              style={{
                flex: counts[index] / total,
                backgroundColor: theme[segment.tone],
                borderRadius: Radius.pill,
              }}
            />
          ) : null
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: Spacing.x8 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  text: { flex: 1, gap: 2 },
  /*
   * `gap`, and it is not decoration.
   *
   * Adjacent segments measure 1.17:1 against each other (amber against green) —
   * a boundary a protanopic reader cannot see at all, so the bar would read as
   * one undivided block and say nothing. Two points of page colour between them
   * is the second carrier, and the only one available to somebody looking rather
   * than listening; the accessible label carries the three counts for everyone
   * else.
   */
  bar: {
    flexDirection: 'row',
    gap: 2,
    height: 8,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
});
