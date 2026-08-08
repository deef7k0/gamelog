import { useQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';

import { CoverTile } from '@/components/cover-tile';
import { gridItemWidth } from '@/components/gaming/game-tile';
import { EmptyState, ErrorState, Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { getUpcomingReleases } from '@/lib/news';

const COLUMNS = 3;
const GAP = Spacing.x12;

/**
 * Everything with a date in the next 120 days.
 *
 * Same grid as Latest releases, sorted the other way — soonest first, because
 * the useful question here is "what is nearly out", not "what is furthest
 * away". Undated games are absent by construction: IGDB's `first_release_date`
 * filter excludes them, and a wishlist of TBA titles is a different feature.
 */
export default function UpcomingScreen() {
  const { width } = useWindowDimensions();
  const tileWidth = gridItemWidth(width, COLUMNS, Spacing.x16, GAP);

  const upcoming = useQuery({
    queryKey: ['news', 'upcoming'],
    queryFn: ({ signal }) => getUpcomingReleases(signal),
    staleTime: 60 * 60_000,
  });

  return (
    <Screen edges={['bottom']} insetHeader>
      <Stack.Screen options={{ title: 'Coming soon' }} />

      <FlatList
        data={upcoming.data ?? []}
        key={`grid-${COLUMNS}`}
        numColumns={COLUMNS}
        keyExtractor={(game) => game.id}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshing={upcoming.isRefetching}
        onRefresh={() => upcoming.refetch()}
        ListHeaderComponent={
          <Text variant="caption" color="textMuted" style={styles.note}>
            Due in the next 120 days, soonest first.
          </Text>
        }
        renderItem={({ item }) => <CoverTile game={item} width={tileWidth} />}
        ListEmptyComponent={
          upcoming.isLoading ? (
            <View style={styles.skeleton}>
              {Array.from({ length: 9 }).map((_, index) => (
                <Skeleton key={index} width={tileWidth} height={tileWidth / (2 / 3)} />
              ))}
            </View>
          ) : upcoming.isError ? (
            <ErrorState error={upcoming.error} />
          ) : (
            <EmptyState title="Nothing announced" message="IGDB has no dated releases coming up." />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.x16, paddingBottom: Spacing.x48, gap: GAP },
  column: { gap: GAP },
  note: { paddingBottom: Spacing.x8 },
  skeleton: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
});
