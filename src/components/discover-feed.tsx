import { useQuery } from '@tanstack/react-query';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { DiscoverCarousel } from '@/components/discover-carousel';
import { RecommendationRail } from '@/components/discover';
import { CollectionsBand, ReviewsBand } from '@/components/discover-lists';
import { GameListItem } from '@/components/game-list-item';
import { GenreGrid } from '@/components/genre-grid';
import { HomeSection } from '@/components/home-section';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getDiscoverGames, getPopularGames } from '@/lib/news';
import { getRecommendations } from '@/lib/news/recommendations';
import { useAuth } from '@/store/auth';

/**
 * Discover: the popular rail, "because you played…" rails, a highly-rated
 * fallback, and the app's most-liked writing and collections.
 *
 * Lives in Search rather than News. It is the answer to "what should I play
 * next", and someone with that question opens Search — News is where you go for
 * what happened this week.
 *
 * The month's chart leads as a horizontal rail of covers rather than as a hero
 * banner. A banner shows one game and a headline; the rail shows ten games and
 * lets the reader move through them without leaving the screen, which is what a
 * discovery surface is for.
 *
 * ## Reviews and Collections are bands here, not tabs
 *
 * They were two of Search's four tabs, which asserted that a *popularity chart*
 * and a *search scope* are the same kind of thing. They are not: the field could
 * not filter either one, so half the tab bar ignored the screen's primary
 * control, and the docblock explaining why ran longer than the component. As
 * bands they sit in the surface that is already about "what is worth your time",
 * and their "See all" goes to a page that is only that.
 *
 * ## Why a FlatList rather than a ScrollView
 *
 * The tail is twenty `GameListItem`s, each with box art and up to four platform
 * chips, and in a `ScrollView` every one of them mounted its image before the
 * reader had scrolled past the carousel. The head and the two bands ride along
 * as `ListHeaderComponent` / `ListFooterComponent`, so the structure is
 * unchanged and only the twenty rows are virtualised — which is the only part
 * that was ever expensive.
 *
 * Owns its own queries so the host screen stays a search screen. Query keys are
 * shared with the Top 10 route, so tapping through costs nothing.
 */
export function DiscoverFeed() {
  const theme = useTheme();
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;

  const topTen = useQuery({
    queryKey: ['popular-games', 10],
    queryFn: ({ signal }) => getPopularGames(10, signal),
    staleTime: 30 * 60_000,
  });

  const recommendations = useQuery({
    queryKey: ['discover-recommendations', viewerId],
    queryFn: ({ signal }) => getRecommendations(viewerId!, signal),
    enabled: !!viewerId,
    staleTime: 15 * 60_000,
  });

  const discover = useQuery({
    queryKey: ['news', 'discover'],
    queryFn: ({ signal }) => getDiscoverGames(signal),
    staleTime: 60 * 60_000,
  });

  const highlyRated = (discover.data ?? []).slice(0, 20);
  const personalised = (recommendations.data ?? []).length > 0;

  /*
   * `<SurpriseEntry>` used to sit between the genre grid and the popular rail,
   * borrowing two covers from `discover.data` for its deck. It lives on Home
   * now, directly under the greeting — the first thing on the first screen,
   * rather than the third band of the second one. Nothing here replaced it: the
   * grid and the chart answer "what is out there", and the door to a random pick
   * belongs with the person, not with the catalogue.
   */

  return (
    <FlatList
      data={highlyRated}
      keyExtractor={(game) => game.id}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={discover.isRefetching || topTen.isRefetching}
          onRefresh={() => {
            discover.refetch();
            topTen.refetch();
            recommendations.refetch();
          }}
          tintColor={theme.primary}
        />
      }
      /* The gutter is per-row rather than on the content container, because the
         carousel in the header is full-bleed and has to reach both edges. */
      renderItem={({ item }) => (
        <View style={styles.gutter}>
          <GameListItem game={item} />
        </View>
      )}
      ListHeaderComponent={
        <View style={styles.head}>
          {/* First, before anything ranked.
              Everything below this band answers "what is popular" or "what is
              like the thing you played" — both of which need the reader to
              already be somewhere. The genre grid is the only thing on the
              screen that works for someone who has just opened the app with no
              particular game in mind, which is why it leads. */}
          <HomeSection title="Browse by genre" subtitle="Ten ways into the catalogue.">
            <GenreGrid />
          </HomeSection>

          <HomeSection
            title="Most popular"
            subtitle="This month, across GameLog."
            seeAll="/top-games">
            {/* Full-bleed: the rail cancels the page gutter itself so a cover can
                scroll off the edge instead of stopping short of it. */}
            <DiscoverCarousel entries={topTen.data?.entries ?? []} loading={topTen.isLoading} />
          </HomeSection>

          {(recommendations.data ?? []).map((module) => (
            <RecommendationRail key={module.id} module={module} />
          ))}

          {/* Falls back to critically-acclaimed titles for a reader with nothing
              logged yet, so Discover is never an empty screen. The subtitle is
              what carries the difference now — the heading used to flip between
              "Highly rated" and "Start here" over identical content, which was
              two names for one list. */}
          <HomeSection
            title="Highly rated"
            subtitle={
              personalised
                ? 'The best-reviewed games in the catalogue.'
                : 'Somewhere to start, until you have logged enough for suggestions.'
            }
          />
        </View>
      }
      ListFooterComponent={
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
      }
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.x48 },
  /* `x64` between bands, matching Home. A section never sets its own distance
     from its neighbours — see the note in `home-section.tsx`. */
  head: { gap: Spacing.x64, paddingTop: Spacing.x8, paddingBottom: Spacing.x12 },
  foot: { gap: Spacing.x64, paddingTop: Spacing.x64 },
  gutter: { paddingHorizontal: Spacing.x16, paddingBottom: Spacing.x8 },
});
