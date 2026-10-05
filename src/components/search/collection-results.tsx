import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { FlatList, StyleSheet, View } from 'react-native';

import { useTabBarClearance } from '@/components/app-tab-bar';
import { ListTile } from '@/components/list-tile';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useCollectionEngagement } from '@/hooks/use-collection-engagement';
import { getPopularCollections, searchLists } from '@/lib/api';
import { useAuth } from '@/store/auth';

const MIN_QUERY_LENGTH = 2;

/**
 * Collections: by title once a word is typed, and the most-liked ones before.
 *
 * Untyped, this is the chart Discover's Collections band leads to — the same
 * query under the same key, so it is usually already in the cache. Typed, it is
 * a title search across everybody's authored collections (`searchLists`); the
 * two are one list on screen because they are one question, "which collection",
 * asked with and without a name.
 *
 * The row is `<ListTile>`, the collection row everywhere else, with its likes
 * and comments batched for the screenful (`useCollectionEngagement`).
 */
export function CollectionResults({ query }: { query: string }) {
  const clearance = useTabBarClearance();
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;
  const isQueryable = query.length >= MIN_QUERY_LENGTH;

  const popular = useQuery({
    queryKey: ['discover', 'collections'],
    queryFn: () => getPopularCollections(),
    enabled: !isQueryable,
    staleTime: 5 * 60_000,
  });

  const found = useQuery({
    queryKey: ['search', 'collections', query],
    queryFn: ({ signal }) => searchLists(query, signal),
    enabled: isQueryable,
    placeholderData: keepPreviousData,
  });

  const active = isQueryable ? found : popular;
  const lists = active.data ?? [];

  /* Derived from query data, so the id list is stable between renders — the
     hook keys on it. */
  const engagement = useCollectionEngagement(
    lists.map((list) => list.id),
    viewerId
  );

  if (active.isLoading) return <LoadingState />;
  if (active.isLoadingError)
    return <ErrorState error={active.error} onRetry={() => active.refetch()} />;

  return (
    <FlatList
      data={lists}
      keyExtractor={(list) => list.id}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.content, { paddingBottom: Spacing.x48 + clearance }]}
      ItemSeparatorComponent={Separator}
      renderItem={({ item }) => <ListTile list={item} engagement={engagement?.[item.id]} />}
      ListEmptyComponent={
        isQueryable ? (
          <EmptyState
            title="No collections found"
            message={`No collection is called anything like “${query}”. Try one word of its title.`}
          />
        ) : (
          <EmptyState
            title="No collections yet"
            message="Build one from your profile and it can be found here."
          />
        )
      }
    />
  );
}

/** Module scope, so the separator prop is a stable component rather than a new
    type per render. */
function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.x16, paddingTop: Spacing.x8, flexGrow: 1 },
  separator: { height: Spacing.x16 },
});
