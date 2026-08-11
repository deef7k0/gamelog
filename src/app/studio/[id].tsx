import { useQuery } from '@tanstack/react-query';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';

import { gridItemWidth } from '@/components/gaming/game-tile';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/surface';
import { SortBar } from '@/components/ui/sort-bar';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { gameSortOptions, sortGames, type GameSort } from '@/lib/games';
import { getCompanyGames } from '@/lib/games/igdb';

/** Four across, matching the library and collection grids. */
const COLUMNS = 4;
const GAP = Spacing.x8;

/**
 * How a catalogue can be ordered.
 *
 * No "Default": IGDB returns a studio's games newest-first and there is no
 * separate relevance ranking to preserve, so an extra pill would sit there
 * meaning the same thing as "Newest".
 */
const SORTS = gameSortOptions(['newest', 'oldest', 'rating', 'title']);

/**
 * A studio's catalogue.
 *
 * Modelled on the filmography pages in the reference: a plain count, then a
 * dense poster grid. Opens newest first, because a studio page is usually
 * opened to answer "what else have they made lately" — but a prolific
 * publisher's page runs to a hundred covers, and at that length the question is
 * as often "what is their best" or "what did they start with". Hence the sort.
 *
 * Sorted in memory rather than by refetching: `getCompanyGames` already pulls
 * the whole catalogue in one query, so a round trip per sort would buy nothing.
 *
 * IGDB-only. Company ids come from `getGameExtras` and nothing else in the app
 * has an equivalent, so studio names are only tappable on IGDB titles.
 */
export default function StudioScreen() {
  const { width } = useWindowDimensions();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const companyId = Number(id);
  const [sort, setSort] = useState<GameSort>('newest');

  const games = useQuery({
    queryKey: ['studio-games', id],
    queryFn: ({ signal }) => getCompanyGames(companyId, signal),
    enabled: Number.isFinite(companyId),
    staleTime: 30 * 60_000,
  });

  const ordered = useMemo(() => sortGames(games.data ?? [], sort), [games.data, sort]);

  const tileWidth = gridItemWidth(width, COLUMNS, Spacing.x16, GAP);

  if (!Number.isFinite(companyId)) {
    return (
      <Screen edges={['bottom']} insetHeader>
        <Stack.Screen options={{ title: 'Studio' }} />
        <EmptyState title="Studio not found" />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']} insetHeader>
      <Stack.Screen options={{ title: name ?? 'Studio' }} />

      <FlatList
        data={ordered}
        key={`grid-${COLUMNS}`}
        numColumns={COLUMNS}
        keyExtractor={(game) => game.id}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Link href={{ pathname: '/game/[id]', params: { id: item.id } }} asChild>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={item.title}
              scaleTo={0.95}>
              <View style={{ width: tileWidth }}>
                <Poster
                  coverUrl={item.coverUrl}
                  heroUrl={item.heroUrl}
                  title={item.title}
                  width={tileWidth}
                  rounded="image"
                />
              </View>
            </PressableScale>
          </Link>
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            {name && <Text variant="h1">{name}</Text>}
            {games.data && (
              <Text variant="caption" color="textMuted">
                {games.data.length} {games.data.length === 1 ? 'GAME' : 'GAMES'}
              </Text>
            )}
            {/* Hidden until there is a catalogue to reorder — sorting one game
                is theatre, and the pills would show during the skeleton. */}
            {(games.data?.length ?? 0) > 1 && (
              <SortBar
                options={SORTS}
                value={sort}
                onChange={setSort}
                accessibilityLabel="Sort this studio's games"
              />
            )}
          </View>
        }
        ListEmptyComponent={
          games.isLoading ? (
            <View style={styles.skeletonGrid}>
              {Array.from({ length: 12 }).map((_, index) => (
                <Skeleton
                  key={index}
                  width={tileWidth}
                  height={tileWidth / (2 / 3)}
                  radius={Radius.image}
                />
              ))}
            </View>
          ) : games.isError ? (
            <ErrorState error={games.error} />
          ) : (
            <EmptyState title="No games found" message="IGDB has no catalogue for this studio." />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { paddingHorizontal: Spacing.x16, paddingBottom: Spacing.x48, gap: GAP },
  column: { gap: GAP },
  header: { paddingTop: Spacing.x16, paddingBottom: Spacing.x12, gap: Spacing.x8 },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
});
