import { StyleSheet, View } from 'react-native';

import { ScoreSquare } from '@/components/ui/score';
import { Text } from '@/components/ui/text';
import { labelFor, scoreColor } from '@/constants/score';
import { STATUS_VERB } from '@/constants/status';
import { FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { LogStatus } from '@/lib/database.types';

/**
 * The review header's own metrics.
 *
 * Written out rather than pulled from `Radius`, and deliberately so: this
 * component has a spec and those numbers are the component, not instances of a
 * scale. Changing the global radius scale should not silently redraw this.
 *
 * Padding is 12, not 16. The block has to finish inside the height of the 2:3
 * cover set beside it, and four pixels on each side is the difference between
 * balanced and overhanging.
 */
export const REVIEW_META = {
  surfaceRadius: 12,
  padding: 12,
  badgeGap: 12,
} as const;

export type ReviewMetaProps = {
  /** 0-100, or null when the log carries no score. */
  score: number | null;
  gameTitle: string;
  status: LogStatus;
};

/**
 * Score badge + game identity, grouped on their own surface.
 *
 * The two read as one unit because they answer one question together — *what
 * did they think of what*. The surface is one step off the page and carries no
 * border: it groups, it does not frame. Everything else in a review card sits
 * outside it.
 *
 * The status labels take the score's colour rather than the status colour. A
 * red 12 above a green "DROPPED" would be two verdicts on the same line; the
 * whole block is one opinion and reads as one only if it is one colour. With no
 * score there is no verdict colour, so the status falls back to muted text —
 * which is correct: "PLAYED" with no rating is a fact, not a judgement.
 */
export function ReviewMeta({ score, gameTitle, status }: ReviewMetaProps) {
  const theme = useTheme();
  const tint = score === null ? theme.textMuted : scoreColor(score, theme);

  return (
    <View style={[styles.surface, { backgroundColor: theme.surface }]}>
      {score !== null && <ScoreSquare score={score} />}

      <View style={styles.info}>
        <Text variant="bodyStrong" color="textSecondary" numberOfLines={2}>
          {gameTitle}
        </Text>

        {/* One line, not two: the verdict is a single statement about a single
            game, and stacking the words made the block taller than the cover. */}
        <View style={styles.labels}>
          <Text style={[styles.label, { color: tint }]}>{STATUS_VERB[status].toUpperCase()}</Text>
          {score !== null && (
            <Text style={[styles.label, { color: tint }]}>{labelFor(score).toUpperCase()}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: REVIEW_META.badgeGap,
    padding: REVIEW_META.padding,
    borderRadius: REVIEW_META.surfaceRadius,
  },
  info: { flex: 1, gap: Spacing.one },
  labels: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  /* Uppercase at a positive tracking — without the extra letter spacing,
     capitals set this tight read as one long word rather than as a label. */
  label: { fontSize: 11, fontFamily: FontFamily.semibold, letterSpacing: 0.6 },
});
