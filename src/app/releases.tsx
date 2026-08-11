import { useQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';

import { CoverTile } from '@/components/cover-tile';
import { gridItemWidth } from '@/components/gaming/game-tile';
import { EmptyState, ErrorState, Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { getNewReleases } from '@/lib/news';

const COLUMNS = 3;
const GAP = Spacing.x12;

/**
 * Everything out in the last 45 days.
 *
 * Three across rather than the Top 10's two: this is a catalogue you scan for a
 * cover you recognise, not a ranked list you read. The tile carries a title and
 * a year and nothing else — no score, no rank — because a game that came out
 * last week has no meaningful community score yet, and printing one would be
 * inventing a consensus that does not exist.
 */
export default function ReleasesScreen() {
  const { width } = useWindowDimensions();
  const tileWidth = gridItemWidth(width, COLUMNS, Spacing.x16, GAP);

  const releases = useQuery({
    queryKey: ['news', 'new-releases'],
    queryFn: ({ signal }) => getNewReleases(signal),
    staleTime: 60 * 60_000,
  });

  return (
    <Screen edges={['bottom']} insetHeader>
      <Stack.Screen options={{ title: 'Latest releases' }} />

      <FlatList
        data={releases.data ?? []}
        key={`grid-${COLUMNS}`}
        numColumns={COLUMNS}
        keyExtractor={(game) => game.id}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshing={releases.isRefetching}
        onRefresh={() => releases.refetch()}
        ListHeaderComponent={
          <Text variant="bodySmall" color="textMuted" style={styles.note}>
            Released in the past 45 days, newest first.
          </Text>
        }
        renderItem={({ item }) => <CoverTile game={item} width={tileWidth} />}
        ListEmptyComponent={
          releases.isLoading ? (
            <View style={styles.skeleton}>
              {Array.from({ length: 9 }).map((_, index) => (
                <Skeleton key={index} width={tileWidth} height={tileWidth / (2 / 3)} />
              ))}
            </View>
          ) : releases.isError ? (
            <ErrorState error={releases.error} />
          ) : (
            <EmptyState title="Nothing new" message="IGDB has no recent releases listed." />
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
