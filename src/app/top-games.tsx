import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';

import { CoverTile } from '@/components/cover-tile';
import { gridItemWidth } from '@/components/gaming/game-tile';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { HeroArt } from '@/components/ui/hero-art';
import { EmptyState, ErrorState, Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTopBarScroll } from '@/hooks/use-screen-chrome';
import { getPopularGames } from '@/lib/news';
import type { ChartBasis } from '@/lib/news';

const TOP_N = 10;

/** Two across: the tile is art *plus* a caption, so four would truncate titles. */
const COLUMNS = 2;
const GAP = Spacing.x12;

/**
 * Top 10 most popular games this month.
 *
 * Built like a magazine spread rather than a leaderboard: the number one's key
 * art fills the top of the screen with the headline over it, and the ten sit
 * underneath as bare covers with a title and a year. The previous version was a
 * stack of surface rows carrying a display-size rank, a peak-player count and a
 * movement arrow — chart furniture that pushed the artwork down to a thumbnail
 * and made ten games look like a spreadsheet.
 *
 * Monthly, not weekly: a week of IGDB interest moves too little for the list to
 * look different between visits, so a returning reader saw the same ten games
 * with the word "week" quietly contradicting them.
 */
export default function TopGamesScreen() {
  const { width } = useWindowDimensions();
  const { onScroll } = useTopBarScroll();

  const chart = useQuery({
    queryKey: ['popular-games', TOP_N],
    queryFn: ({ signal }) => getPopularGames(TOP_N, signal),
    staleTime: 30 * 60_000,
  });

  const entries = chart.data?.entries ?? [];

  /*
   * Mapped once, not per render.
   *
   * `<CoverTile>` is memoised, and a memo is only ever as good as the identity
   * of what it is handed: building `game={{ … }}` inside `renderItem` mints a
   * fresh object for every row on every render, so the comparison never matches
   * and the memo costs a shallow compare to achieve nothing. Hoisting the map
   * behind `useMemo` gives each row one stable object for the life of the data,
   * which is the condition that makes the memo real.
   */
  const tiles = useMemo(
    () =>
      (chart.data?.entries ?? []).map((item) => ({
        rank: item.rank,
        game: {
          id: item.gameId,
          title: item.title,
          coverUrl: item.coverUrl,
          heroUrl: item.heroUrl,
          releaseYear: item.releaseYear,
          edition: item.edition,
          steamAppId: item.steamAppId,
        },
      })),
    /* Keyed on `chart.data`, not on `entries` — `?? []` mints a fresh array
       every render while the query is pending, which would re-run this memo on
       every render and defeat the very thing it exists for. */
    [chart.data]
  );
  const lead = entries[0];
  const tileWidth = gridItemWidth(width, COLUMNS, Spacing.x16, GAP);

  return (
    /*
     * No `insetHeader`, and no title: the hero runs under the bar and off the
     * top of the display, the same way the game page does, and the headline
     * printed over that art already says "Top 10 Most Popular". Repeating it in
     * the bar would be the same words twice, 40dp apart.
     */
    <Screen edges={[]} topBar={<FrostedTopBar back />}>
      <Animated.FlatList
        data={tiles}
        onScroll={onScroll}
        scrollEventThrottle={16}
        key={`grid-${COLUMNS}`}
        numColumns={COLUMNS}
        keyExtractor={(tile) => tile.game.id}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <CoverTile game={item.game} width={tileWidth} rank={item.rank} />}
        ListHeaderComponent={
          <View style={styles.hero}>
            <HeroArt uri={lead?.heroUrl ?? lead?.coverUrl} scrim />

            <View style={styles.headline}>
              <Text variant="caption" color="onPrimary">
                THIS MONTH
              </Text>
              <Text variant="display" color="onPrimary">
                Top 10 Most Popular
              </Text>
            </View>
          </View>
        }
        ListFooterComponent={
          entries.length > 0 ? (
            <Text variant="caption" color="textMuted" style={styles.footnote}>
              {FOOTNOTE[chart.data!.basis]}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          chart.isLoading ? (
            <View style={styles.skeleton}>
              {Array.from({ length: TOP_N }).map((_, index) => (
                <Skeleton key={index} width={tileWidth} height={96} radius={Radius.image} />
              ))}
            </View>
          ) : chart.isError ? (
            <ErrorState error={chart.error} />
          ) : (
            <EmptyState title="No chart data" message="IGDB did not return a chart right now." />
          )
        }
      />
    </Screen>
  );
}

/**
 * The two rankings measure different things, so the screen says which one it
 * got rather than printing a single claim that is right half the time.
 */
const FOOTNOTE: Record<ChartBasis, string> = {
  'igdb-popularity': 'Ranked by how many people are viewing each game on IGDB right now.',
  'community-ratings':
    "IGDB's popularity feed is unavailable, so this ranks the most-rated releases of the past year instead.",
};

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.x16, paddingBottom: Spacing.x48, gap: GAP },
  column: { gap: GAP },
  /* Cancels the list's own padding so the art reaches both edges. */
  hero: { marginHorizontal: -Spacing.x16, marginBottom: Spacing.x16 },
  headline: { position: 'absolute', left: Spacing.x16, right: Spacing.x16, bottom: Spacing.x16 },

  skeleton: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  footnote: { paddingTop: Spacing.x24 },
});
