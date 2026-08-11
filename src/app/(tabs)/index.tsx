import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Link, useRouter } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { DiscoverCarousel } from '@/components/discover-carousel';
import { GamePosterRail } from '@/components/game-rail';
import { HomeSection } from '@/components/home-section';
import { ListTile } from '@/components/list-tile';
import { LogCard } from '@/components/log-card';
import { ArticleCard } from '@/components/news-cards';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ErrorState, Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getHomeReviews, getRecentCollections, getUnreadCount } from '@/lib/api';
import { getGamingNews, getNewReleases, getPopularGames, getUpcomingReleases } from '@/lib/news';
import { useAuth } from '@/store/auth';

/** How many news items Home shows before "See all". Enough to be worth a look. */
const NEWS_PREVIEW = 3;
/** Reviews per section. Home is a summary; the pages it links to are the lists. */
const REVIEW_PREVIEW = 3;

/**
 * Home.
 *
 * Not a feed. A feed answers "what did the people I follow post"; Home answers
 * "what should I look at now", and those are different questions with different
 * ingredients. The old chronological merge of posts and logs is gone — it went
 * empty the moment you followed fewer than a dozen people, and it had no way to
 * show you a game you had never heard of.
 *
 * What replaced it is a stack of independently-sourced bands, each answering
 * one question:
 *
 *   Popular this month     — what everybody is looking at        (IGDB)
 *   From people you follow — what your circle actually wrote     (Postgres)
 *   News                   — what happened                       (RSS)
 *   Latest releases        — what just came out                  (IGDB)
 *   Coming soon            — what is about to                    (IGDB)
 *   Fresh collections      — what people are curating            (Postgres)
 *   Newest reviews         — what anyone wrote, most recent      (Postgres)
 *
 * **This is the foundation for recommendations, not the recommender.** Every
 * band is already its own query with its own ranking, so adding a personalised
 * one means adding a band and a function rather than unpicking a merged
 * timeline. `getHomeReviews` returning "followed" and "newest" separately
 * instead of blending them is the same idea: a section should be able to say
 * why it is showing you something, and a blended list cannot.
 *
 * Every band fails independently. A dead RSS feed or an IGDB outage removes one
 * section and leaves the rest of the page working, which is why nothing here
 * gates on a shared loading state.
 */
export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const userId = useAuth((state) => state.session?.user.id);

  const popular = useQuery({
    queryKey: ['popular-games', 10],
    queryFn: ({ signal }) => getPopularGames(10, signal),
    staleTime: 30 * 60_000,
  });

  const reviews = useQuery({
    queryKey: ['home-reviews', userId],
    queryFn: () => getHomeReviews(userId!, REVIEW_PREVIEW),
    enabled: !!userId,
    staleTime: 2 * 60_000,
  });

  const news = useQuery({
    queryKey: ['news', 'articles'],
    queryFn: ({ signal }) => getGamingNews(signal),
    staleTime: 15 * 60_000,
  });

  const releases = useQuery({
    queryKey: ['news', 'new-releases'],
    queryFn: ({ signal }) => getNewReleases(signal),
    staleTime: 60 * 60_000,
  });

  const upcoming = useQuery({
    queryKey: ['news', 'upcoming'],
    queryFn: ({ signal }) => getUpcomingReleases(signal),
    staleTime: 60 * 60_000,
  });

  const collections = useQuery({
    queryKey: ['home', 'recent-collections'],
    queryFn: () => getRecentCollections(6),
    staleTime: 5 * 60_000,
  });

  const unread = useQuery({
    queryKey: ['notifications', 'unread', userId],
    queryFn: () => getUnreadCount(userId!),
    enabled: !!userId,
    refetchInterval: 60_000,
  });
  const unreadCount = unread.data ?? 0;

  const refreshing =
    popular.isRefetching || reviews.isRefetching || news.isRefetching || releases.isRefetching;

  function refreshAll() {
    popular.refetch();
    reviews.refetch();
    news.refetch();
    releases.refetch();
    upcoming.refetch();
    collections.refetch();
  }

  return (
    <Screen edges={['top']}>
      <View style={styles.masthead}>
        <Text variant="display">GameLog</Text>

        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={
            unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
          }
          onPress={() => router.push('/notifications')}
          scaleTo={0.94}
          style={styles.bell}>
          <Ionicons name="notifications-outline" size={24} color={theme.text} />
          {unreadCount > 0 && (
            <View style={[styles.badge, { backgroundColor: theme.primary }]}>
              <Text variant="caption" style={{ color: theme.onPrimary }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </PressableScale>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshAll}
            tintColor={theme.primary}
          />
        }>
        {/* The month's chart, in the same rail the Search tab leads with. */}
        <HomeSection title="Popular this month" seeAll="/top-games">
          <DiscoverCarousel entries={popular.data?.entries ?? []} loading={popular.isLoading} />
        </HomeSection>

        {(reviews.data?.followed.length ?? 0) > 0 && (
          <HomeSection
            title="From people you follow"
            subtitle="The newest writing from your circle."
            seeAll="/search">
            <View style={styles.stack}>
              {reviews.data!.followed.map((log) => (
                <LogCard key={log.id} log={log} />
              ))}
            </View>
          </HomeSection>
        )}

        <HomeSection title="News" seeAll="/news">
          <View style={styles.stack}>
            {news.isLoading
              ? Array.from({ length: NEWS_PREVIEW }).map((_, index) => (
                  <Skeleton key={index} width="100%" height={96} />
                ))
              : (news.data ?? [])
                  .slice(0, NEWS_PREVIEW)
                  .map((article) => <ArticleCard key={article.id} article={article} />)}
          </View>
        </HomeSection>

        <HomeSection title="Latest releases" seeAll="/releases">
          {releases.isLoading ? (
            <RailSkeleton />
          ) : (
            <GamePosterRail games={(releases.data ?? []).slice(0, 15)} />
          )}
        </HomeSection>

        <HomeSection title="Coming soon" seeAll="/upcoming">
          {upcoming.isLoading ? (
            <RailSkeleton />
          ) : (
            <GamePosterRail games={(upcoming.data ?? []).slice(0, 15)} />
          )}
        </HomeSection>

        {(collections.data ?? []).length > 0 && (
          <HomeSection
            title="Fresh collections"
            subtitle="Recently updated by other people."
            seeAll="/search">
            <View style={styles.stack}>
              {collections.data!.map((list) => (
                <ListTile key={list.id} list={list} />
              ))}
            </View>
          </HomeSection>
        )}

        {(reviews.data?.newest.length ?? 0) > 0 && (
          <HomeSection title="Newest reviews" seeAll="/search">
            <View style={styles.stack}>
              {reviews.data!.newest.map((log) => (
                <LogCard key={log.id} log={log} />
              ))}
            </View>
          </HomeSection>
        )}

        {/* Only when literally nothing loaded — one failed band is not worth an
            error state over the whole page. */}
        {popular.isError && news.isError && releases.isError && (
          <ErrorState error={popular.error} />
        )}

        <Link href="/search" asChild>
          <PressableScale accessibilityRole="button" scaleTo={0.98} style={styles.footer}>
            <Text variant="bodySmall" color="textMuted">
              Looking for something specific? Search every game on IGDB.
            </Text>
          </PressableScale>
        </Link>
      </ScrollView>
    </Screen>
  );
}

function RailSkeleton() {
  return (
    <View style={styles.railSkeleton}>
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} width={92} height={138} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.x16,
    paddingVertical: Spacing.x12,
  },
  bell: { padding: Spacing.x8 },
  badge: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 18,
    height: 18,
    paddingHorizontal: Spacing.x4,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* 24 between bands — the page's only structural rhythm, and the reason a
     stack of unrelated sections still reads as one document. */
  content: { paddingBottom: Spacing.x48, gap: Spacing.x24 },
  stack: { paddingHorizontal: Spacing.x16, gap: Spacing.x12 },
  railSkeleton: { flexDirection: 'row', gap: Spacing.x12, paddingHorizontal: Spacing.x16 },
  footer: { paddingHorizontal: Spacing.x16, paddingTop: Spacing.x8 },
});
