import { StyleSheet, View } from 'react-native';

import { ReadingNote } from '@/components/reading-note';
import { DropdownButton } from '@/components/ui/dropdown-button';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { CHART_PERIODS, type ChartPeriod } from '@/lib/discovery';

export type ReviewChartHeadProps = {
  period: ChartPeriod;
  onPeriod: (period: ChartPeriod) => void;
  /**
   * Whether the list could be asked for a period at all. False on a database
   * that has not run 0038, where it is every like there has ever been — and
   * the heading says that, with no control it could not honour.
   */
  windowed: boolean;
  /** The languages the list is in, or null for all of them. */
  reading: readonly string[] | null;
};

/**
 * The heading over the Reviews chart: what it is, the period it is read over,
 * and the languages it is in.
 *
 * The period is the control "Beloved by the community" has, at the far end of
 * the heading's line — the same window, chosen the same way, on the same tab
 * bar. "Popular", because that is what the list is now: the reviews people
 * *responded to* in the period, likes and replies both, which "Most liked"
 * (the name it had while it counted every like since the first) no longer
 * describes.
 */
export function ReviewChartHead({ period, onPeriod, windowed, reading }: ReviewChartHeadProps) {
  return (
    <View style={styles.head}>
      <View style={styles.line}>
        <Text variant="h4" accessibilityRole="header" style={styles.title}>
          {windowed ? 'Popular reviews' : 'Most liked'}
        </Text>
        {windowed && (
          <DropdownButton
            label="Period"
            size="small"
            value={period}
            options={CHART_PERIODS}
            onChange={onPeriod}
          />
        )}
      </View>

      {windowed && reading && <ReadingNote reading={reading} of="reviews" />}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { gap: Spacing.x4, paddingTop: Spacing.x8, paddingBottom: Spacing.x16 },
  line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  title: { flex: 1 },
});
