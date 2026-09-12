import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { GameListItem } from '@/components/game-list-item';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { SortBar } from '@/components/ui/sort-bar';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { AccentProvider } from '@/hooks/use-accent';
import { gameSortOptions, searchGamesFiltered, sortGames, type GameSort } from '@/lib/games';

/**
 * Every game in one genre.
 *
 * Where the genre grid at the top of Search leads. IGDB is asked for the genre
 * as a *relation* rather than a name substring, which is why the tile passes an
 * id — "Adventure" as text also matches "Point-and-click Adventure", and the
 * grid's whole promise is that a door leads exactly where it says.
 *
 * ## Rating leads, not relevance
 *
 * There is no search term here, so there is no relevance to sort by: IGDB
 * returns a filters-only query newest-first, which for a genre is a page of
 * things released last month. Somebody opening "Racing" is asking which racing
 * games are good, so the list is reordered by rating in memory — see
 * `sortGames` — and the other orders stay one tap away.
 *
 * ## The page runs on the genre's own colour
 *
 * `<AccentProvider genres={[name]}>` resolves the same hue the tile was drawn
 * in, so the door and the room behind it match. It is the one thing that makes
 * this feel like part of the app's colour system rather than a filtered list.
 */
const SORTS = gameSortOptions(['rating', 'newest', 'title']);

export default function GenreScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [sort, setSort] = useState<GameSort>('rating');

  const genreId = Number(id);

  const games = useQuery({
    queryKey: ['genre', genreId],
    queryFn: ({ signal }) => searchGamesFiltered({ genreId }, signal),
    enabled: Number.isFinite(genreId),
    staleTime: 30 * 60_000,
  });

  const ordered = useMemo(() => sortGames(games.data ?? [], sort), [games.data, sort]);

  /* The heading comes from the tile that linked here rather than from another
     request for IGDB's vocabulary — the caller already knows the word, and a
     page whose title arrives a beat after the page is a page that flickers. */
  const title = name?.trim() || 'Genre';

  return (
    <AccentProvider genres={[title]}>
      <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back />}>
        <View style={styles.head}>
          <Text variant="h1" accessibilityRole="header">
            {title}
          </Text>
          <Text variant="bodySmall" color="textMuted">
            Well-reviewed {title.toLowerCase()} games from the whole catalogue.
          </Text>
        </View>

        {games.isLoading ? (
          <LoadingState />
        ) : games.isError ? (
          <ErrorState error={games.error} onRetry={() => games.refetch()} />
        ) : (
          <FlatList
            data={ordered}
            keyExtractor={(game) => game.id}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => <GameListItem game={item} />}
            ListHeaderComponent={
              /* Only once there is more than one result to reorder — a sort row
                 above a single hit is chrome that does nothing. Same rule as
                 `<GameSearchResults>`. */
              ordered.length > 1 ? (
                <View style={styles.sorts}>
                  <SortBar
                    options={SORTS}
                    value={sort}
                    onChange={setSort}
                    accessibilityLabel={`Sort ${title.toLowerCase()} games`}
                  />
                </View>
              ) : null
            }
            ListEmptyComponent={
              <EmptyState
                title="Nothing here yet"
                message={`IGDB returned no ${title.toLowerCase()} games with enough ratings to rank.`}
              />
            }
          />
        )}
      </Screen>
    </AccentProvider>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: Spacing.x16, paddingBottom: Spacing.x12, gap: Spacing.x4 },
  content: { padding: Spacing.x16, gap: Spacing.x8, paddingBottom: Spacing.x48, flexGrow: 1 },
  sorts: { paddingBottom: Spacing.x4 },
});
