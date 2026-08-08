import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { FlatList, StyleSheet, View } from 'react-native';

import { ListTile } from '@/components/list-tile';
import { LogCard } from '@/components/log-card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getEngagement, getPopularCollections, getPopularReviews } from '@/lib/api';
import { useAuth } from '@/store/auth';

/**
 * The Reviews tab: the most-liked writing on the app.
 *
 * Only logs that carry actual writing are ranked — a bare score with no words
 * is a log, not a review, and a popular-reviews list full of them would be a
 * chart of games wearing their raters' names.
 *
 * Engagement is fetched in one batch for the whole page rather than per card,
 * so the like buttons are live without twenty extra requests.
 */
export function DiscoverReviews() {
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;

  const reviews = useQuery({
    queryKey: ['discover', 'reviews'],
    queryFn: () => getPopularReviews(),
    staleTime: 5 * 60_000,
  });

  const ids = (reviews.data ?? []).map((log) => log.id);

  const engagement = useQuery({
    queryKey: ['engagement', 'log', ids, viewerId],
    queryFn: () => getEngagement('log', ids, viewerId),
    enabled: ids.length > 0,
  });

  if (reviews.isLoading) return <LoadingState />;
  if (reviews.isError) return <ErrorState error={reviews.error} />;

  return (
    <FlatList
      data={reviews.data ?? []}
      keyExtractor={(log) => log.id}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshing={reviews.isRefetching}
      onRefresh={() => reviews.refetch()}
      renderItem={({ item }) => <LogCard log={item} engagement={engagement.data?.[item.id]} />}
      ListEmptyComponent={
        <EmptyState
          title="No reviews yet"
          message="Write one with a score and some words and it will show up here."
        />
      }
    />
  );
}

/**
 * The Collections tab: the most-liked collections.
 *
 * Favourites and wishlists are excluded in SQL — they are per-user state the
 * profile renders itself, not published collections, and charting them would
 * put everyone's private wishlist in a public list. So are empty ones: a
 * collection is its games, and a title with nothing behind it is a draft.
 */
export function DiscoverCollections() {
  const theme = useTheme();

  const collections = useQuery({
    queryKey: ['discover', 'collections'],
    queryFn: () => getPopularCollections(),
    staleTime: 5 * 60_000,
  });

  if (collections.isLoading) return <LoadingState />;
  if (collections.isError) return <ErrorState error={collections.error} />;

  return (
    <FlatList
      data={collections.data ?? []}
      keyExtractor={(list) => list.id}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshing={collections.isRefetching}
      onRefresh={() => collections.refetch()}
      renderItem={({ item }) => (
        <View>
          <ListTile list={item} />
          {item.likeCount > 0 && (
            <View style={styles.likes}>
              <Ionicons name="heart" size={12} color={theme.danger} />
              <Text variant="micro" color="textMuted">
                {item.likeCount} {item.likeCount === 1 ? 'like' : 'likes'}
              </Text>
            </View>
          )}
        </View>
      )}
      ListEmptyComponent={
        <EmptyState
          title="No collections yet"
          message="Build one from the Lists tab on your profile and it can be liked here."
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.x16, paddingBottom: Spacing.x48 },
  likes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x4,
    paddingBottom: Spacing.x8,
  },
});
