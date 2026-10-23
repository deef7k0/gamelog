import { StyleSheet, View } from 'react-native';

import { RatingDistribution } from '@/components/rating-distribution';
import { FiguredScore } from '@/components/ui/score-figure';
import { Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { clampScore, ratingVerdict } from '@/constants/score';
import { SHOW_SCORE_FIGURES } from '@/constants/score-figure';
import { Radius, Spacing } from '@/constants/theme';
import type { RatingBreakdown } from '@/lib/api';

export type ScoreSummaryProps = {
  /** The game whose scores the graph divides. */
  gameId: string;
  breakdown: RatingBreakdown | null;
  /** Hold the summary's shape while the numbers are on their way. */
  loading?: boolean;
  /**
   * Print "Based on N ratings" under the verdict. On in both places it is
   * drawn: the Ratings card's heading carried the count until the owner moved
   * it here (2026-10-16). Off only where something beside it already says it.
   */
  counted?: boolean;
  /**
   * Draw the graph in a card of its own (How ratings work's). Off where the
   * summary already stands in one — the Ratings card on a game's Overview.
   */
  graphCard?: boolean;
};

/**
 * GameLog's own verdict on a game: the word, the average as its drawing and
 * its number, and how the scores divide — a row for 100 and for each ten
 * below it, the owner's reference (2026-10-21, `<RatingDistribution>`).
 *
 * ```text
 *   Great                     (o_o)
 *   Based on 128 ratings       /|\  84
 *
 *     100   4 │▇▇
 *   90-99  21 │▇▇▇▇▇▇▇▇▇
 *     …
 * ```
 *
 * The average was a number in a coloured square. It is the score's drawing
 * with the number beside it now (`<FiguredScore>`): "the symbol + the number
 * rating", the owner's. This graph — here and in the reviews sheet — and a
 * review's own page are the only places the drawing is; see `<ScoreFigure>`.
 *
 * It was three segments in one bar — positive, mixed, negative. The graph says
 * the same in eleven rows, in the same three colours, and says where in the
 * green a game's scores sit, which the bar could not: the profile draws the
 * same graph for a person's own scores.
 *
 * **One component, two places**, at the owner's direction (2026-10-09): it
 * was the head of the reviews sheet, and is now also the Ratings card on a
 * game's Overview — "the very same one". It was lifted out of the sheet so
 * the two cannot drift; neither restates it. In both it stands under a heading
 * that says whose numbers these are, so it carries no label of its own.
 *
 * Every number is GameLog's own, from scores given here. The score is the
 * weighted community score (0041, `lib/community-rating`); the graph counts
 * people — each row is how many rated the game that way, at one each.
 */
export function ScoreSummary({
  gameId,
  breakdown,
  loading = false,
  counted = true,
  graphCard = true,
}: ScoreSummaryProps) {
  if (loading) {
    return (
      <View style={styles.summary}>
        <View style={styles.text}>
          <Skeleton width="55%" height={13} radius={Radius.sm} />
          <Skeleton width="40%" height={11} radius={Radius.sm} />
        </View>
        {/* The drawing and the number beside it — or, with the drawings
            off for now, the number's own size, so the summary does not
            shrink when it arrives. */}
        <Skeleton
          width={SHOW_SCORE_FIGURES ? 104 : 44}
          height={SHOW_SCORE_FIGURES ? 56 : 36}
          radius={Radius.image}
        />
      </View>
    );
  }

  if (!breakdown) return null;

  /* The score is stored unrounded (0041); this is where it is rounded, once,
     and the word and the drawing are read off the rounded number — so "55"
     never stands beside the verdict that belongs to 54.6. */
  const shown = clampScore(breakdown.average);
  const verdict = ratingVerdict(shown, breakdown.total);

  return (
    <View style={styles.block}>
      <View style={styles.summary}>
        <View style={styles.text}>
          <Text variant="h4">{verdict.label}</Text>
          {counted && (
            <Text variant="caption" color="textMuted">
              Based on {breakdown.total.toLocaleString()}{' '}
              {/* Ratings, as the strip counts them: a score with no words
                  is in this number too. */}
              {breakdown.total === 1 ? 'rating' : 'ratings'}
            </Text>
          )}
        </View>
        <FiguredScore score={shown} />
      </View>

      <RatingDistribution scope={{ gameId }} card={graphCard} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: Spacing.x16 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  text: { flex: 1, gap: 2 },
});
