import { useLocalSearchParams } from 'expo-router';

import { DiscoverReviews } from '@/components/discover-lists';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { Screen } from '@/components/ui/screen';
import { CHART_PERIODS, DEFAULT_CHART_PERIOD } from '@/lib/discovery';

/**
 * The writing people responded to most on GameLog, in full.
 *
 * Exists because Reviews stopped being a tab in Search. It was one of four
 * there, and it was the odd one out twice over: the search field could not
 * filter it, and it duplicated a band Home already had. As a route it is the
 * "See all" for both of those bands and nothing else, which is a page that can
 * be linked to and arrived at rather than a mode you have to know to switch on.
 *
 * Its name is its bar's title, and nothing under the bar explains it — the
 * owner had those lines removed (2026-10-17). The list's own heading holds the period and the languages
 * (`<ReviewChartHead>`), as it does on Search's Reviews tab — it is the same
 * chart under the same key. `?period=` opens it on the period Search's
 * Reviews tab was showing, when its "See all" is what led here.
 */
export default function ReviewsScreen() {
  const { period } = useLocalSearchParams<{ period?: string }>();
  const initial =
    CHART_PERIODS.find((option) => option.value === period)?.value ?? DEFAULT_CHART_PERIOD;

  return (
    <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back title="Reviews" />}>
      <DiscoverReviews initialPeriod={initial} />
    </Screen>
  );
}
