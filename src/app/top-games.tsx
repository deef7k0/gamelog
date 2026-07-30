import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';

import { CoverTile } from '@/components/cover-tile';
import { gridItemWidth } from '@/components/gaming/game-tile';
import { EmptyState, ErrorState, Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { HeroAspectRatio, Radius, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getPopularGames } from '@/lib/news';
import type { ChartBasis } from '@/lib/news';

const TOP_N = 10;

/** Two across: the tile is art *plus* a caption, so four would truncate titles. */
const COLUMNS = 2;
const GAP = Spacing.three;

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
  const theme = useTheme();
  const { width } = useWindowDimensions();

  const chart = useQuery({
    queryKey: ['popular-games', TOP_N],
    queryFn: ({ signal }) => getPopularGames(TOP_N, signal),
    staleTime: 30 * 60_000,
  });

  const entries = chart.data?.entries ?? [];
  const lead = entries[0];
  const tileWidth = gridItemWidth(width, COLUMNS, Spacing.four, GAP);

  return (
    /*
     * No `insetHeader`: the hero is meant to run under the floating header and
     * off the top of the display, the same way the game page does.
     */
    <Screen edges={[]}>
      <Stack.Screen options={{ title: '' }} />

      <FlatList
        data={entries}
        key={`grid-${COLUMNS}`}
        numColumns={COLUMNS}
        keyExtractor={(entry) => entry.gameId}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <CoverTile
            game={{
              id: item.gameId,
              title: item.title,
              coverUrl: item.coverUrl,
              heroUrl: item.heroUrl,
              releaseYear: item.releaseYear,
            }}
            width={tileWidth}
            rank={item.rank}
          />
        )}
        ListHeaderComponent={
          <View style={styles.hero}>
            {lead?.heroUrl || lead?.coverUrl ? (
              <Image
                source={{ uri: lead.heroUrl ?? lead.coverUrl! }}
                style={styles.heroImage}
                contentFit="cover"
                transition={280}
                accessibilityIgnoresInvertColors
              />
            ) : (
              <View style={[styles.heroImage, { backgroundColor: theme.surfaceElevated }]} />
            )}

            {/* Two ramps: one to sink the art into the page, one to hold the
                headline up against whatever the number one's art happens to be. */}
            <LinearGradient
              colors={[withAlpha(theme.background, 0), theme.background]}
              style={styles.heroFade}
              pointerEvents="none"
            />
            <LinearGradient
              colors={[withAlpha('#000000', 0.55), withAlpha('#000000', 0)]}
              style={styles.heroScrim}
              pointerEvents="none"
            />

            <View style={styles.headline}>
              <Text variant="micro" style={styles.onImage}>
                THIS MONTH
              </Text>
              <Text variant="display" style={styles.onImage}>
                Top 10 Most Popular
              </Text>
            </View>
          </View>
        }
        ListFooterComponent={
          entries.length > 0 ? (
            <Text variant="micro" color="textMuted" style={styles.footnote}>
              {FOOTNOTE[chart.data!.basis]}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          chart.isLoading ? (
            <View style={styles.skeleton}>
              {Array.from({ length: TOP_N }).map((_, index) => (
                <Skeleton key={index} width={tileWidth} height={96} radius={Radius.small} />
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
  content: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.seven, gap: GAP },
  column: { gap: GAP },
  /* Cancels the list's own padding so the art reaches both edges. */
  hero: { marginHorizontal: -Spacing.four, marginBottom: Spacing.four },
  heroImage: { width: '100%', aspectRatio: HeroAspectRatio },
  heroFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '65%' },
  heroScrim: { position: 'absolute', left: 0, right: 0, top: 0, height: '45%' },
  headline: { position: 'absolute', left: Spacing.four, right: Spacing.four, bottom: Spacing.four },
  onImage: { color: '#FFFFFF' },
  skeleton: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  footnote: { paddingTop: Spacing.five },
});
