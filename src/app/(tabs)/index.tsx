import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigation, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import {
  RefreshControl,
  StyleSheet,
  View,
  useWindowDimensions,
  type ScrollView,
} from 'react-native';

import { ActivityRail } from '@/components/activity-rail';
import { CoverRailSkeleton, GameCoverRail } from '@/components/game-rail';
import { HomeSection } from '@/components/home-section';
import { ArticleCard, PastEventCard } from '@/components/news-cards';
import { SurpriseEntry } from '@/components/surprise-entry';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { FoldingTopBar } from '@/components/ui/frosted-top-bar';
import { PageScrollView } from '@/components/ui/page-scroll';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, Screen } from '@/components/ui/screen';
import { AmbientLight } from '@/components/ui/ambient-light';
import { Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { useTabBarClearance } from '@/components/app-tab-bar';
import { footHeight } from '@/constants/cover-rail';
import { HeroAspectRatio, Radius, Spacing, TapTarget } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useHeaderHeight } from '@/hooks/use-header-height';
import { useTheme } from '@/hooks/use-theme';
import { getHomeActivity, getUnreadCount, getUserLogs } from '@/lib/api';
import { displayNameFor, greetingFor } from '@/lib/format';
import { recommendFromLogs } from '@/lib/games/recommend';
import { getLatestEvents } from '@/lib/games/browse';
import { getGamingNews, getNewReleases, getUpcomingReleases } from '@/lib/news';
import { useAuth } from '@/store/auth';

/** How many finished events Home shows: the owner's three. */
const LATEST_EVENTS = 3;

/** How many news items Home shows before "See all". Enough to be worth a look. */
const NEWS_PREVIEW = 3;
/** Covers in the row of people's activity. A few screenfuls sideways. */
const ACTIVITY_LIMIT = 20;
/** Games in the recommendation rail. Roughly five screenfuls of scrolling. */
const RECOMMENDED_LIMIT = 12;
/** Posters in the merged releases rail, split evenly between out-now and upcoming. */
const RELEASES_PER_HALF = 10;

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
 * widens outward — what you might play, what people played, what came out,
 * what happened. Every band is a different question; none of them is a second
 * helping of the one above it.
 *
 *   Games for you     — from your own logs, via IGDB similarity
 *   New from friends  — what your circle scored and wrote about   (Postgres)
 *   Releases          — just out, and what is next                (IGDB)
 *   Latest news       — what happened                             (RSS)
 *   Latest events     — the last three showcases that finished    (IGDB)
 *
 * **The first three are rows of games**: a one-line heading on the page over
 * small covers — the shape of the sections on Letterboxd's home, the owner's
 * reference (2026-10-09), without the cards the reference draws them in (the
 * owner had those removed). The news stands under its own heading the same way.
 *
 * **"New from friends" is where the review cards were.** The band was a stack
 * of `<LogCard>`s — your circle's, then everyone's under a rule. The owner
 * replaced it with the reference's row of that name: covers, and under each a
 * face, a name and a score. When the people you follow have logged nothing —
 * or you follow nobody — the same row is headed "New on GameLog" and shows
 * everyone's; it is never both, and never blended (`getHomeActivity`). The
 * review card is still every *list* of reviews in the app; Home no longer has
 * one.
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
  const clearance = useTabBarClearance();
  const accent = useAccent();
  const router = useRouter();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const userId = useAuth((state) => state.session?.user.id);
  const profile = useAuth((state) => state.profile);

  /*
   * Tapping the active tab returns to the top.
   *
   * The platform convention on every tab bar, and this page needs it more than
   * most: it hides its own bar on the way down, so without this the only way
   * back to the notification bell from the footer is a long reverse flick.
   */
  const scroller = useRef<ScrollView>(null);
  /* The floating bar's height, kept clear at the top of the scroll. */
  const headerHeight = useHeaderHeight();

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

  const activity = useQuery({
    queryKey: ['home-activity', userId],
    queryFn: () => getHomeActivity(userId!, ACTIVITY_LIMIT),
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

  /* The last three showcases that have finished — the owner's direction
     (2026-10-15): "only display the last 3 events. Not upcoming". The clock is
     read when the query runs, never during a render. */
  const latestEvents = useQuery({
    queryKey: ['home-latest-events'],
    queryFn: ({ signal }) => getLatestEvents(Date.now(), LATEST_EVENTS, signal),
    staleTime: 30 * 60_000,
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
    activity.isRefetching ||
    news.isRefetching ||
    releases.isRefetching ||
    upcoming.isRefetching ||
    latestEvents.isRefetching;

  function refreshAll() {
    logs.refetch();
    recommended.refetch();
    activity.refetch();
    news.refetch();
    releases.refetch();
    upcoming.refetch();
    latestEvents.refetch();
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

  const activityLogs = activity.data?.logs ?? [];
  /* The heading is the row's claim about whose games these are. While the
     first answer is on its way it is the row's own name. */
  const activityTitle = activity.data?.scope === 'everyone' ? 'New on GameLog' : 'New from friends';
  const personFoot = footHeight('person');
  const lineFoot = footHeight('line');

  return (
    <Screen
      edges={[]}
      /* Home's own floor, separate from the app's `background` while the
         owner tries colours on it. See `homeBackground`. */
      background={theme.homeBackground}
      /* The `backdrop` slot rather than a child: it renders outside the
         safe-area inset, so the light reaches the top of the display instead of
         starting under the status bar and drawing a hard line across it. Inert:
         the canvas takes `pointerEvents="none"`.

         The room's light and nothing else — a very soft field in the top-left
         corner, where Home's old corner glow sat, lighting the left of the
         screen and falling off before it reaches the right. Fixed rather than
         scroll-faded. See `ui/ambient-light`. The old glow itself — a far
         stronger `<SoftGlow>` that faded out on scroll — was removed at the
         owner's request: it read as a lit corner rather than as light. */
      backdrop={<AmbientLight />}
      /*
        The app's own bar — SimpMusic's Home, at the owner's direction.

        It floats over the page: clear while the page is at its very top, so
        the light in the corner is behind the wordmark, and frosted the moment
        the page has moved. Reading down past the first band it folds away and
        leaves the frost over the status bar; any move back up brings it down
        again. `<FoldingTopBar>` is the mechanism and `constants/top-bar` the
        numbers.

        (For a long while this row was the scroll's first child and went away
        with the content for good, which made the bell a long flick from the
        foot of the page.)

        One control: what happened while you were away. Settings moved to the
        profile's top bar, beside the other things that are about you.
      */
      topBar={
        <FoldingTopBar>
          <View style={styles.masthead}>
            <View style={styles.mastheadTitles}>
              {/* `h3`: the reference's app name is `titleMedium`, 18 — a step
                  under the 20 its shelves are titled in. */}
              <Text variant="h3">GameLog</Text>
              {/* `textSecondary`, not `textMuted`: this line sits on the corner
                  light's brightest pixels, where the muted grey is under AA. */}
              <Text variant="bodySmall" color="textSecondary">
                {greetingFor()}
              </Text>
            </View>

            <View style={styles.mastheadActions}>
              {/* Round keys in the action grey, as every icon-only control in the
                  app is. Not `<IconButton>`, which has nowhere to hang the unread
                  badge. */}
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={
                  unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
                }
                onPress={() => router.push('/notifications')}
                scaleTo={0.92}
                pressedColor={theme.controlPressed}
                focusRing={accent.ring}
                style={StyleSheet.flatten([styles.key, { backgroundColor: theme.controlFill }])}>
                <Ionicons name="notifications-outline" size={20} color={theme.text} />
                {unreadCount > 0 && (
                  /* Ringed in the page colour so the badge reads as sitting on
                     the key rather than as a stain on its edge. */
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: theme.primary, borderColor: theme.homeBackground },
                    ]}>
                    <Text variant="caption" style={{ color: theme.onPrimary }}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                )}
              </PressableScale>
            </View>
          </View>
        </FoldingTopBar>
      }>
      <PageScrollView
        ref={scroller}
        /*
         * Bands resolve at different times and some of them are over a thousand
         * dp tall. Without this, a band landing above the viewport teleports
         * whoever is reading below it — and the person this app is built for is
         * one-handed, interrupted, and on whatever connection the sofa gets.
         * `minIndexForVisible: 1` anchors to the first child rather than the
         * scroll origin, so a pull-to-refresh still behaves.
         */
        maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: Spacing.x48 + clearance }]}
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
        {/* The room the floating bar is drawn over, as the scroll's first row —
            the reference's `Spacer(topAppBarHeight)`. A row and not a padding,
            so the rows after it keep their places in the list (see
            `maintainVisibleContentPosition` above). */}
        <View style={{ height: headerHeight }} />

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
         * Band 1 — on a first run, the ask.
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
        {isFirstRun && (
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
        )}

        {/*
         * What you might play. From your own logs — not "rated highest":
         * `recommendFromLogs` seeds from logs with a null rating too. Home's
         * rails keep the parallax — see the note above `PARALLAX_OVERSCAN` in
         * `ui/poster.tsx`.
         */}
        {!isFirstRun && (recommendedGames.length > 0 || seedsPending) && (
          <HomeSection title="Games for you">
            {seedsPending ? (
              <CoverRailSkeleton inset={Spacing.x16} />
            ) : (
              <GameCoverRail games={recommendedGames} inset={Spacing.x16} parallax />
            )}
          </HomeSection>
        )}

        {/*
         * What people played: your circle's, or — when they have been quiet,
         * or there is nobody in it — everyone's, under the heading that says
         * which. Absent only when nobody on GameLog has scored or written
         * about anything at all.
         */}
        {activity.isLoading ? (
          <HomeSection title={activityTitle}>
            <CoverRailSkeleton foot={personFoot} inset={Spacing.x16} />
          </HomeSection>
        ) : activity.isLoadingError ? (
          <HomeSection title={activityTitle}>
            <View style={styles.inset}>
              <BandError
                label="What people are playing could not load."
                onRetry={() => activity.refetch()}
              />
            </View>
          </HomeSection>
        ) : activityLogs.length > 0 ? (
          <HomeSection title={activityTitle}>
            <ActivityRail logs={activityLogs} inset={Spacing.x16} />
          </HomeSection>
        ) : null}

        {/*
         * The catalogue. Out now and coming next, as one timeline — two rails
         * with an inverted date predicate are one rail cut in half. The date
         * under each cover is what separates the halves, and is the one thing
         * here its box does not say.
         */}
        <HomeSection title="Releases" seeAll="/releases">
          {releases.isLoading || upcoming.isLoading ? (
            <CoverRailSkeleton foot={lineFoot} inset={Spacing.x16} />
          ) : releases.isLoadingError && upcoming.isLoadingError ? (
            <View style={styles.inset}>
              <BandError
                label="Releases could not load."
                onRetry={() => {
                  releases.refetch();
                  upcoming.refetch();
                }}
              />
            </View>
          ) : (
            <GameCoverRail
              games={releaseRail}
              inset={Spacing.x16}
              lineOf={(game) => releaseLabel(game.releaseDate, game.releaseYear)}
              labelOf={(game) =>
                [game.title, releaseLabel(game.releaseDate, game.releaseYear)]
                  .filter(Boolean)
                  .join(', ')
              }
              parallax
            />
          )}
        </HomeSection>

        {/* Band 4 — what happened. */}
        <HomeSection title="Latest news" seeAll="/news">
          <View style={styles.stack}>
            {news.isLoading ? (
              Array.from({ length: NEWS_PREVIEW }).map((_, index) => (
                <Skeleton key={index} width="100%" height={newsCardHeight(width)} />
              ))
            ) : news.isLoadingError ? (
              <BandError label="News could not load." onRetry={() => news.refetch()} />
            ) : (
              (news.data ?? [])
                .slice(0, NEWS_PREVIEW)
                .map((article) => <ArticleCard key={article.id} article={article} />)
            )}
          </View>
        </HomeSection>

        {/* Band 5 — the showcases that just happened, as stories. Absent when
            IGDB has none to give; a failure says so, as every band does. */}
        {latestEvents.isLoadingError ? (
          <HomeSection title="Latest events">
            <BandError label="Events could not load." onRetry={() => latestEvents.refetch()} />
          </HomeSection>
        ) : latestEvents.isPending || (latestEvents.data ?? []).length > 0 ? (
          <HomeSection title="Latest events">
            <View style={styles.stack}>
              {latestEvents.isPending
                ? Array.from({ length: LATEST_EVENTS }).map((_, index) => (
                    <Skeleton key={index} width="100%" height={newsCardHeight(width)} />
                  ))
                : latestEvents.data!.map((event) => <PastEventCard key={event.id} event={event} />)}
            </View>
          </HomeSection>
        ) : null}

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
      </PageScrollView>
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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * A release date as the line under a cover: "3 Oct", and the year with it when
 * that year is not this one. Read in UTC, as IGDB stores it — local time moves
 * every game west of Greenwich back a day.
 */
function releaseLabel(releaseDate: string | null, releaseYear: number | null): string | null {
  if (!releaseDate) return releaseYear === null ? null : String(releaseYear);

  const date = new Date(`${releaseDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return releaseYear === null ? null : String(releaseYear);

  const day = `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
  return date.getUTCFullYear() === new Date().getUTCFullYear()
    ? day
    : `${day} ${date.getUTCFullYear()}`;
}

/** Lifts a one-line inline link to the platform floor without moving the text. */
const FOOTER_SLOP = { top: 14, bottom: 14, left: 8, right: 8 };

const styles = StyleSheet.create({
  /* The bar's row, filled: the page's own margin at either end, so the
     wordmark starts on the line every band under it starts on. */
  masthead: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.x12,
    paddingHorizontal: Spacing.x16,
  },
  mastheadTitles: { flex: 1, gap: 1 },
  /* `x8` (8) between the two keys: Material's gap between touch targets. */
  mastheadActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  /* A round key at the tap floor itself — 44 on iOS, 48 on Android — so the
     disc you see is the area you can press. It is the sole route to
     notifications and must not be the hardest thing to hit. */
  key: {
    width: TapTarget,
    height: TapTarget,
    borderRadius: TapTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* On the key's upper-right shoulder, overlapping its edge the way a badge on
     an app icon does. */
  badge: {
    position: 'absolute',
    top: -Spacing.x4,
    right: -Spacing.x4,
    minWidth: 20,
    height: 20,
    paddingHorizontal: Spacing.x4,
    borderRadius: Radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* `x32` (32) between bands — SimpMusic's interval between sections — against
     15 from a heading to its own rail.

     The page's only structural rhythm, and the reason a stack of unrelated
     sections still reads as one document rather than one long scroll. When the
     two gaps were close, the headings read as captions floating in a
     continuous column. The interval separating sections has to be unmistakably
     bigger than any interval inside one. */
  content: { paddingBottom: Spacing.x48, gap: Spacing.x32 },
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
  /* No inset of its own: the news band's stack already has the page's margin,
     and a band of games gives it `inset`. */
  bandError: { gap: Spacing.x4, alignItems: 'flex-start' },
  inset: { paddingHorizontal: Spacing.x16 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.x4,
    paddingHorizontal: Spacing.x16,
    paddingTop: Spacing.x8,
  },
});
