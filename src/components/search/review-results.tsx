import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { FlatList, StyleSheet, View } from 'react-native';

import { useTabBarClearance } from '@/components/app-tab-bar';
import { LogCard } from '@/components/log-card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { getPopularReviews, searchReviews } from '@/lib/api';
import type { LogWithRelations } from '@/lib/database.types';

const MIN_QUERY_LENGTH = 2;

/**
 * Reviews: the most-liked ones before a word is typed, and a search after.
 *
 * Reviews were a tab here once and were taken out, for a reason that still
 * stands: a popularity chart is not a search scope, and the field could not
 * filter it. This is the scope that answers that — typed, the field finds
 * reviews by the game they are about, by their headline, or by something they
 * say (`searchReviews`). Untyped it is the chart Discover's Reviews band leads
 * to, the same query under the same key, so it is usually already in the cache.
 *
 * The row is `<LogCard>`, the review card everywhere else: the game's title is
 * on it, which a list of reviews about many games needs.
 */
export function ReviewResults({ query }: { query: string }) {
  const clearance = useTabBarClearance();
  const isQueryable = query.length >= MIN_QUERY_LENGTH;

  const popular = useQuery({
    queryKey: ['discover', 'reviews'],
    queryFn: () => getPopularReviews(),
    enabled: !isQueryable,
    staleTime: 5 * 60_000,
  });

  const found = useQuery({
    queryKey: ['search', 'reviews', query],
    queryFn: ({ signal }) => searchReviews(query, signal),
    enabled: isQueryable,
    /* Refine in place rather than wiping to a spinner on every pause. */
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const active = isQueryable ? found : popular;
  const reviews: LogWithRelations[] = active.data ?? [];

  if (active.isLoading) return <LoadingState />;
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
      renderItem={renderReview}
      /* `<LogCard>` is a tall row; a screenful, and a few either side. The
         numbers are the popular-reviews page's. */
      initialNumToRender={6}
      maxToRenderPerBatch={6}
      windowSize={7}
      ListHeaderComponent={
        !isQueryable && reviews.length > 0 ? (
          <Text variant="h4" accessibilityRole="header" style={styles.heading}>
            Most liked
          </Text>
        ) : null
      }
      ListEmptyComponent={
        isQueryable ? (
          <EmptyState
            title="No reviews found"
            message={`Nothing written here mentions “${query}”. Try the game’s title.`}
          />
        ) : (
          <EmptyState
            title="No reviews yet"
            message="Write one with a score and some words and it can be found here."
          />
        )
      }
    />
  );
}

/* Module scope, both of them: an inline `renderItem` or separator is a new
   function per render, and the list re-draws every row it holds for it. */
const renderReview = ({ item }: { item: LogWithRelations }) => <LogCard log={item} />;

function CardGap() {
  return <View style={styles.cardGap} />;
}

const styles = StyleSheet.create({
  /* `flexGrow: 1` so the empty state centres rather than pinning to the top. */
  content: { paddingHorizontal: Spacing.x16, paddingTop: Spacing.x8, flexGrow: 1 },
  heading: { paddingTop: Spacing.x8, paddingBottom: Spacing.x16 },
  /* The interval Home's Reviews band and the popular-reviews page keep. */
  cardGap: { height: Spacing.x12 },
});
