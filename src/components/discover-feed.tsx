import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { DiscoverCarousel } from '@/components/discover-carousel';
import { RecommendationRail } from '@/components/discover';
import { GameListItem } from '@/components/game-list-item';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getDiscoverGames, getPopularGames } from '@/lib/news';
import { getRecommendations } from '@/lib/news/recommendations';
import { useAuth } from '@/store/auth';

/**
 * Discover: the popular rail, "because you played…" rails, and a highly-rated
 * fallback.
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

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
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
      }>
      <View style={styles.lead}>
        <View style={styles.leadHead}>
          <View>
            <Text variant="micro" color="textMuted">
              THIS MONTH
            </Text>
            <Text variant="heading">Most Popular</Text>
          </View>

          <Link href="/top-games" asChild>
            <PressableScale accessibilityRole="button" scaleTo={0.94}>
              <Text variant="caption" color="primary">
                See all
              </Text>
            </PressableScale>
          </Link>
        </View>

        {/* Full-bleed: the rail cancels the page gutter itself so a cover can
            scroll off the edge instead of stopping short of it. */}
        <DiscoverCarousel entries={topTen.data?.entries ?? []} loading={topTen.isLoading} />
      </View>

      <View style={styles.rails}>
        {(recommendations.data ?? []).map((module) => (
          <RecommendationRail key={module.id} module={module} />
        ))}

        {/* Falls back to critically-acclaimed titles for a reader with nothing
            logged yet, so Discover is never an empty screen. */}
        <View style={styles.section}>
          <Text variant="bodyStrong">
            {(recommendations.data ?? []).length > 0 ? 'Highly rated' : 'Start here'}
          </Text>
          {(discover.data ?? []).slice(0, 20).map((game) => (
            <GameListItem key={game.id} game={game} />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.seven, gap: Spacing.five },
  lead: { gap: Spacing.three, paddingTop: Spacing.two },
  leadHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
  },
  rails: { paddingHorizontal: Spacing.four, gap: Spacing.five },
  section: { gap: Spacing.two },
});
