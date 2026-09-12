import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useRouter, type Href } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Alert, RefreshControl, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import type { TopBarScroll } from '@/hooks/use-screen-chrome';

import { ConnectAccountCard } from '@/components/gaming/connect-card';
import { SteamSection } from '@/components/gaming/steam-section';
import { ListTile } from '@/components/list-tile';
import { ReviewListRow } from '@/components/review-list-row';
import { GamesWidget, SHELF_LIMIT } from '@/components/games-widget';
import { FavoritesWidget } from '@/components/profile-widgets';
import { StarredSongWidget } from '@/components/starred-song-widget';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/screen';
import { TabBar } from '@/components/ui/tab-bar';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useCollectionEngagement } from '@/hooks/use-collection-engagement';
import { useTheme } from '@/hooks/use-theme';
import { ActivityRow, WallComposer, WallPostRow } from '@/components/wall';
import {
  acceptFriendRequest,
  followUser,
  getAchievementStats,
  getFavorites,
  getFriendCount,
  getFriendState,
  getGamingStats,
  getLists,
  getOwnedGames,
  getProfile,
  getProfileStats,
  getUserLogs,
  getWall,
  removeFriendship,
  sendFriendRequest,
  unfollowUser,
  type FriendState,
} from '@/lib/api';
import { displayNameFor, withDateGroups } from '@/lib/format';
import { buildShelf } from '@/lib/games/shelf';
import { useGamingSync, useLinkedAccount } from '@/hooks/use-gaming';
import { useAuth } from '@/store/auth';

type ProfileTab = 'reviews' | 'lists' | 'wall' | 'steam';

/**
 * Four tabs, down from six, and Reviews leads.
 *
 * **Reviews is the default** because PRODUCT.md's second pillar is serious
 * long-form criticism, and the profile's answer to "who is this person" should
 * be what they wrote rather than a chronological log of their taps. The wall was
 * the default and it mixes the two.
 *
 * **About is gone.** Five rows, of which Username restated the handle three
 * lines up, and Favourite platform and Location restated the meta row further
 * up the same header. Only "Joined" was unique to it.
 *
 * **Posts is gone because the feature is.** User posts and articles were removed
 * from the app entirely, so there is nothing behind that tab to show. The wall
 * is unaffected: it reads `wall_posts` and activity, which are different tables
 * and a different feature.
 *
 * ## They are glyphs now, not words
 *
 * `label` is still required and still does real work — it is what the tab
 * announces to a screen reader, and it is the fallback if `iconOnly` is ever
 * dropped. Only the *printed* word goes away.
 *
 * Each glyph is one the app already uses for the same idea, rather than a mark
 * invented for this row: `albums` is what the game page's Collect action uses,
 * `logo-steam` is the platform's own, and a document and a speech bubble are the
 * two most conventional marks there are for "writing" and "what people said".
 *
 * The width problem this note used to describe is gone with the words. Four
 * labels measured ~355dp against a 369dp content width — fitting, but only just,
 * and six had pushed Steam off the right edge entirely. Four glyphs divide the
 * row evenly at any width and cannot overflow.
 */
const TABS: { key: ProfileTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'reviews', label: 'Reviews', icon: 'document-text-outline' },
  { key: 'lists', label: 'Collections', icon: 'albums-outline' },
  { key: 'wall', label: 'Wall', icon: 'chatbubbles-outline' },
  { key: 'steam', label: 'Steam', icon: 'logo-steam' },
];

/**
 * One shared empty array for a pending favourites query.
 *
 * `?? []` in the JSX allocated a new array on every render, which defeats the
 * shallow compare in `memo()` for exactly as long as the query is in flight —
 * the window where re-renders are most frequent.
 */
const EMPTY_FAVORITES: never[] = [];

/**
 * The identity row's face — 80, up from 56.
 *
 * With the banner gone the avatar is the first thing on the page and the only
 * image in the header, so it has to carry the weight the plate behind it used
 * to. 80 is also close to Instagram's own, which is the layout this row follows.
 *
 * It sets the row's height, and the four counts sit on its midline.
 */
const AVATAR_SIZE = 80;

export type ProfileViewProps = {
  profileId: string;
  headerAction?: ReactNode;
  /**
   * The enclosing screen's top-bar scroll handler, from `useTopBarScroll()`.
   *
   * Threaded in rather than created here because this component *is* the page's
   * scroller on both profile routes, and the bar it feeds belongs to the screen
   * above it.
   */
  onScroll?: TopBarScroll['onScroll'];
};

/**
 * Profile, laid out the way Instagram does it.
 *
 * Order is: avatar + counts on one row → name → bio → meta → full-width actions
 * → widgets → icon tab bar → tab content. The tab bar is the last thing in
 * `ListHeaderComponent`, so it sits directly above the list it controls rather
 * than being buried under full-width favourite and achievement sections.
 *
 * ## What changed from the X/Twitter shape it used to have
 *
 * **The banner is gone.** It was a `banner_url` free-text column with an
 * unvalidated URL behind it, and the majority of profiles set none — so the page
 * opened on either nothing or a stranger's arbitrary image, and the code carried
 * two layout branches for the avatar depending on which. Removing it deletes the
 * branch, the ring-versus-no-ring rule and the negative margin that pulled the
 * row up into it. The column and its type are left in place, the same way the
 * `posts` tables were left when posts were removed.
 *
 * **The counts moved to the top.** They used to sit below the favourites and the
 * shelf, on the argument that curated work is better evidence of taste than a
 * follower number. That argument is still true and this is a deliberate trade:
 * the Instagram shape puts identity and reach on one line so the reader can size
 * up a stranger in one glance, and the widgets keep the room they had.
 */
export function ProfileView({ profileId, headerAction, onScroll }: ProfileViewProps) {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;
  const isSelf = viewerId === profileId;
  const [tab, setTab] = useState<ProfileTab>('reviews');

  const profile = useQuery({
    queryKey: ['profile', profileId],
    queryFn: () => getProfile(profileId),
  });
  const stats = useQuery({
    queryKey: ['profile-stats', profileId, viewerId],
    queryFn: () => getProfileStats(profileId, viewerId),
  });
  const achievementStats = useQuery({
    queryKey: ['achievement-stats', profileId],
    queryFn: () => getAchievementStats(profileId),
  });
  const favorites = useQuery({
    queryKey: ['favorites', profileId],
    queryFn: () => getFavorites(profileId),
  });
  const logs = useQuery({
    queryKey: ['user-logs', profileId],
    queryFn: () => getUserLogs(profileId),
  });
  const lists = useQuery({
    queryKey: ['lists', profileId],
    queryFn: () => getLists(profileId),
    enabled: tab === 'lists',
  });
  /* The tile shows likes and comments, and neither can be embedded on a list
     row — both are polymorphic and PostgREST cannot join across that. One
     batched call for the whole tab; see `useCollectionEngagement`. */
  const listEngagement = useCollectionEngagement(
    (lists.data ?? []).map((list) => list.id),
    viewerId
  );
  const wall = useQuery({
    queryKey: ['wall', profileId],
    queryFn: () => getWall(profileId),
    enabled: tab === 'wall',
  });
  const friendState = useQuery({
    queryKey: ['friend-state', viewerId, profileId],
    queryFn: () => getFriendState(viewerId!, profileId),
    enabled: !!viewerId,
  });
  const friendCount = useQuery({
    queryKey: ['friend-count', profileId],
    queryFn: () => getFriendCount(profileId),
  });

  // Linked gaming account. Fetched eagerly rather than with the Steam tab,
  // because the library widget in the header depends on it.
  const steamAccount = useLinkedAccount(profileId);
  const steamStats = useQuery({
    queryKey: ['gaming-stats', 'steam', profileId],
    queryFn: () => getGamingStats(profileId),
    enabled: !!steamAccount.data,
  });
  const steamLibrary = useQuery({
    queryKey: ['gaming-library', 'steam', profileId, 'most-played', ''],
    queryFn: () => getOwnedGames(profileId, { sort: 'most-played', limit: 24 }),
    enabled: !!steamAccount.data,
  });

  /*
   * Background sync for the profile owner only.
   *
   * Guarding on `isSelf` is not just an optimisation — syncing while viewing
   * someone else's profile would spend our shared Steam rate budget on data the
   * viewer did not ask for, and would refresh a stranger's presence on demand.
   */
  useGamingSync({ userId: profileId, enabled: isSelf && !!steamAccount.data });

  /** Friend request actions all invalidate the same things. */
  const friendAction = useMutation({
    mutationFn: async (action: 'request' | 'accept' | 'remove') => {
      if (!viewerId) throw new Error('You must be signed in.');
      if (action === 'request') await sendFriendRequest(viewerId, profileId);
      else if (action === 'accept') await acceptFriendRequest(viewerId, profileId);
      else await removeFriendship(viewerId, profileId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friend-state', viewerId, profileId] });
      queryClient.invalidateQueries({ queryKey: ['friend-count', profileId] });
      queryClient.invalidateQueries({ queryKey: ['wall', profileId] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const toggleFollow = useMutation({
    mutationFn: async () => {
      if (!viewerId) throw new Error('You must be signed in to follow people.');
      if (stats.data?.isFollowing) await unfollowUser(viewerId, profileId);
      else await followUser(viewerId, profileId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-stats', profileId] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  /*
   * Derived data, memoised — and declared **above** the early returns below.
   *
   * Hooks have to run in the same order on every render, so anything using one
   * has to sit ahead of the first `return`. Both of these are also cheap to
   * compute against an empty query, which is what makes hoisting them free.
   */

  // Reviews are logs that carry an actual article, not just a score.
  const reviews = useMemo(
    () => (logs.data ?? []).filter((log) => log.review),
    // Keyed on the query's own data, not on a `?? []` expression: that fallback
    // is a fresh array on every render while the query is pending, which would
    // make the memo re-run every time and cost more than it saves.
    [logs.data]
  );

  /**
   * The shelf, merged once per data change rather than once per render.
   *
   * `buildShelf` was called inline in the JSX below, so it re-merged and
   * re-sorted the whole log list against up to 24 Steam rows on every render of
   * this screen — and this screen re-renders as each of its eight mount-time
   * queries lands. It also returned a new array each time, which is what would
   * have made a `memo()` on `<GamesWidget>` do nothing at all.
   */
  const shelf = useMemo(
    () => buildShelf(logs.data ?? [], steamLibrary.data ?? [], SHELF_LIMIT),
    [logs.data, steamLibrary.data]
  );

  /** Stable empty array, so a pending favourites query does not break `memo`. */
  const favoriteItems = favorites.data?.items ?? EMPTY_FAVORITES;

  if (profile.isLoading) return <LoadingState />;
  if (profile.isError) return <ErrorState error={profile.error} />;
  if (!profile.data) return <EmptyState title="Profile not found" />;

  const person = profile.data;

  type Row =
    | { kind: 'header'; id: string; label: string }
    | { kind: 'log'; id: string; log: (typeof reviews)[number] }
    | { kind: 'list'; id: string; list: NonNullable<typeof lists.data>[number] }
    | { kind: 'wall'; id: string; item: NonNullable<typeof wall.data>[number] };

  let rows: Row[] = [];
  let loading = false;
  let emptyLabel = '';
  /*
   * The failure behind an empty list, when there is one.
   *
   * Tracked separately from `loading` because "nothing here" and "we could not
   * ask" are different sentences and only one of them is a fact about the
   * person. Every tab used to render the first when it meant the second — a
   * dropped connection told you someone had written no reviews.
   */
  let error: unknown = null;
  let retry: (() => void) | null = null;

  switch (tab) {
    case 'reviews':
      rows = reviews.map((log) => ({ kind: 'log', id: log.id, log }));
      loading = logs.isLoading;
      error = logs.error;
      retry = () => void logs.refetch();
      emptyLabel = 'No reviews yet';
      break;
    case 'lists':
      rows = (lists.data ?? []).map((list) => ({ kind: 'list', id: list.id, list }));
      loading = lists.isLoading;
      error = lists.error;
      retry = () => void lists.refetch();
      emptyLabel = 'No collections yet';
      break;
    case 'steam':
      // Renders entirely from the header; the list itself stays empty.
      rows = [];
      break;
    default:
      // The wall is the one tab that reads as a timeline, so it gets calendar
      // group headings — "Today", "Yesterday", "Last week" — rather than relying
      // on per-row relative stamps alone.
      rows = withDateGroups(wall.data ?? [], (item) => item.createdAt).map((row) =>
        row.type === 'header'
          ? ({ kind: 'header', id: `h:${row.label}`, label: row.label } as const)
          : ({ kind: 'wall', id: row.item.id, item: row.item } as const)
      );
      loading = wall.isLoading;
      error = wall.error;
      retry = () => void wall.refetch();
      emptyLabel = isSelf ? 'Your wall is empty' : 'Nothing on this wall yet';
  }

  const ownerName = displayNameFor(person);

  /**
   * Whichever query the visible tab is showing.
   *
   * Pull-to-refresh and the spinner both read from this, so the gesture always
   * refreshes what is under the finger. Reviews reads `logs`, which the header
   * refreshes anyway — it is listed for both so neither path has to special-case
   * the overlap.
   */
  const activeTabQuery =
    tab === 'wall' ? wall : tab === 'lists' ? lists : tab === 'steam' ? steamLibrary : logs;

  /** Unfollowing is quiet and reversible, so it confirms without alarm. */
  function confirmUnfollow() {
    Alert.alert(`Unfollow ${ownerName}?`, 'Their activity will stop appearing in your feed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unfollow', style: 'destructive', onPress: () => toggleFollow.mutate() },
    ]);
  }

  return (
    <Animated.FlatList
      data={rows}
      onScroll={onScroll}
      scrollEventThrottle={16}
      keyExtractor={(row) => `${row.kind}:${row.id}`}
      renderItem={({ item }) =>
        item.kind === 'header' ? (
          <DateGroupHeader label={item.label} />
        ) : /*
             Reviews are an index here, not a feed.
        
             `<ReviewListRow>` carries its own gutter and hairline, so it is *not*
             wrapped in `styles.rowWrap` — the rule has to reach both edges of the
             display to read as a list rather than as a stack of inset cards.
           */
        item.kind === 'log' ? (
          <ReviewListRow log={item.log} />
        ) : (
          <View style={styles.rowWrap}>
            {item.kind === 'list' ? (
              <ListTile list={item.list} engagement={listEngagement?.[item.list.id]} />
            ) : item.item.type === 'post' ? (
              <WallPostRow post={item.item.post} />
            ) : (
              <ActivityRow entry={item.item.activity} ownerName={ownerName} ownerId={profileId} />
            )}
          </View>
        )
      }
      /*
       * The wall separates rows with a hairline rather than whitespace, which is
       * what makes a dense timeline scannable. `leadingItem` is used to suppress
       * the rule directly above a group heading, where it would read as
       * underlining the previous group instead of dividing two entries.
       */
      ItemSeparatorComponent={({ leadingItem }: { leadingItem?: Row }) =>
        tab === 'wall' ? (
          leadingItem?.kind === 'header' ? (
            <View style={{ height: Spacing.x4 }} />
          ) : (
            <View style={[styles.wallDivider, { backgroundColor: theme.border }]} />
          )
        ) : (
          <View style={{ height: Spacing.x12 }} />
        )
      }
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      /*
       * Keyboard insets, and deliberately *not* the `<KeyboardAvoidingView>`
       * every other composer in this app uses.
       *
       * That pattern fits the shape those screens have — comments, the log form,
       * new-list and edit-profile all pin their composer to the bottom, outside
       * the scroller, so shrinking the container is exactly right. The wall
       * composer is different: it lives *inside* this list's header and scrolls
       * with the content. Wrapping the list would only shrink the viewport; it
       * would not bring a mid-content input above the keyboard.
       *
       * `automaticallyAdjustKeyboardInsets` is the iOS answer for an input
       * inside a scroller — it adds bottom inset equal to the keyboard, so the
       * focused field can be scrolled clear. Android gets the same outcome from
       * `softwareKeyboardLayoutMode: 'resize'` in app.json, where the window
       * itself resizes and the list scrolls the focused input into view.
       *
       * `persistTaps` is what makes "Post" actually pressable while the keyboard
       * is up rather than the first tap only dismissing it; `on-drag` is the
       * timeline convention — scrolling away from a half-written note puts the
       * keyboard away rather than leaving it covering the page.
       */
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshControl={
        <RefreshControl
          /* The visible tab is included, and drives the spinner.
             This refreshed logs/stats/achievements/favourites and never the
             tab you were looking at — so the most-used gesture on a timeline
             did not refresh that timeline, and the spinner's duration was set
             by a query off screen. `colors` as well as `tintColor`: the latter
             is iOS-only and Android was falling back to a default hue. */
          refreshing={logs.isRefetching || activeTabQuery.isRefetching}
          onRefresh={() => {
            logs.refetch();
            stats.refetch();
            achievementStats.refetch();
            favorites.refetch();
            friendCount.refetch();
            /* Included so "Pull down to retry" under the action row is a true
               statement — this is the query whose failure hides those buttons. */
            friendState.refetch();
            activeTabQuery.refetch();
          }}
          tintColor={theme.primary}
          colors={[theme.primary]}
        />
      }
      ListHeaderComponent={
        <View>
          <View style={styles.headerBody}>
            {/*
              Face on the left, reach on the right — Instagram's opening row.

              The avatar is the page's anchor now that there is no banner behind
              it, which is why it is 80dp rather than the 56 it was: at 56 with
              nothing above it the page opened on a thumbnail. The counts take
              the rest of the row and divide it evenly, so four of them line up
              on their numbers rather than drifting with label length.
            */}
            <View style={styles.identity}>
              <Avatar uri={person.avatar_url} name={displayNameFor(person)} size={AVATAR_SIZE} />

              <View style={styles.counts}>
                <Count value={stats.data?.logged} label="Logged" />
                <Count
                  value={stats.data?.followers}
                  label="Followers"
                  href={{ pathname: '/people/[id]', params: { id: profileId, tab: 'followers' } }}
                />
                <Count
                  value={stats.data?.following}
                  label="Following"
                  href={{ pathname: '/people/[id]', params: { id: profileId, tab: 'following' } }}
                />
                <Count
                  value={friendCount.data}
                  label="Friends"
                  href={{ pathname: '/people/[id]', params: { id: profileId, tab: 'friends' } }}
                />
              </View>
            </View>

            {/* Name and handle under the row, not inside it — the row is for the
                face and the numbers, and a name squeezed between them is what
                made four counts impossible to fit before. */}
            <View style={styles.nameBlock}>
              <Text variant="h4" numberOfLines={1}>
                {displayNameFor(person)}
              </Text>
              <Text variant="bodySmall" color="textMuted" numberOfLines={1}>
                @{person.username}
              </Text>
            </View>

            {/*
              Directly under the controls it is about.

              This sat at the foot of the header, below the favourites, the shelf
              and the song widget — five hundred-odd dp from the button that
              caused it, and off screen at the moment it appeared. An error about
              a control belongs beside that control.

              It covers two different failures. A **mutation** that failed is the
              louder one and keeps `danger`. A **query** that failed is quieter
              but now matters more than it did: the Friend and Follow buttons
              hide themselves when they cannot read their own state, so without
              this line their absence would have no explanation at all.
            */}
            {(toggleFollow.isError || friendAction.isError) && (
              <Text variant="bodySmall" color="danger">
                {(toggleFollow.error ?? friendAction.error) instanceof Error
                  ? (toggleFollow.error ?? friendAction.error)!.message
                  : 'Could not update. Check your connection and try again.'}
              </Text>
            )}

            {!isSelf && (stats.isError || friendState.isError) && (
              <Text variant="bodySmall" color="textMuted">
                Could not load your connection to {ownerName}. Pull down to retry.
              </Text>
            )}

            {/* Clamped. `bio` is 300 characters and sat unbounded directly
                above the counts, so a full one pushed the favourites, the shelf
                and the tab bar down by roughly nine lines. Four is enough to
                read someone's description; the rest is not load-bearing. */}
            {person.bio && (
              <Text variant="body" color="textSecondary" numberOfLines={4}>
                {person.bio}
              </Text>
            )}

            {(person.favorite_platform || person.location) && (
              <View style={styles.metaRow}>
                {person.favorite_platform && (
                  <Meta icon="game-controller-outline" label={person.favorite_platform} />
                )}
                {person.location && <Meta icon="location-outline" label={person.location} />}
              </View>
            )}

            {/*
              The actions, full width and under everything they are about.

              They were floated to the right of the identity row, which is where
              a 56dp avatar leaves room for them and an 80dp one does not. Full
              width is also what Instagram does with Edit profile, and it is the
              better shape regardless: "Follow" is the single most likely tap on
              a stranger's page and it was a `size="small"` button sharing a line
              with a name.
            */}
            <View style={styles.actionRow}>
              {isSelf ? (
                headerAction
              ) : (
                <>
                  {/* Friendship and following are separate relationships:
                      friending needs consent and unlocks the wall, following
                      is one-way and only shapes the feed.

                      `state` is passed through undefined rather than coerced
                      with `?? 'none'`. That fallback made a failed or in-flight
                      fetch render **"Add friend" to someone who already is
                      one** — and, twelve lines down, "Become friends with X to
                      post on their wall" at the same time. Two confident false
                      claims out of one dropped request. Unknown is now its own
                      state and says nothing. */}
                  <View style={styles.actionSlot}>
                    <FriendButton
                      state={friendState.data}
                      pending={friendAction.isPending}
                      failed={friendState.isError}
                      onPress={(action) => friendAction.mutate(action)}
                    />
                  </View>
                  {/* Same rule for following. This was `{stats.data && …}`, so
                      a failed stats fetch made the Follow button *cease to
                      exist* with nothing said — the control vanished rather
                      than reporting it could not read its own state. */}
                  {!stats.isError && (
                    <View style={styles.actionSlot}>
                      <Button
                        title={stats.data?.isFollowing ? 'Following' : 'Follow'}
                        variant={stats.data?.isFollowing ? 'secondary' : 'primary'}
                        disabled={!stats.data}
                        fullWidth
                        onPress={() =>
                          stats.data?.isFollowing ? confirmUnfollow() : toggleFollow.mutate()
                        }
                        loading={toggleFollow.isPending || stats.isLoading}
                      />
                    </View>
                  )}
                </>
              )}
            </View>

            <View style={styles.widgets}>
              <FavoritesWidget items={favoriteItems} listId={favorites.data?.id} isSelf={isSelf} />
            </View>

            {/* One shelf for both sources.
                
                This replaced two adjacent widgets — a Steam-only library row
                that appeared only when an account was linked, and a four-number
                achievements block under it. They were two sections about the
                same library, and the first one vanished entirely for anyone who
                had never linked Steam, which is most people. The shelf shows
                whatever the person actually has: their logs, their Steam
                library, or both. */}
            <View style={styles.widgets}>
              <GamesWidget
                ownerName={ownerName}
                profileId={profileId}
                games={shelf}
                achievementsUnlocked={achievementStats.data?.achievements_unlocked ?? null}
                /* Steam's total where an account is linked, the app's logged
                   hours otherwise. Not summed: a game played on Steam *and*
                   logged here would have its hours counted twice, and the
                   larger, wronger number is the one people would notice. */
                playtimeMinutes={
                  steamStats.data?.totalPlaytimeMinutes ??
                  (achievementStats.data
                    ? Math.round(achievementStats.data.hours_played * 60)
                    : null)
                }
              />
            </View>

            {/* Renders nothing until someone pins a track, so it costs no
                vertical space on a profile that has not used the feature. */}
            <View style={styles.widgets}>
              <StarredSongWidget profileId={profileId} />
            </View>
          </View>

          {/* Tab bar, flush against the content it filters. Was a bespoke
              underline row duplicating `<TabBar>` — the copies drifted the
              moment the shared one was restyled, which is the argument for
              there being one.

              `iconOnly`, so the four tabs read as a strip of destinations rather
              than as four words. See the note on `TabBarProps.iconOnly` for what
              that costs and why these four glyphs can carry it. */}
          <TabBar tabs={TABS} value={tab} onChange={setTab} iconOnly label="Profile sections" />

          {/* Composer sits under the tab bar. Shown to the owner always, and to
              accepted friends — matching what the RLS policy will actually
              allow, so nobody is offered a box that will be rejected. */}
          {tab === 'wall' && viewerId && (isSelf || friendState.data === 'friends') && (
            <View style={styles.rowWrap}>
              <WallComposer wallOwnerId={profileId} authorId={viewerId} isOwnWall={isSelf} />
            </View>
          )}

          {/* `friendState.data &&` guards the claim. Without it an unresolved
              query rendered this line to an actual friend, telling them to
              befriend someone they already had — the other half of the `??
              'none'` bug above, in prose rather than in a button. */}
          {tab === 'wall' && !isSelf && friendState.data && friendState.data !== 'friends' && (
            <View style={styles.rowWrap}>
              <Text variant="bodySmall" color="textMuted">
                Become friends with {ownerName} to post on their wall.
              </Text>
            </View>
          )}

          {tab === 'lists' && isSelf && (
            <View style={styles.rowWrap}>
              <Button
                title="New collection"
                variant="secondary"
                onPress={() => router.push('/new-list')}
                fullWidth
              />
            </View>
          )}

          {tab === 'steam' && (
            <View style={styles.rowWrap}>
              {steamAccount.isLoading ? (
                <LoadingState />
              ) : steamAccount.data ? (
                <View style={styles.steamStack}>
                  <SteamSection profileId={profileId} account={steamAccount.data} isSelf={isSelf} />
                  {isSelf && <ConnectAccountCard userId={profileId} linked />}
                </View>
              ) : isSelf ? (
                <ConnectAccountCard userId={profileId} linked={false} />
              ) : (
                <EmptyState
                  title="No Steam account"
                  message={`${ownerName} has not linked a Steam account.`}
                />
              )}
            </View>
          )}
        </View>
      }
      /* Three outcomes, not two. A failure gets its own state and a way out —
         rendering "No reviews yet" because a request failed is the page stating
         something about a person that it does not know. */
      ListEmptyComponent={
        tab === 'steam' ? null : loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState
            error={error}
            action={
              retry ? <Button title="Try again" variant="secondary" onPress={retry} /> : undefined
            }
          />
        ) : (
          <EmptyState title={emptyLabel} />
        )
      }
    />
  );
}

/**
 * The friend control, which is a four-state affair rather than a toggle:
 * not friends, you asked, they asked, or friends.
 *
 * Five, counting *unknown*. `state` is deliberately optional: until the query
 * resolves there is no relationship to report, and the old `?? 'none'` turned
 * that silence into "Add friend" — an invitation to befriend someone you are
 * already friends with. Unknown renders the control disabled and in place, so
 * nothing is claimed and nothing jumps when the answer arrives.
 */
function FriendButton({
  state,
  pending,
  failed,
  onPress,
}: {
  state: FriendState | undefined;
  pending: boolean;
  /** The lookup failed. Distinct from "still loading" — no spinner, no promise. */
  failed?: boolean;
  onPress: (action: 'request' | 'accept' | 'remove') => void;
}) {
  if (state === undefined) {
    /* A failed lookup claims nothing. `loading` is what hides a `<Button>`'s
       label, so falling through here with `loading={false}` would have shown a
       disabled button reading "Friends" to someone who may not be one — the
       same false claim this component was rewritten to stop, relocated into the
       error branch. The message under the action row is what explains it. */
    if (failed) return null;

    /* Still loading: hold the slot so the row does not jump when the answer
       lands. The title is invisible behind the spinner and is only here to give
       the button its usual width. */
    return <Button title="Friends" variant="secondary" size="small" disabled loading />;
  }

  switch (state) {
    case 'friends':
      return (
        <Button
          title="Friends"
          variant="secondary"
          size="small"
          loading={pending}
          /* Confirms first. The label states a *status*, and tapping it used to
             silently destroy that status — the one shape where a button's word
             and its effect are opposites. The label stays (it is the honest
             answer to "are we friends?"); the alert is where the action is
             named. Same pattern as `game-actions.tsx`. */
          onPress={() =>
            Alert.alert('Remove friend?', 'You will both lose access to each other’s wall.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Remove', style: 'destructive', onPress: () => onPress('remove') },
            ])
          }
        />
      );
    case 'outgoing':
      return (
        <Button
          title="Requested"
          variant="ghost"
          size="small"
          loading={pending}
          onPress={() => onPress('remove')}
        />
      );
    case 'incoming':
      return (
        <Button
          title="Accept"
          variant="primary"
          size="small"
          loading={pending}
          onPress={() => onPress('accept')}
        />
      );
    case 'self':
      return null;
    default:
      return (
        <Button
          title="Add friend"
          variant="secondary"
          size="small"
          loading={pending}
          onPress={() => onPress('request')}
        />
      );
  }
}

/**
 * Chronological group heading for the wall.
 *
 * The rule runs to the right of the label rather than under it, so the heading
 * reads as a marker on the timeline instead of a section title sitting on top of
 * a block — which is how the old Facebook wall handled the same problem.
 */
function DateGroupHeader({ label }: { label: string }) {
  const theme = useTheme();

  return (
    <View style={styles.groupHeader}>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
      <View style={[styles.groupRule, { backgroundColor: theme.border }]} />
    </View>
  );
}

function Meta({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  const theme = useTheme();
  return (
    /* `favorite_platform` and `location` carry no `maxLength` in the editor, so
       the label has to shrink and clip rather than push its row apart. */
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={14} color={theme.textMuted} />
      <Text variant="bodySmall" color="textMuted" numberOfLines={1} style={styles.metaLabel}>
        {label}
      </Text>
    </View>
  );
}

/**
 * One count, navigable when there is somewhere to go.
 *
 * Two fixes in one shape. It was a bare `<View>` wrapping two `<Text>` nodes, so
 * a screen reader read the row as eight unrelated stops — "dash, Logged, dash,
 * Friends, dash, Followers" — and a sighted user got X's tappable-count idiom
 * attached to nothing at all. Grouping it under one label makes it one stop that
 * says "12 followers"; `href` makes the ones that lead somewhere actually lead
 * there, and its absence is what keeps "Logged" honest as a readout.
 *
 * `toLocaleString` because these are the only numbers on the profile that were
 * not already grouped — `GamesWidget` and `SteamSection` both format theirs, and
 * a five-figure follower count without a separator reads as a typo.
 */
function Count({ value, label, href }: { value?: number; label: string; href?: Href }) {
  const shown = value == null ? '—' : value.toLocaleString();

  /* Number over label, both centred. It was number-then-label on a baseline,
     which reads well in a sentence and badly in a four-column row: the labels
     are different lengths, so the numbers landed at four different offsets and
     the one thing the eye compares was the one thing not aligned. */
  const body = (
    <>
      <Text variant="h4">{shown}</Text>
      <Text variant="caption" color="textMuted" numberOfLines={1}>
        {label}
      </Text>
    </>
  );

  if (!href || value == null) {
    return (
      <View accessible accessibilityLabel={`${shown} ${label}`} style={styles.count}>
        {body}
      </View>
    );
  }

  return (
    <Link href={href} asChild>
      <PressableScale
        accessibilityRole="link"
        accessibilityLabel={`${shown} ${label}`}
        accessibilityHint={`Opens the list of ${label.toLowerCase()}`}
        scaleTo={0.94}
        /* 8, not `Spacing.x8` (6). Stacked, the count is a 19dp number over a
           13dp label — 33dp — and 6 of slop each side left it at 45, a point
           under Android's floor. The number cannot grow without out-shouting the
           name below it, so the touch area does. */
        hitSlop={8}
        style={StyleSheet.flatten([styles.count])}>
        {body}
      </PressableScale>
    </Link>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.x48 },
  rowWrap: { paddingHorizontal: Spacing.x16 },
  /*
   * Multiplied, not divided — and 1.5 rather than 2.
   *
   * `aspectRatio` in Yoga is **width ÷ height**, so dividing the ratio doubles
   * the height. `HeroAspectRatio / 2` resolved to 0.889, which is *portrait*:
   * 442dp on a Pixel, 63% of the screen on a 320dp phone, 900dp at
   * `MaxContentWidth`. It pushed the name, the counts, the favourites and the
   * shelf below the fold on first paint, and for the majority of people — who
   * set no banner at all — that was half a screen of flat grey before the app
   * said anything. This was the only place in the app that divided the token;
   * the four other uses pass it undivided for landscape.
   *
   * **The multiplier is set by the avatar, not by the artwork.** `styles.identity`
   * pulls the ring up 30dp into this plate, and the top bar is a floating layer
   * over `edges={[]}` content rather than something the page is inset below. So
   * the ring's top must clear `inset + TopBarHeight` or it renders behind the
   * blur. At `* 2` (111dp) it does not: clearance is −16dp on an SE, −23dp on a
   * 14, −24dp on a 15 Pro Max, and +1dp on a Pixel. At `* 1.5` every device
   * clears, worst case +13dp, and the plate is still only 146dp — a third of
   * what it was.
   */
  /*
   * `x24` between blocks, up from `x12`.
   *
   * The header was ten stacked things at 10dp apart — name, bio, meta, three
   * widgets, counts — which is close enough that nothing read as a group and the
   * whole column looked like one dense paragraph of interface. 18dp is the step
   * where the favourites, the shelf and the song each read as their own thing.
   */
  headerBody: { paddingHorizontal: Spacing.x16, gap: Spacing.x24, paddingTop: Spacing.x16 },
  /* One row: face and the four counts. `center` so the numbers sit on the
     avatar's midline rather than at its top edge. */
  identity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x16 },
  /* `minWidth: 0` so a long display name truncates rather than widening the
     column past the screen. */
  nameBlock: { minWidth: 0, gap: 1 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.x16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4, flexShrink: 1 },
  metaLabel: { flexShrink: 1 },
  /* Full-width now, and its children share the width evenly. `alignItems`
     stretch (the default) so both buttons are the same height whatever is in
     them. */
  actionRow: { flexDirection: 'row', gap: Spacing.x8 },
  actionSlot: { flex: 1 },
  /*
   * Takes the rest of the identity row and divides it evenly.
   *
   * `flex: 1` rather than a gap-and-wrap row: four counts whose widths follow
   * their labels ("Logged" against "Following") put the numbers at four
   * different offsets, and the numbers are what the eye is comparing.
   */
  counts: { flex: 1, flexDirection: 'row' },
  /* Stacked and centred — Instagram's shape, and the one that lets four fit in
     the ~260dp the avatar leaves on a 390dp phone. */
  count: { flex: 1, alignItems: 'center', gap: 1 },
  widgets: { flexDirection: 'row', gap: Spacing.x12 },
  steamStack: { gap: Spacing.x16 },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    paddingHorizontal: Spacing.x16,
    paddingTop: Spacing.x16,
    paddingBottom: Spacing.x8,
  },
  groupRule: { flex: 1, height: StyleSheet.hairlineWidth },
  wallDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: Spacing.x16,
    marginVertical: Spacing.x12,
  },
});
