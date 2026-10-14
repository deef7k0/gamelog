import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { useTabBarClearance } from '@/components/app-tab-bar';
import { LogCard } from '@/components/log-card';
import { ReviewChartHead } from '@/components/review-chart-head';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useReviewChart } from '@/hooks/use-review-chart';
import { searchReviews } from '@/lib/api';
import type { LogWithRelations } from '@/lib/database.types';
import { DEFAULT_CHART_PERIOD, PERIOD_WORDS, type ChartPeriod } from '@/lib/discovery';

const MIN_QUERY_LENGTH = 2;

/**
 * Reviews: the popular ones before a word is typed, and a search after.
 *
 * Reviews were a tab here once and were taken out, for a reason that still
 * stands: a popularity chart is not a search scope, and the field could not
 * filter it. This is the scope that answers that — typed, the field finds
 * reviews by the game they are about, by their headline, or by something they
 * say (`searchReviews`).
 *
 * **Untyped it is the chart, and the chart is Letterboxd's** (`useReviewChart`,
 * migration 0038): the reviews people liked and replied to in a period, every
 * author's best before anybody's second, in the languages the reader reads.
 * The period is a small control at the far end of the heading, as it is on
 * "Beloved by the community". It was every like since the first, in any
 * language, which is a list that stops moving.
 *
 * **Typed, nothing is left out for its language.** A search is somebody asking
 * for a thing by name; a chart is the app choosing for them. Only the second
 * may choose by language.
 *
 * The row is `<LogCard>`, the review card everywhere else: the game's title is
 * on it, which a list of reviews about many games needs.
 */
export function ReviewResults({ query }: { query: string }) {
  const clearance = useTabBarClearance();
  const isQueryable = query.length >= MIN_QUERY_LENGTH;

  const [period, setPeriod] = useState<ChartPeriod>(DEFAULT_CHART_PERIOD);
  const { chart, reading } = useReviewChart(period, !isQueryable);

  const found = useQuery({
    queryKey: ['search', 'reviews', query],
    queryFn: ({ signal }) => searchReviews(query, signal),
    enabled: isQueryable,
    /* Refine in place rather than wiping to a spinner on every pause. */
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const active = isQueryable ? found : chart;
  const reviews: LogWithRelations[] = isQueryable
    ? (found.data ?? [])
    : (chart.data?.reviews ?? []);
  /* True until the first answer says otherwise, so the heading does not draw
     as the old list's and then change its mind. */
  const windowed = chart.data?.windowed ?? true;

  /* `isPending`, not `isLoading`: the chart waits for the reader's languages,
     and a query that is waiting is not yet fetching — it is still not empty. */
  if (active.isPending) return <LoadingState />;
  if (active.isLoadingError)
    return <ErrorState error={active.error} onRetry={() => active.refetch()} />;

  return (
    <FlatList
      data={reviews}
      keyExtractor={(log) => log.id}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.content, { paddingBottom: Spacing.x48 + clearance }]}
      ItemSeparatorComponent={CardGap}
      /* The last period's cards stand, dimmed, while the chosen one is on its
         way — the cards, not the heading that holds the control being used. */
      renderItem={!isQueryable && chart.isPlaceholderData ? renderSettling : renderReview}
      /* `<LogCard>` is a tall row; a screenful, and a few either side. The
         numbers are the popular-reviews page's. */
      initialNumToRender={6}
      maxToRenderPerBatch={6}
      windowSize={7}
      /* The heading stays over an empty period: it holds the control that
         leaves it. */
      ListHeaderComponent={
        isQueryable ? null : (
          <ReviewChartHead
            period={period}
            onPeriod={setPeriod}
            windowed={windowed}
            reading={reading}
          />
        )
      }
      ListEmptyComponent={
        isQueryable ? (
          <EmptyState
            title="No reviews found"
            message={`Nothing written here mentions “${query}”. Try the game’s title.`}
          />
        ) : period === 'all' || !windowed ? (
          <EmptyState
            title="No reviews yet"
            message="Write one with a score and some words and it can be found here."
          />
        ) : (
          <EmptyState
            title={`Nothing ${PERIOD_WORDS[period]}`}
            message="Nobody wrote a review or responded to one. Try a longer period."
          />
        )
      }
    />
  );
}

/* Module scope, both of them: an inline `renderItem` or separator is a new
   function per render, and the list re-draws every row it holds for it. */
const renderReview = ({ item }: { item: LogWithRelations }) => <LogCard log={item} />;
const renderSettling = ({ item }: { item: LogWithRelations }) => (
  <View style={styles.settling}>
    <LogCard log={item} />
  </View>
);

function CardGap() {
  return <View style={styles.cardGap} />;
}

const styles = StyleSheet.create({
  /* `flexGrow: 1` so the empty state centres rather than pinning to the top. */
  content: { paddingHorizontal: Spacing.x16, paddingTop: Spacing.x8, flexGrow: 1 },
  settling: { opacity: 0.5 },
  /* The interval Home's Reviews band and the popular-reviews page keep. */
  cardGap: { height: Spacing.x12 },
});
