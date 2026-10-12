import { useQuery } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';

import { ListTile } from '@/components/list-tile';
import { LogCard } from '@/components/log-card';
import { PageFlatList } from '@/components/ui/page-scroll';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { getPopularCollections, getPopularReviews } from '@/lib/api';

/**
 * The most-liked writing and the most-liked collections.
 *
 * Each is a full page — `<DiscoverReviews>` and `<DiscoverCollections>`, the
 * `/reviews` and `/collections` routes: the whole ranked list, scrolling,
 * refreshable.
 *
 * **Both were bands on Search's Discover too**, three cards each. The owner
 * replaced the reviews band with "Beloved by the community" — a row of the
 * games GameLog's own scores rank highest — and then had the collections band
 * taken out of the Games tab as well. Each is still what its own Search tab
 * shows before a word is typed.
 */

function usePopularReviewsData() {
  const reviews = useQuery({
    queryKey: ['discover', 'reviews'],
    queryFn: () => getPopularReviews(),
    staleTime: 5 * 60_000,
  });

  return { reviews };
}

/* No likes or comments are fetched beside these any more: the card carries the
   game count and nothing else about the response to it (see `<ListTile>`), so
   the second request a screenful of collections used to cost is gone. */
function usePopularCollectionsData() {
  const collections = useQuery({
    queryKey: ['discover', 'collections'],
    queryFn: () => getPopularCollections(),
    staleTime: 5 * 60_000,
  });

  return { collections };
}

/**
 * The most-liked writing on the app, in full.
 *
 * Only logs that carry actual writing are ranked — a bare score with no words
 * is a log, not a review, and a popular-reviews list full of them would be a
 * chart of games wearing their raters' names.
 *
 * No likes are fetched for these: the review card carries no like row (see
 * `<LogCard>`); liking happens on the review's own page.
 */
export function DiscoverReviews() {
  const { reviews } = usePopularReviewsData();

  if (reviews.isLoading) return <LoadingState />;
  if (reviews.isLoadingError)
    return <ErrorState error={reviews.error} onRetry={() => reviews.refetch()} />;

  return (
    <PageFlatList
      data={reviews.data ?? []}
      keyExtractor={(log) => log.id}
      contentContainerStyle={styles.content}
      /*
        The gap between cards, and it was missing entirely.

        `content` carried padding and nothing else, so every `<LogCard>` sat
        flush against the next and the page read as one long seam. The interval
        is the one Home's Reviews band keeps (`Spacing.x12`): a card should look
        the same on Home and behind its own "See all", and the two disagreeing
        is what made this screen look broken rather than merely tight.

        A separator rather than `gap` on the content container: `gap` there also
        applies above the first row and below the last, which would double the
        padding the container already sets.
      */
      ItemSeparatorComponent={CardGap}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshing={reviews.isRefetching}
      onRefresh={() => reviews.refetch()}
      renderItem={({ item }) => <LogCard log={item} />}
      /*
        Virtualisation, for a list with no upper bound on its length.

        `<LogCard>` is a tall row — box art, a title and three lines of review
        — so a few dozen of them mounted at once is real memory and real
        commit time. These are the FlatList half of the project's list spec:
        render a screenful, keep a handful either side, and unmount the rest.
        `removeClippedSubviews` is deliberately left at its default on Android,
        where it has a history of blanking rows inside nested transforms, and
        `<PressableScale>` puts one on every card here.
      */
      initialNumToRender={6}
      maxToRenderPerBatch={6}
      windowSize={7}
      updateCellsBatchingPeriod={50}
      ListEmptyComponent={
        <EmptyState
          title="No reviews yet"
          message="Write one with a score and some words and it will show up here."
        />
      }
    />
  );
}

/** The interval between two review cards. Module scope, so FlatList's separator
    prop is a stable reference rather than a new component type per render. */
function CardGap() {
  return <View style={styles.cardGap} />;
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
  const { collections } = usePopularCollectionsData();

  if (collections.isLoading) return <LoadingState />;
  if (collections.isLoadingError) {
    return <ErrorState error={collections.error} onRetry={() => collections.refetch()} />;
  }

  return (
    /* One across, by the owner's choice: a collection is a card holding its
       name, five covers and its owner's words, and two across those covers
       would be under forty dp wide. A screen holds about three, twelve apart —
       the interval review cards keep. */
    <PageFlatList
      data={collections.data ?? []}
      keyExtractor={(list) => list.id}
      contentContainerStyle={styles.content}
      ItemSeparatorComponent={TileGap}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshing={collections.isRefetching}
      onRefresh={() => collections.refetch()}
      renderItem={renderTile}
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

/** One row renderer for the module: a stable prop for the list. */
function renderTile({ item }: { item: Awaited<ReturnType<typeof getPopularCollections>>[number] }) {
  return <ListTile list={item} />;
}

/**
 * The space between two collections.
 *
 * It was a hairline with twenty either side, when a collection was a row of
 * text beside a small picture and needed a rule to say where one ended; then
 * thirty-two of air, when it was five covers standing on the bare page. It is a
 * card now, and cards stack twelve apart.
 */
function TileGap() {
  return <View style={styles.tileGap} />;
}

const styles = StyleSheet.create({
  /* `flexGrow: 1` so `ListEmptyComponent` can centre itself. `EmptyState` sets
     `flex: 1` and centres, but a content container sized to its content gives it
     nothing to fill — so the same component rendered directly was centred and
     rendered as a list's empty state was pinned to the top. */
  content: { padding: Spacing.x16, paddingBottom: Spacing.x48, flexGrow: 1 },
  /* The interval between review cards everywhere they are stacked: this page,
     Search, a profile. */
  cardGap: { height: Spacing.x12 },
  tileGap: { height: Spacing.x12 },
});
