import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { ScoreBadge } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import type { BreakdownSection } from '@/lib/review-facets';

export type ReviewBreakdownProps = {
  sections: BreakdownSection[];
  /** The stats request failed — say so rather than leave a gap. */
  failed: boolean;
  onRetry: () => void;
};

/**
 * Gamelog's own average, split by how people played: how far they got, on what,
 * and alone or together — "Finished 87 · Dropped 64".
 *
 * ## Why it sits under the headline and not behind a control
 *
 * The one average above it cannot say the most useful thing a ratings database
 * knows: whether the people who stuck with a game liked it more than the people
 * who did not. That is a reason to open the sheet, so it is on the sheet, at a
 * glance — and it is small because it is the second thing, not the first.
 *
 * ## The shape
 *
 * Two columns of `label count … score`. One full-width column put the score a
 * whole screen-width from the word it belonged to; two keep each pair together
 * and halve the height. The count sits beside the label, neutral and inline like
 * a tab's count, because an average of one rating is a different claim from an
 * average of forty and the reader should see which this is. The screen reader
 * hears the whole sentence.
 *
 * Every number is Gamelog's own. Nothing here is a third party's score.
 */
export function ReviewBreakdown({ sections, failed, onRetry }: ReviewBreakdownProps) {
  if (failed) {
    return (
      <View style={styles.failed}>
        <Text variant="caption" color="textMuted">
          The breakdown didn’t load.
        </Text>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Try loading the breakdown again"
          onPress={onRetry}
          hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
          scaleTo={0.94}>
          <Text variant="caption" color="primaryText">
            Try again
          </Text>
        </PressableScale>
      </View>
    );
  }

  if (sections.length === 0) return null;

  return (
    <View style={styles.block}>
      {sections.map((section) => (
        <View key={section.key} style={styles.section}>
          <Text variant="label" color="textMuted" accessibilityRole="header">
            {section.title.toUpperCase()}
          </Text>
          <View style={styles.grid}>
            {section.rows.map((row) => (
              <View
                key={row.key}
                style={styles.cell}
                accessible
                accessibilityLabel={`${row.label}: ${row.average} from ${row.count} ${
                  row.count === 1 ? 'rating' : 'ratings'
                }`}>
                <Text
                  variant="bodySmall"
                  color="textSecondary"
                  numberOfLines={1}
                  style={styles.label}>
                  {row.label}
                </Text>
                <Text variant="caption" color="textMuted">
                  {row.count}
                </Text>
                <View style={styles.spacer} />
                <ScoreBadge score={row.average} size="small" />
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: Spacing.x12, marginTop: Spacing.x8 },
  section: { gap: Spacing.x4 },
  /* The negative margin takes back the last column's trailing padding, so the
     right-hand scores end on the sheet's own edge like everything above them. */
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginRight: -Spacing.x16 },
  cell: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    paddingRight: Spacing.x16,
    paddingVertical: 2,
  },
  /* Shrinks and truncates before the score does — "PlayStation" is the longest
     label this can hold, and the number is the one thing it must not lose. */
  label: { flexShrink: 1 },
  spacer: { flex: 1 },
  failed: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8, marginTop: Spacing.x8 },
});
