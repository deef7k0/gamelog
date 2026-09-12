import { useQuery } from '@tanstack/react-query';
import { FlatList, StyleSheet, View } from 'react-native';

import { ListTile } from '@/components/list-tile';
import { LogCard } from '@/components/log-card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useCollectionEngagement } from '@/hooks/use-collection-engagement';
import { useTheme } from '@/hooks/use-theme';
import { getEngagement, getPopularCollections, getPopularReviews } from '@/lib/api';
import { useAuth } from '@/store/auth';

/**
 * The most-liked writing and the most-liked collections.
 *
 * Each one ships in two shapes and they share their query, so the band on
 * Discover and the full page behind its "See all" are guaranteed to agree:
 *
 *   - `<DiscoverReviews>` / `<DiscoverCollections>` — the whole ranked list,
 *     scrolling, refreshable. These are the `/reviews` and `/collections`
 *     routes.
 *   - `<ReviewsBand>` / `<CollectionsBand>` — the first few, as a plain `View`
 *     for a caller that is already inside a scroller.
 *
 * The band shape is a `View` and not a `FlatList` on purpose: a vertical list
 * nested inside a vertical scroller unmounts its own virtualisation and warns
 * about it, so the host owns the scrolling and the band just renders rows.
 *
 * They were tabs in Search until it was pointed out that a *popularity chart* is
 * not a *search scope* — the field could not filter either of them, so half the
 * tab bar ignored the screen's primary control. They are bands now, which is
 * what Home already does with the same content.
 */

/** How many rows a band shows before deferring to its "See all". */
const BAND_LIMIT = 3;

function usePopularReviewsData() {
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

  return { reviews, engagement };
}

function usePopularCollectionsData() {
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;

  const collections = useQuery({
    queryKey: ['discover', 'collections'],
    queryFn: () => getPopularCollections(),
    staleTime: 5 * 60_000,
  });

  const ids = (collections.data ?? []).map((list) => list.id);
  const engagement = useCollectionEngagement(ids, viewerId);

  return { collections, engagement };
}

/**
 * The most-liked writing on the app, in full.
 *
 * Only logs that carry actual writing are ranked — a bare score with no words
 * is a log, not a review, and a popular-reviews list full of them would be a
 * chart of games wearing their raters' names.
 *
 * Engagement is fetched in one batch for the whole page rather than per card,
 * so the like buttons are live without twenty extra requests.
 */
export function DiscoverReviews() {
  const { reviews, engagement } = usePopularReviewsData();

  if (reviews.isLoading) return <LoadingState />;
  if (reviews.isError)
    return <ErrorState error={reviews.error} onRetry={() => reviews.refetch()} />;

  return (
    <FlatList
      data={reviews.data ?? []}
      keyExtractor={(log) => log.id}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
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

/** The first few reviews, for a host that is already scrolling. */
export function ReviewsBand({ limit = BAND_LIMIT }: { limit?: number }) {
  const { reviews, engagement } = usePopularReviewsData();

  /* A band is supporting content, so it fails quietly: a hard error state here
     would replace someone's whole Discover feed because one section of it could
     not load. The full page behind "See all" reports properly. */
  if (reviews.isError) return null;

  const rows = (reviews.data ?? []).slice(0, limit);
  if (rows.length === 0) return null;

  return (
    <View style={styles.band}>
      {rows.map((log) => (
        <LogCard key={log.id} log={log} engagement={engagement.data?.[log.id]} />
      ))}
    </View>
  );
}

/**
 * The most-liked collections, in full.
 *
 * Favourites and wishlists are excluded in SQL — they are per-user state the
 * profile renders itself, not published collections, and charting them would
 * put everyone's private wishlist in a public list. So are empty ones: a
 * collection is its games, and a title with nothing behind it is a draft.
 */
export function DiscoverCollections() {
  const { collections, engagement } = usePopularCollectionsData();

  if (collections.isLoading) return <LoadingState />;
  if (collections.isError) {
    return <ErrorState error={collections.error} onRetry={() => collections.refetch()} />;
  }

  return (
    /* One across. The tile is a full-width row again — it now carries the
       owner's description and three counts, none of which fit under a 164dp
       square — so the two-column wrapper and the separate like badge beside it
       are both gone. The badge in particular was the tile failing to say
       something and the screen patching over it; the heart is inside the row
       now, next to the two numbers it belongs with. */
    <FlatList
      data={collections.data ?? []}
      keyExtractor={(list) => list.id}
      contentContainerStyle={styles.content}
      ItemSeparatorComponent={ListSeparator}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshing={collections.isRefetching}
      onRefresh={() => collections.refetch()}
      renderItem={({ item }) => <ListTile list={item} engagement={engagement?.[item.id]} />}
      ListEmptyComponent={
        <EmptyState
          title="No collections yet"
          /* "the Lists tab on your profile" until now. The tab is called
             Collections, the route is `new-list`, and the profile says Lists —
             one object under three names, and this line used two of them in a
             single sentence. Collections everywhere. */
          message="Build one from your profile and it can be liked here."
        />
      }
    />
  );
}

/** The first few collections, for a host that is already scrolling. */
export function CollectionsBand({ limit = BAND_LIMIT }: { limit?: number }) {
  const { collections, engagement } = usePopularCollectionsData();

  if (collections.isError) return null;

  const rows = (collections.data ?? []).slice(0, limit);
  if (rows.length === 0) return null;

  return (
    <View style={styles.band}>
      {rows.map((list, index) => (
        <View key={list.id}>
          {index > 0 && <ListSeparator />}
          <ListTile list={list} engagement={engagement?.[list.id]} />
        </View>
      ))}
    </View>
  );
}

/**
 * A hairline between collections.
 *
 * The rows have no surface of their own — a card behind each one would put a
 * container inside the page for a row that is already mostly artwork — so the
 * rule is what separates them, exactly as it does between comments.
 */
function ListSeparator() {
  const theme = useTheme();
  return <View style={[styles.separator, { backgroundColor: theme.border }]} />;
}

const styles = StyleSheet.create({
  /* `flexGrow: 1` so `ListEmptyComponent` can centre itself. `EmptyState` sets
     `flex: 1` and centres, but a content container sized to its content gives it
     nothing to fill — so the same component rendered directly was centred and
     rendered as a list's empty state was pinned to the top. */
  content: { padding: Spacing.x16, paddingBottom: Spacing.x48, flexGrow: 1 },
  band: { paddingHorizontal: Spacing.x16, gap: Spacing.x24 },
  separator: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.x20 },
});
