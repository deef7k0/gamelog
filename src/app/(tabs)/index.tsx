import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Link, useRouter } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { GameCardRail } from '@/components/game-card-rail';
import { GamePosterRail } from '@/components/game-rail';
import { HomeSection } from '@/components/home-section';
import { ListTile } from '@/components/list-tile';
import { LogCard } from '@/components/log-card';
import { ArticleCard } from '@/components/news-cards';
import { Avatar } from '@/components/ui/avatar';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ErrorState, Screen } from '@/components/ui/screen';
import { SoftGlow } from '@/components/ui/soft-glow';
import { Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useHeaderHeight } from '@/hooks/use-header-height';
import { useTopBarScroll } from '@/hooks/use-screen-chrome';
import { useTheme } from '@/hooks/use-theme';
import { getHomeReviews, getRecentCollections, getUnreadCount, getUserLogs } from '@/lib/api';
import { displayNameFor, greetingFor } from '@/lib/format';
import { recommendFromLogs } from '@/lib/games/recommend';
import { getGamingNews, getNewReleases, getUpcomingReleases } from '@/lib/news';
import { useAuth } from '@/store/auth';

/** How many news items Home shows before "See all". Enough to be worth a look. */
const NEWS_PREVIEW = 3;
/** Reviews per section. Home is a summary; the pages it links to are the lists. */
const REVIEW_PREVIEW = 3;
/** Games in the recommendation rail. Roughly five screenfuls of scrolling. */
const RECOMMENDED_LIMIT = 12;

/*
 * Glow geometry.
 *
 * Simulated rather than guessed: composited over `#121212`, this puts the
 * top-left corner at roughly 1.7:1 against the page and fades to nothing by
 * about 270dp down — which lands just past "Welcome back" and well before the
 * first rail, matching the reference.
 *
 * The previous numbers (460 / blur 90 / centre at -60,-110) measured 1.04:1,
 * i.e. invisible. See the note in `ui/soft-glow.tsx` for why; the short version
 * is that the centre must stay near the screen and `blur` is a sigma.
 *
 * **The glow belongs to the page, not to the bar.** Its centre sits at y=20,
 * which is *behind* the frosted top bar, and that is the intended composition
 * rather than an oversight: the bar has no colour of its own and no gradient in
 * it, it just blurs whatever the page put underneath. The brightest part of the
 * spotlight reaching it as a soft colour wash is the whole effect. Never give
 * the bar its own gradient to compensate — there would then be two ramps
 * meeting at the bar's bottom edge, which is a seam.
 */
const GLOW_SIZE = 620;
const GLOW_BLUR = 24;
const GLOW_X = 80;
const GLOW_Y = 20;
const GLOW_OPACITY = 0.62;

/**
 * Home.
 *
 * Not a feed. A feed answers "what did the people I follow post"; Home answers
 * "what should I look at now", and those are different questions with different
 * ingredients. The old chronological merge of posts and logs is gone — it went
 * empty the moment you followed fewer than a dozen people, and it had no way to
 * show you a game you had never heard of.
 *
 * The page opens on *you* — a greeting, your name, and games picked from what
 * you have played — and only then widens out to what everybody else is doing.
 * That order is the point: the first thing on the page should be the thing only
 * this account would see.
 *
 *   Games for you          — from your own logs, via IGDB similarity
 *   From people you follow — what your circle actually wrote     (Postgres)
 *   News                   — what happened                       (RSS)
 *   Latest releases        — what just came out                  (IGDB)
 *   Coming soon            — what is about to                    (IGDB)
 *   Fresh collections      — what people are curating            (Postgres)
 *   Newest reviews         — what anyone wrote, most recent      (Postgres)
 *
 * **The month's chart is deliberately not here.** It led the page for a while
 * and it was the least personal thing on it — a chart is the same for everyone,
 * which makes it the wrong thing to open a signed-in home screen with. It still
 * leads the Search tab, where browsing is the point, and `/top-games` is still
 * a route.
 *
 * Every band fails independently. A dead RSS feed or an IGDB outage removes one
 * section and leaves the rest of the page working, which is why nothing here
 * gates on a shared loading state.
 */
export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const headerHeight = useHeaderHeight();
  const { scrollY, onScroll } = useTopBarScroll();
  const userId = useAuth((state) => state.session?.user.id);
  const profile = useAuth((state) => state.profile);

  /*
   * The viewer's own logs, which exist for one reason on this screen: to seed
   * the recommendation rail. Cheap enough to be worth it — one indexed query
   * capped at 100 rows — and it is the only data on the page that is genuinely
   * about this account.
   */
  const logs = useQuery({
    queryKey: ['user-logs', userId],
    queryFn: () => getUserLogs(userId!),
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });

  const recommended = useQuery({
    queryKey: ['recommended', userId, logs.data?.length],
    queryFn: ({ signal }) => recommendFromLogs(logs.data ?? [], RECOMMENDED_LIMIT, signal),
    // Only once the seeds are in hand: running this on an empty array would
    // cache an empty result under a key that never re-runs.
    enabled: (logs.data?.length ?? 0) > 0,
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
    recommended.isRefetching || reviews.isRefetching || news.isRefetching || releases.isRefetching;

  function refreshAll() {
    logs.refetch();
    recommended.refetch();
    reviews.refetch();
    news.refetch();
    releases.refetch();
    upcoming.refetch();
    collections.refetch();
  }

  const name = displayNameFor(profile);
  const recommendedGames = recommended.data?.games ?? [];
  /* The band is shown while it is still working out what to put in it, so the
     heading does not appear a second after the rest of the page has settled. */
  const showRecommended = recommendedGames.length > 0 || recommended.isLoading || logs.isLoading;

  return (
    <Screen
      edges={[]}
      /* The `backdrop` slot rather than a child: it renders outside the
         safe-area inset, so the glow reaches the top of the display instead of
         starting under the status bar and drawing a hard line across it. It is
         also outside the top bar, which is the layer above — the bar blurs this,
         it does not contain it. Inert either way: the canvas takes
         `pointerEvents="none"`. */
      backdrop={
        <SoftGlow
          size={GLOW_SIZE}
          blurRadius={GLOW_BLUR}
          offsetX={GLOW_X}
          offsetY={GLOW_Y}
          opacity={GLOW_OPACITY}
        />
      }
      /* The wordmark, the greeting and the bell are the page's furniture, so
         they live in the bar rather than in the scroll content. The bar gets out
         of the way on the way down and is back the instant you scroll up, which
         is the one arrangement where an unread count is both out of the way and
         never more than a flick from view. */
      topBar={
        <FrostedTopBar
          title="GameLog"
          subtitle={greetingFor()}
          scrollY={scrollY}
          right={
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
          }
        />
      }>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.content, { paddingTop: headerHeight + Spacing.x8 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshAll}
            tintColor={theme.primary}
            /* Otherwise the spinner drops out of the very top of the display,
               behind the bar, and a pull-to-refresh looks like it did nothing. */
            progressViewOffset={headerHeight}
          />
        }>
        {/* Who you are, and a way into your own profile. Two lines rather than
            one because "Welcome back, Ada" buries the name inside a sentence —
            the name is the part worth reading, so it gets its own line at
            display weight beside the avatar. */}
        {profile && (
          <Link href="/(tabs)/profile" asChild>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`Signed in as ${name}. Open your profile.`}
              scaleTo={0.98}
              style={styles.welcome}>
              <Text variant="h4" color="textSecondary">
                Welcome back,
              </Text>
              <View style={styles.welcomeUser}>
                <Avatar uri={profile.avatar_url} name={name} size={40} />
                <Text variant="h1" numberOfLines={1} style={styles.welcomeName}>
                  {name}
                </Text>
              </View>
            </PressableScale>
          </Link>
        )}

        {showRecommended && (
          <HomeSection
            title="Games for you"
            subtitle="Based on the games you rated highest."
            seeAll="/search">
            {/* Home's three game rails all run the parallax — see the note
                above `PARALLAX_OVERSCAN` in `ui/poster.tsx`. It is one idea
                applied to one class of object, which is why it is on every
                rail here and on nothing else: the collections rail shows a
                2×2 mosaic, and four windows inside one tile is the same effect
                doing four things at once. */}
            <GameCardRail
              games={recommendedGames}
              loading={recommended.isLoading || logs.isLoading}
              parallax
            />
          </HomeSection>
        )}

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

        <HomeSection title="Latest news" seeAll="/news">
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
            <GamePosterRail games={(releases.data ?? []).slice(0, 15)} parallax />
          )}
        </HomeSection>

        <HomeSection title="Coming soon" seeAll="/upcoming">
          {upcoming.isLoading ? (
            <RailSkeleton />
          ) : (
            <GamePosterRail games={(upcoming.data ?? []).slice(0, 15)} parallax />
          )}
        </HomeSection>

        {(collections.data ?? []).length > 0 && (
          <HomeSection
            title="Fresh collections"
            subtitle="Recently updated by other people."
            seeAll="/search">
            {/* Horizontal, not stacked: the tile is a square block now, and a
                column of them would waste most of every row. */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tileRail}>
              {collections.data!.map((list) => (
                <ListTile key={list.id} list={list} />
              ))}
            </ScrollView>
          </HomeSection>
        )}

        {(reviews.data?.newest.length ?? 0) > 0 && (
          <HomeSection title="Latest reviews" seeAll="/search">
            <View style={styles.stack}>
              {reviews.data!.newest.map((log) => (
                <LogCard key={log.id} log={log} />
              ))}
            </View>
          </HomeSection>
        )}

        {/* Only when literally nothing loaded — one failed band is not worth an
            error state over the whole page. */}
        {news.isError && releases.isError && upcoming.isError && <ErrorState error={news.error} />}

        <Link href="/search" asChild>
          <PressableScale accessibilityRole="button" scaleTo={0.98} style={styles.footer}>
            <Text variant="bodySmall" color="textMuted">
              Looking for something specific? Search every game on IGDB.
            </Text>
          </PressableScale>
        </Link>
      </Animated.ScrollView>
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
  /* `x64` (48) between bands, not `x24` (18).
     
     The page's only structural rhythm, and the reason a stack of unrelated
     sections still reads as one document rather than one long scroll. At 18 the
     gap between two sections was barely larger than the gap between a heading
     and its own rail, so the headings read as captions floating in a continuous
     column. The interval separating sections has to be unmistakably bigger than
     any interval inside one. */
  content: { paddingBottom: Spacing.x48, gap: Spacing.x64 },
  welcome: { paddingHorizontal: Spacing.x16, gap: Spacing.x8, paddingTop: Spacing.x4 },
  welcomeUser: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  /* Shrinks rather than pushing the row wide — a long display name truncates
     instead of shoving the avatar off the left edge. */
  welcomeName: { flex: 1 },
  stack: { paddingHorizontal: Spacing.x16, gap: Spacing.x12 },
  /* Same 16 gap the captioned game rail uses — a block with a caption under it
     needs the gap to beat its own internal spacing, or two tiles read as one. */
  tileRail: { paddingHorizontal: Spacing.x16, gap: Spacing.x16 },
  railSkeleton: { flexDirection: 'row', gap: Spacing.x12, paddingHorizontal: Spacing.x16 },
  footer: { paddingHorizontal: Spacing.x16, paddingTop: Spacing.x8 },
});
