import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigation, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { RefreshControl, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
} from 'react-native-reanimated';

import { GameCardRail } from '@/components/game-card-rail';
import { GamePosterRail } from '@/components/game-rail';
import { HomeSection } from '@/components/home-section';
import { LogCard } from '@/components/log-card';
import { ArticleCard } from '@/components/news-cards';
import { SurpriseEntry } from '@/components/surprise-entry';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, Screen } from '@/components/ui/screen';
import { SoftGlow } from '@/components/ui/soft-glow';
import { Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { HeroAspectRatio, Radius, Spacing, TapTarget } from '@/constants/theme';
import { useTopBarScroll } from '@/hooks/use-screen-chrome';
import { useTheme } from '@/hooks/use-theme';
import { getEngagement, getHomeReviews, getUnreadCount, getUserLogs } from '@/lib/api';
import { displayNameFor, greetingFor } from '@/lib/format';
import { recommendFromLogs } from '@/lib/games/recommend';
import { getGamingNews, getNewReleases, getUpcomingReleases } from '@/lib/news';
import { useAuth } from '@/store/auth';

/** How many news items Home shows before "See all". Enough to be worth a look. */
const NEWS_PREVIEW = 3;
/** Reviews per band. Home is a summary; the pages it links to are the lists. */
const REVIEW_PREVIEW = 3;
/** Games in the recommendation rail. Roughly five screenfuls of scrolling. */
const RECOMMENDED_LIMIT = 12;
/** Posters in the merged releases rail, split evenly between out-now and upcoming. */
const RELEASES_PER_HALF = 10;

/*
 * Glow geometry.
 *
 * Simulated rather than guessed: composited over the page colour, this puts the
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
 * How far the page scrolls before the glow is gone.
 *
 * The glow renders into `<Screen backdrop>`, which is fixed to the viewport
 * rather than to the document — so without this it stays at full strength
 * through six screenfuls of content that scroll *through* it. That is both a
 * composition error (it is the page's opening gesture, and an opening gesture
 * that never ends is a wash) and a measured accessibility failure: the bar
 * hides after 56dp, and past that, text crossing the glow's brightest region
 * loses the bar's 30% scrim. Composited at full strength the worst pixel is
 * `#493666`, where `textMuted` measures **3.24:1** and `primaryText` 3.22:1 —
 * both under AA, and `GamePosterRail`'s year caption is `textMuted` at 10px.
 *
 * 260 is just past the recommendation rail, so the glow covers the masthead it
 * was drawn for and is out of the way before anything scrolls into it.
 */
const GLOW_FADE_DISTANCE = 260;

/**
 * Roughly what an `<ArticleCard>` comes to, minus its image.
 *
 * Headline (2 lines of `h4`), outlet and timestamp, and the card's padding. The
 * image is the variable part and is measured from the viewport, so the skeleton
 * matches the real card at any width. See `newsCardHeight`.
 */
const ARTICLE_CHROME_HEIGHT = 140;

/**
 * A news skeleton the same height as the card that replaces it.
 *
 * It was a flat 96 against a real card of ~350, so the placeholder understated
 * what was coming by 3.6× and the band grew ~760dp *in place* as three of them
 * resolved — moving everything below it while someone was reading. A skeleton
 * that lies about its size is worse than no skeleton, because the page commits
 * to a layout it is about to abandon.
 */
function newsCardHeight(width: number): number {
  return Math.round((width - Spacing.x16 * 2) / HeroAspectRatio + ARTICLE_CHROME_HEIGHT);
}

/**
 * Home.
 *
 * Not a feed. A feed answers "what did the people I follow post"; Home answers
 * "what should I look at now", and those are different questions with different
 * ingredients.
 *
 * **Four bands, and the order is the argument.** The page opens on *you* and
 * widens outward — what you might play, what people wrote, what came out, what
 * happened. Every band is a different question; none of them is a second
 * helping of the one above it.
 *
 *   Games for you  — from your own logs, via IGDB similarity
 *   Reviews        — your circle first, then everyone else   (Postgres)
 *   Releases       — just out, and what is next              (IGDB)
 *   Latest news    — what happened                           (RSS)
 *
 * It used to be seven. Two pairs of those were the same band twice: "Latest
 * releases" and "Coming soon" were both 92dp poster rails with an inverted date
 * predicate, rendered back to back; "From people you follow" and "Latest
 * reviews" were the same component from the same query, separated by ~2,900dp
 * of other content, and `newest` is *defined* as the residue after `followed`
 * is removed. Reaching the bottom and finding a section indistinguishable from
 * one you read five screens earlier is what a page assembled from queries feels
 * like. Both pairs are now single bands, which also took the page from ~5,100dp
 * to roughly 3,000 and cut the share of it that is review cards from 51% to
 * about a third.
 *
 * **"Fresh collections" was cut rather than merged.** It had no sibling to
 * merge with and it was the most expensive band on the page — a plain
 * horizontal `ScrollView`, so six tiles × four mosaic covers meant 24 images
 * fetched unconditionally with no windowing, most of them never seen.
 * Collections are still reachable from Search and from any profile. If it comes
 * back it should come back as a `FlatList`.
 *
 * **The month's chart is deliberately not here.** It led the page for a while
 * and it was the least personal thing on it — a chart is the same for everyone,
 * which makes it the wrong thing to open a signed-in home screen with. It still
 * leads the Search tab, where browsing is the point, and `/top-games` is still
 * a route.
 *
 * Every band fails independently and says so where it happens — one dead RSS
 * feed removes one band's contents and leaves the rest of the page working,
 * which is why nothing here gates on a shared loading state.
 */
export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const { scrollY, onScroll } = useTopBarScroll();
  const userId = useAuth((state) => state.session?.user.id);
  const profile = useAuth((state) => state.profile);

  /*
   * Tapping the active tab returns to the top.
   *
   * The platform convention on every tab bar, and this page needs it more than
   * most: it hides its own bar on the way down, so without this the only way
   * back to the notification bell from the footer is a long reverse flick.
   */
  const scroller = useAnimatedRef<Animated.ScrollView>();

  useEffect(() => {
    const unsubscribe = navigation.addListener(
      // @ts-expect-error — `tabPress` is contributed by the Tabs navigator and
      // is not in the generic navigation event map this hook is typed against.
      'tabPress',
      () => scroller.current?.scrollTo({ y: 0, animated: true })
    );
    return unsubscribe;
  }, [navigation, scroller]);

  /*
   * The viewer's own logs, which do two jobs on this screen: they seed the
   * recommendation rail, and their *count* is what decides whether this is a
   * first run. Cheap enough to be worth it — one indexed query capped at 100
   * rows — and it is the only data on the page genuinely about this account.
   */
  const logs = useQuery({
    queryKey: ['user-logs', userId],
    queryFn: () => getUserLogs(userId!),
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });

  /*
   * Keyed on what the seeds *are*, not how many there are.
   *
   * The key used to be `logs.data?.length`, which is a proxy that happens to
   * work until someone edits a rating without adding a log — then the rail
   * stays stale for the full 30 minutes while the input to it has changed. It
   * also made `refreshAll` fetch twice: the manual refetch ran against the old
   * logs, then the count changed and the new key ran again.
   */
  const seedKey = (logs.data ?? [])
    .slice(0, 20)
    .map((log) => `${log.game_id}:${log.rating ?? ''}`)
    .join(',');

  const recommended = useQuery({
    queryKey: ['recommended', userId, seedKey],
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

  /*
   * Likes and comments for both halves of the Reviews band, in one batch.
   *
   * Home used to render `<LogCard>` with no `engagement` prop at all, which
   * made the screen where you read your circle's writing the one place you
   * could not answer it. `DiscoverReviews` already pays this exact cost — two
   * queries for a whole page — so the batch is keyed and shaped to match it.
   */
  const reviewIds = [...(reviews.data?.followed ?? []), ...(reviews.data?.newest ?? [])].map(
    (log) => log.id
  );

  const engagement = useQuery({
    queryKey: ['engagement', 'log', reviewIds, userId ?? null],
    queryFn: () => getEngagement('log', reviewIds, userId ?? null),
    enabled: reviewIds.length > 0,
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

  const unread = useQuery({
    queryKey: ['notifications', 'unread', userId],
    queryFn: () => getUnreadCount(userId!),
    enabled: !!userId,
    refetchInterval: 60_000,
  });
  const unreadCount = unread.data ?? 0;

  /* Watches every band the pull actually refetches, so the spinner stops when
     the page is done rather than when the first four queries are. */
  const refreshing =
    logs.isRefetching ||
    recommended.isRefetching ||
    reviews.isRefetching ||
    engagement.isRefetching ||
    news.isRefetching ||
    releases.isRefetching ||
    upcoming.isRefetching;

  function refreshAll() {
    logs.refetch();
    recommended.refetch();
    reviews.refetch();
    engagement.refetch();
    news.refetch();
    releases.refetch();
    upcoming.refetch();
  }

  const name = displayNameFor(profile);
  const recommendedGames = recommended.data?.games ?? [];

  /*
   * A first run is "no logs", and it is only knowable once the query resolves.
   *
   * `logs.isSuccess` rather than `!logs.isLoading`: an errored logs query is
   * not an empty account, and showing someone a "log your first game" block
   * because their connection dropped would be the app telling them their own
   * library is gone.
   */
  const isFirstRun = logs.isSuccess && (logs.data?.length ?? 0) === 0;
  const seedsPending = logs.isLoading || (logs.isSuccess && !isFirstRun && recommended.isLoading);

  /* Just out, then what is next — one continuous timeline rather than two rails
     of near-identical posters with a 48dp gap and a 19px heading between them.
     The year under each poster is what separates the halves. */
  const releaseRail = [
    ...(releases.data ?? []).slice(0, RELEASES_PER_HALF),
    ...(upcoming.data ?? []).slice(0, RELEASES_PER_HALF),
  ];

  /*
   * The two covers behind Surprise Me's face-down card.
   *
   * Borrowed from bands this page has already fetched, so the deck is real box
   * art for the price of a slice — a query of its own would spend a request to
   * decorate a link. Recommendations first because they are this account's own
   * games; releases are the fallback for a first run, where there are no
   * recommendations and the deck would otherwise show two blanks.
   *
   * Keyed on the query data rather than on `recommendedGames`/`releaseRail`,
   * which are fresh arrays every render and would defeat the memo — and with it
   * `<SurpriseEntry>`'s own, which is the point of memoising here at all.
   */
  const deckCovers = useMemo(() => {
    const pool = recommended.data?.games?.length ? recommended.data.games : (releases.data ?? []);
    return pool
      .filter((game) => game.coverUrl)
      .slice(0, 2)
      .map((game) => ({ coverUrl: game.coverUrl, heroUrl: game.heroUrl }));
  }, [recommended.data, releases.data]);

  const followed = reviews.data?.followed ?? [];
  const newest = reviews.data?.newest ?? [];
  const hasReviews = followed.length > 0 || newest.length > 0;

  /* Fixed to the viewport, so it has to be told when the page has moved past
     it. See `GLOW_FADE_DISTANCE`. */
  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [0, GLOW_FADE_DISTANCE], [1, 0], Extrapolation.CLAMP),
  }));

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
        <Animated.View style={glowStyle} pointerEvents="none">
          <SoftGlow
            size={GLOW_SIZE}
            blurRadius={GLOW_BLUR}
            offsetX={GLOW_X}
            offsetY={GLOW_Y}
            opacity={GLOW_OPACITY}
          />
        </Animated.View>
      }>
      <Animated.ScrollView
        ref={scroller}
        onScroll={onScroll}
        scrollEventThrottle={16}
        /*
         * Bands resolve at different times and some of them are over a thousand
         * dp tall. Without this, a band landing above the viewport teleports
         * whoever is reading below it — and the person this app is built for is
         * one-handed, interrupted, and on whatever connection the sofa gets.
         * `minIndexForVisible: 1` anchors to the first child rather than the
         * scroll origin, so a pull-to-refresh still behaves.
         */
        maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshAll}
            tintColor={theme.primary}
            /* Otherwise the spinner drops out of the very top of the display,
               behind the bar, and a pull-to-refresh looks like it did nothing. */
            progressViewOffset={Spacing.x24}
          />
        }>
        {/*
          The app's own header, and it is *in the scroll*.

          Not a `<Screen topBar>`: a floating bar draws over the page and has to
          be paid for with reserved space, and Home is a root tab — there is
          nothing to go back to, so the only thing a floating layer would carry
          here is two icons. As a first row it scrolls away with the content,
          which is the arrangement the reference uses and the honest one: the
          furniture is part of the page, not a lid on it.

          The two controls are the two that are not about a game: what happened
          while you were away, and how the app behaves.
        */}
        <View style={styles.masthead}>
          <View style={styles.mastheadTitles}>
            <Text variant="h2">GameLog</Text>
            <Text variant="bodySmall" color="textMuted">
              {greetingFor()}
            </Text>
          </View>

          <View style={styles.mastheadActions}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={
                unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
              }
              onPress={() => router.push('/notifications')}
              scaleTo={0.94}
              style={StyleSheet.flatten(styles.bell)}>
              <Ionicons name="notifications-outline" size={24} color={theme.text} />
              {unreadCount > 0 && (
                <View style={[styles.badge, { backgroundColor: theme.primary }]}>
                  <Text variant="caption" style={{ color: theme.onPrimary }}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </PressableScale>

            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Settings"
              onPress={() => router.push('/settings')}
              scaleTo={0.94}
              style={StyleSheet.flatten(styles.bell)}>
              <Ionicons name="settings-outline" size={22} color={theme.text} />
            </PressableScale>
          </View>
        </View>

        {/* Who you are, and a way into your own profile. Two lines rather than
            one because "Welcome back, Ada" buries the name inside a sentence —
            the name is the part worth reading, so it gets its own line at
            display weight beside the avatar. */}
        {profile && (
          <Link href="/(tabs)/profile" asChild>
            <PressableScale
              accessibilityRole="link"
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

        {/*
          The one way into the app that asks for nothing.

          Directly under the greeting, above every band, because it is the answer
          for the person who opened the app without a game in mind — and every
          band below this one needs you to already be somewhere. It works on a
          brand-new account too, which none of the personal bands do.
        */}
        <SurpriseEntry covers={deckCovers} />

        {/*
         * Band 1 — what you might play, or, on a first run, the ask.
         *
         * This slot used to render its heading and five skeleton cards for a
         * brand-new account and then **delete itself** once `logs` resolved
         * empty, because the guard included `logs.isLoading`. The first thing a
         * new user saw was a promise being withdrawn — and the three social
         * bands below it were all gated on data that account cannot have, so
         * Home showed three of seven bands, none of which mentioned the one
         * thing this product exists for.
         *
         * PRODUCT.md's success metric is someone coming back to write about a
         * *second* game. Nothing on this page moved anyone toward the first.
         */}
        {isFirstRun ? (
          <View style={styles.firstRun}>
            <EmptyState
              title="Start your shelf"
              message="Log the last game you finished — a status, a score, and as much or as little as you want to say about it."
              action={
                <Button
                  title="Find a game"
                  onPress={() => router.push('/(tabs)/search')}
                  icon="search"
                />
              }
            />
          </View>
        ) : (
          (recommendedGames.length > 0 || seedsPending) && (
            <HomeSection
              title="Games for you"
              /* Not "rated highest": `recommendFromLogs` seeds from logs with a
                 null rating too, so the old subtitle described a filter that
                 does not exist. */
              subtitle="Based on the games you've played.">
              {/* Home's game rails run the parallax — see the note above
                  `PARALLAX_OVERSCAN` in `ui/poster.tsx`. */}
              <GameCardRail games={recommendedGames} loading={seedsPending} parallax />
            </HomeSection>
          )
        )}

        {/*
         * Band 2 — the writing. Your circle first, then everyone else.
         *
         * One band, not two. These were the same component fed by the same
         * query, and `newest` is literally what is left after `followed` is
         * subtracted — so as two bands 2,900dp apart they read as the page
         * repeating itself. Adjacent, with a rule and a label between them, the
         * distinction the data actually makes is legible in one glance.
         */}
        {reviews.isLoading ? (
          <HomeSection title="Reviews" subtitle="From your circle, and everyone else.">
            <View style={styles.stack}>
              {Array.from({ length: REVIEW_PREVIEW }).map((_, index) => (
                <Skeleton key={index} width="100%" height={REVIEW_CARD_HEIGHT} />
              ))}
            </View>
          </HomeSection>
        ) : reviews.isError ? (
          <HomeSection title="Reviews">
            <BandError label="Reviews could not load." onRetry={() => reviews.refetch()} />
          </HomeSection>
        ) : hasReviews ? (
          <HomeSection
            title="Reviews"
            subtitle="From your circle, and everyone else."
            seeAll="/reviews">
            <View style={styles.stack}>
              {followed.map((log) => (
                <LogCard key={log.id} log={log} engagement={engagement.data?.[log.id]} />
              ))}

              {followed.length > 0 && newest.length > 0 && (
                <View style={[styles.divider, { borderTopColor: theme.border }]}>
                  <Text variant="label" color="textMuted">
                    MORE FROM EVERYONE
                  </Text>
                </View>
              )}

              {newest.map((log) => (
                <LogCard key={log.id} log={log} engagement={engagement.data?.[log.id]} />
              ))}
            </View>
          </HomeSection>
        ) : null}

        {/*
         * Band 3 — the catalogue. Out now and coming next, as one timeline.
         *
         * Two rails of 92dp posters with an inverted date predicate, stacked
         * 48dp apart, are one rail that has been cut in half. The year under
         * each poster already separates them.
         */}
        <HomeSection title="Releases" subtitle="Just out, and what's next." seeAll="/releases">
          {releases.isLoading || upcoming.isLoading ? (
            <RailSkeleton />
          ) : releases.isError && upcoming.isError ? (
            <BandError
              label="Releases could not load."
              onRetry={() => {
                releases.refetch();
                upcoming.refetch();
              }}
            />
          ) : (
            <GamePosterRail games={releaseRail} parallax />
          )}
        </HomeSection>

        {/* Band 4 — what happened. */}
        <HomeSection title="Latest news" seeAll="/news">
          <View style={styles.stack}>
            {news.isLoading ? (
              Array.from({ length: NEWS_PREVIEW }).map((_, index) => (
                <Skeleton key={index} width="100%" height={newsCardHeight(width)} />
              ))
            ) : news.isError ? (
              <BandError label="News could not load." onRetry={() => news.refetch()} />
            ) : (
              (news.data ?? [])
                .slice(0, NEWS_PREVIEW)
                .map((article) => <ArticleCard key={article.id} article={article} />)
            )}
          </View>
        </HomeSection>

        <Link href="/(tabs)/search" asChild>
          <PressableScale
            accessibilityRole="link"
            accessibilityLabel="Search every game on IGDB"
            hitSlop={FOOTER_SLOP}
            scaleTo={0.98}
            style={styles.footer}>
            <Text variant="bodySmall" style={{ color: theme.primaryText }}>
              Search every game on IGDB
            </Text>
            <Ionicons name="chevron-forward" size={14} color={theme.primaryText} />
          </PressableScale>
        </Link>
      </Animated.ScrollView>
    </Screen>
  );
}

/**
 * One band failed, said where it failed, and offered the way back.
 *
 * The page used to carry a single `<ErrorState>` gated on news **and** releases
 * **and** upcoming all failing at once — so one dead band rendered a heading, a
 * "See all" chevron and nothing underneath, indistinguishable from "nothing
 * today", while a Supabase outage that killed only the reviews showed no error
 * anywhere. And when the all-three gate did fire, `ErrorState`'s `flex: 1`
 * inside a content-driven `contentContainerStyle` had no free space to resolve
 * against, so it collapsed to its own padding.
 */
function BandError({ label, onRetry }: { label: string; onRetry: () => void }) {
  const theme = useTheme();

  return (
    <View style={styles.bandError}>
      <Text variant="bodySmall" color="textMuted">
        {label}
      </Text>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`Retry: ${label}`}
        hitSlop={FOOTER_SLOP}
        onPress={onRetry}
        scaleTo={0.96}>
        <Text variant="bodySmall" style={{ color: theme.primaryText }}>
          Try again
        </Text>
      </PressableScale>
    </View>
  );
}

/**
 * A poster rail's placeholder, at the height of the rail it stands in for.
 *
 * 138 was the poster alone; the real `RailPoster` carries a two-line title and
 * a year under it. Same class of bug as the news skeleton, smaller blast
 * radius — the rail is the last thing in its band, so the understatement moved
 * one section instead of four.
 */
function RailSkeleton() {
  return (
    <View style={styles.railSkeleton}>
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} width={92} height={181} />
      ))}
    </View>
  );
}

/** Roughly a collapsed `<LogCard>`: header block, stats, four lines of prose. */
const REVIEW_CARD_HEIGHT = 320;

/** Lifts a one-line inline link to the platform floor without moving the text. */
const FOOTER_SLOP = { top: 14, bottom: 14, left: 8, right: 8 };

const styles = StyleSheet.create({
  /* `width`/`height` rather than padding, so the glyph keeps its optical
     position while the touch box grows around it. `Spacing.x8` is 6, not 8 —
     the old `padding: Spacing.x8` made this 36dp against a 44/48 floor, on the
     only control in the bar and the sole route to notifications. The negative
     margin puts the enlarged box back on the bar's own edge. */
  /* The masthead sits in the content column, so the row owns the page margin
     and its first band starts flush with everything below it. */
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.x12,
    paddingHorizontal: Spacing.x16,
    paddingTop: Spacing.x8,
  },
  mastheadTitles: { flex: 1, gap: 1 },
  mastheadActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
  bell: {
    width: TapTarget,
    height: TapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Anchored to the glyph, not to the enlarged touch box — the box is now
     `TapTarget` square and centring the badge on it would float it in space. */
  badge: {
    position: 'absolute',
    top: (TapTarget - 24) / 2 - 4,
    right: (TapTarget - 24) / 2 - 6,
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
  /* `EmptyState` centres on `flex: 1`, which resolves to nothing inside a
     content-driven scroll container. The explicit height is what gives it space
     to centre in. */
  firstRun: { minHeight: 260, justifyContent: 'center' },
  stack: { paddingHorizontal: Spacing.x16, gap: Spacing.x12 },
  /* A rule with its label sitting on the gap above it, so the two halves of the
     Reviews band read as one band with a seam rather than as two lists. */
  divider: { paddingTop: Spacing.x12, borderTopWidth: StyleSheet.hairlineWidth },
  railSkeleton: { flexDirection: 'row', gap: Spacing.x12, paddingHorizontal: Spacing.x16 },
  bandError: {
    paddingHorizontal: Spacing.x16,
    gap: Spacing.x4,
    alignItems: 'flex-start',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.x4,
    paddingHorizontal: Spacing.x16,
    paddingTop: Spacing.x8,
  },
});
