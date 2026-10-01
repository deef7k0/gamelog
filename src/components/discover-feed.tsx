import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { CollectionsBand, ReviewsBand } from '@/components/discover-lists';
import { CoverRailSkeleton, GameCoverRail } from '@/components/game-rail';
import { GenreGrid } from '@/components/genre-grid';
import { HomeSection } from '@/components/home-section';
import { useTabBarClearance } from '@/components/app-tab-bar';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getUserLogs } from '@/lib/api';
import { getSimilarTo } from '@/lib/games';
import { getDiscoverGames, getPopularGames } from '@/lib/news';
import { recommendationSeed } from '@/lib/news/recommendations';
import { useAuth } from '@/store/auth';

/** Games in each catalogue rail: a screenful and a long scroll, not the whole list. */
const RAIL_GAMES = 20;

/** Games in the "Similar to…" rail. */
const RECOMMENDED_GAMES = 12;

/**
 * Discover, before anything is typed: a way in by genre, what is popular, the
 * one rail built from your last review, what is highly rated, and the app's
 * most-liked writing and collections.
 *
 * Lives in Search rather than News. It is the answer to "what should I play
 * next", and someone with that question opens Search — News is where you go for
 * what happened this week.
 *
 * ## One shape for every row of games
 *
 * Every row here is the game page's franchise rail (`<GameCoverRail>`): covers
 * at the album height of the owner's reference, each titled underneath. It used
 * to be three different things — a chart carousel that scaled and dimmed its
 * covers as they scrolled, a 92dp rail per recommendation, and a list of twenty
 * rows with platform chips — on the screen that was meant to be the simplest in
 * the app. The chart's rank survives as the line under each cover.
 *
 * ## One "Similar to…" rail
 *
 * It was a rail for each of your four best-rated games. There is one now, from
 * the game you reviewed last (`recommendationSeed`), and saving a review moves
 * it on: the seed is read from `['user-logs', …]`, which the log form
 * invalidates, and its games come from `['similar', gameId]`, the key the game
 * page's Similar tab shares.
 *
 * ## Reviews and Collections are bands here, not tabs
 *
 * They were two of Search's tabs, which asserted that a popularity chart and a
 * search scope are the same kind of thing. As bands they sit in the surface
 * that is already about "what is worth your time", and their "See all" goes to
 * a page that is only that.
 *
 * A `ScrollView`: nothing here is a long vertical list any more — the rails are
 * horizontal and windowed, and the bands are three cards each.
 */
export function DiscoverFeed() {
  const theme = useTheme();
  const clearance = useTabBarClearance();
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;

  const topTen = useQuery({
    queryKey: ['popular-games', 10],
    queryFn: ({ signal }) => getPopularGames(10, signal),
    staleTime: 30 * 60_000,
  });

  /* The key Home, the profile and the log form already share, so the seed is
     usually in the cache and moves the moment a review is saved. */
  const logs = useQuery({
    queryKey: ['user-logs', viewerId],
    queryFn: () => getUserLogs(viewerId!),
    enabled: !!viewerId,
  });
  const seed = useMemo(() => recommendationSeed(logs.data ?? []), [logs.data]);

  const similar = useQuery({
    queryKey: ['similar', seed?.gameId],
    queryFn: ({ signal }) => getSimilarTo(seed!.gameId, signal),
    enabled: !!seed,
    staleTime: 30 * 60_000,
  });

  const discover = useQuery({
    queryKey: ['news', 'discover'],
    queryFn: ({ signal }) => getDiscoverGames(signal),
    staleTime: 60 * 60_000,
  });

  const chart = useMemo(
    () =>
      (topTen.data?.entries ?? []).map((entry) => ({
        id: entry.gameId,
        title: entry.title,
        coverUrl: entry.coverUrl,
        heroUrl: entry.heroUrl,
        edition: entry.edition,
        releaseYear: entry.releaseYear,
        steamAppId: entry.steamAppId,
        rank: entry.rank,
      })),
    [topTen.data]
  );
  const recommended = (similar.data ?? []).slice(0, RECOMMENDED_GAMES);
  const highlyRated = (discover.data ?? []).slice(0, RAIL_GAMES);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={[styles.content, { paddingBottom: Spacing.x48 + clearance }]}
      refreshControl={
        <RefreshControl
          refreshing={discover.isRefetching || topTen.isRefetching || similar.isRefetching}
          onRefresh={() => {
            discover.refetch();
            topTen.refetch();
            if (seed) similar.refetch();
          }}
          tintColor={theme.primary}
        />
      }>
      {/* First, before anything ranked: the only band that works for someone
          with no particular game in mind. */}
      <HomeSection title="Browse by genre" subtitle="Ten ways into the catalogue.">
        <GenreGrid />
      </HomeSection>

      <HomeSection title="Most popular" subtitle="This month, across GameLog." seeAll="/top-games">
        {topTen.isLoading ? (
          <CoverRailSkeleton inset={Spacing.x16} />
        ) : (
          <GameCoverRail
            games={chart}
            subtitleOf={(game) =>
              [`No. ${game.rank}`, game.releaseYear].filter(Boolean).join(' · ')
            }
            labelOf={(game) => `Number ${game.rank} this month: ${game.title}`}
            inset={Spacing.x16}
          />
        )}
      </HomeSection>

      {seed && (similar.isLoading || recommended.length > 0) && (
        <HomeSection
          lead="Similar to"
          title={seed.title}
          subtitle="Follows the last game you reviewed.">
          {similar.isLoading ? (
            <CoverRailSkeleton inset={Spacing.x16} />
          ) : (
            <GameCoverRail games={recommended} inset={Spacing.x16} />
          )}
        </HomeSection>
      )}

      {/* Critically acclaimed titles, so Discover is never an empty screen for
          somebody with nothing logged yet. */}
      <HomeSection title="Highly rated" subtitle="The best-reviewed games in the catalogue.">
        {discover.isLoading ? (
          <CoverRailSkeleton inset={Spacing.x16} />
        ) : (
          <GameCoverRail games={highlyRated} inset={Spacing.x16} />
        )}
      </HomeSection>

      <View style={styles.foot}>
        <HomeSection
          title="Reviews"
          subtitle="The most-liked writing on GameLog."
          seeAll="/reviews">
          <ReviewsBand />
        </HomeSection>

        <HomeSection
          title="Collections"
          subtitle="Lists people are building."
          seeAll="/collections">
          <CollectionsBand />
        </HomeSection>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  /* `x32` between bands, matching Home. A section never sets its own distance
     from its neighbours — see the note in `home-section.tsx`. */
  content: { gap: Spacing.x32, paddingTop: Spacing.x8, paddingBottom: Spacing.x48 },
  foot: { gap: Spacing.x32 },
});
