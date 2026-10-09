import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useRouter, type Href } from 'expo-router';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import { useTabBarClearance } from '@/components/app-tab-bar';
import { ConnectAccountCard } from '@/components/gaming/connect-card';
import { SteamSection } from '@/components/gaming/steam-section';
import { ListTile } from '@/components/list-tile';
import { LogCard } from '@/components/log-card';
import { GamesWidget, SHELF_LIMIT } from '@/components/games-widget';
import { ProfileBox, ProfileSectionHeader } from '@/components/profile-section';
import { FavoritesWidget } from '@/components/profile-widgets';
import { StarredSongWidget } from '@/components/starred-song-widget';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/screen';
import { TabBar } from '@/components/ui/tab-bar';
import { Text } from '@/components/ui/text';
import {
  IDENTITY_GAP,
  PROFILE_MARGIN,
  SECTION_GAP,
  avatarSize as avatarSizeFor,
} from '@/constants/profile-layout';
import { MaxContentWidth, Spacing } from '@/constants/theme';
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
  getUserGameStats,
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

type ProfileTab = 'profile' | 'reviews' | 'lists' | 'steam';

/**
 * Four tabs, at the top of the screen, in words — and Profile leads.
 *
 * The owner's reference for the screen (a Letterboxd-style profile) keeps its
 * sections in a row under the title bar: PROFILE · FILMS · DIARY · REVIEWS… The
 * owner asked for the tabs there, "just like the attached image", and — asked
 * what stays on screen when one is chosen — for **only that tab's content**. So
 * the face, the name, the counts, the favourites, the library and the pinned
 * song are one tab, the first, and the others are each their own list from the
 * top of the screen down.
 *
 * ## The wall is not a tab any more
 *
 * It was the fourth of five. The owner had it moved "inside the profile tab,
 * under everything else": the wall is what people say *to* this person and what
 * this person has been doing, and that is part of who they are rather than a
 * second place to look. So the Profile tab is a list now — the profile as its
 * header, then the wall under a heading of its own — and the row is one tab
 * shorter.
 *
 * ## What that replaced
 *
 * **The tabs sat under the profile.** Face, counts, bio, buttons, three
 * widgets, *then* the row that chose what came next — five hundred dp down, and
 * every list started under all of it.
 *
 * **Reviews was the default**, on the argument that the answer to "who is this
 * person" is what they wrote. It is the second tab now, one tap from the top
 * and with the whole screen to itself; the screen opens on the person.
 *
 * **They were four glyphs, not words** — a strip under the widgets that divided
 * the width evenly. A critique of the tabs found the cost: four unlabelled
 * icons, and "Wall" and a Steam logo explaining nothing to somebody new. At the
 * top there is room to say what each is, and a row that scrolls, as the
 * reference's does.
 *
 * **About and Posts are still gone**, for the reasons they left: About restated
 * the header, and posts were removed from the app.
 *
 * They are `<TabBar>`'s pills and not the reference's underline: the app has
 * one tab implementation, and the owner asked for the layout "in the current
 * app language".
 */
const TABS: { key: ProfileTab; label: string }[] = [
  { key: 'profile', label: 'Profile' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'lists', label: 'Collections' },
  { key: 'steam', label: 'Steam' },
];

/**
 * One shared empty array for a pending favourites query.
 *
 * `?? []` in the JSX allocated a new array on every render, which defeats the
 * shallow compare in `memo()` for exactly as long as the query is in flight —
 * the window where re-renders are most frequent.
 */
const EMPTY_FAVORITES: never[] = [];

/** One row of the profile's list, whichever tab is showing. */
type ProfileRow =
  | { kind: 'header'; id: string; label: string }
  | { kind: 'log'; id: string; log: Awaited<ReturnType<typeof getUserLogs>>[number] }
  | { kind: 'list'; id: string; list: Awaited<ReturnType<typeof getLists>>[number] }
  | { kind: 'wall'; id: string; item: Awaited<ReturnType<typeof getWall>>[number] };

const rowKey = (row: ProfileRow) => `${row.kind}:${row.id}`;

/**
 * The gap between two rows, at module scope.
 *
 * It was an inline arrow passed as `ItemSeparatorComponent`, which React reads
 * as a *new component type* on every render — so every separator on screen was
 * unmounted and mounted again each time the profile rendered, which is once per
 * query that lands. As a module-level component its identity never changes.
 *
 * It needs no tab prop: the row it follows says which list this is. Wall rows
 * are split by a hairline, which makes a dense timeline scannable, except
 * directly above a date heading, where a rule would read as underlining the
 * previous group; the other lists are cards, and cards stack twelve apart —
 * reviews and collections alike.
 */
function RowSeparator({ leadingItem }: { leadingItem?: ProfileRow }) {
  const theme = useTheme();
  if (leadingItem?.kind === 'header') return <View style={{ height: Spacing.x4 }} />;
  if (leadingItem?.kind === 'wall') {
    return <View style={[styles.wallDivider, { backgroundColor: theme.border }]} />;
  }
  return <View style={{ height: Spacing.x12 }} />;
}

export type ProfileViewProps = {
  profileId: string;
  /** The owner's own actions, under their bio: Edit profile and Share. */
  headerAction?: ReactNode;
};

/**
 * A profile: the row of tabs, and under it whichever one is chosen.
 *
 * ```
 * [PROFILE] REVIEWS COLLECTIONS STEAM           fixed; the list scrolls under it
 *
 * (face)  Name                                  the Profile tab:
 *         128     12        9        4
 *        Logged Followers Following Friends
 * The bio, under the row.
 * [ Edit profile            ][ share ]
 * ┌ Favourites ───────────────── Edit ┐
 * │ [▮▮▮] [▮▮▮] [▮▮▮] [▮▮▮]           │         a box: the four they chose
 * └────────────────────────────────────┘
 * ┌ Ada's games ───────────────────  › ┐
 * │ ▮▮▮▮▮▮[ ▮▮▮▮▮▮▮ ]▮▮▮▮▮▮           │         a box: the library's stack
 * └────────────────────────────────────┘
 * ┌ Starred song ─────────────────────┐
 * Wall                                          open, and last: the composer,
 * ──────────────────────────────────────        then the timeline
 * ```
 *
 * The owner's design, from a Letterboxd-style profile: every size in it was read
 * off that mock and is in `constants/profile-layout`. The screen that carries it
 * names the person in a bar above this — your own tab's bar holds your handle,
 * someone else's has it beside the back disc — so the header's first line is the
 * name alone.
 *
 * ## What changed from the Instagram shape it had
 *
 * **The tabs came up.** See `TABS`. They are outside the list, so they stay
 * where they are while it scrolls.
 *
 * **The bio moved under the row.** The reference sets it between the name and
 * the counts; the owner asked for it below "the profile icon and stats", which
 * is also where a 300-character bio has room.
 *
 * **The counts are centred under their figures and the name is a size up** —
 * 18 over 16-and-11, the reference's, where it was 16 over 14-and-11 set flush
 * left.
 *
 * **The widgets are sections of two kinds**, a box or an open one
 * (`components/profile-section`), forty apart, where they were three rows under
 * three hairlines twelve apart. The favourites, the library and the pinned
 * song are a box each.
 *
 * **The margin is the mock's 20**, on this screen alone and on every tab of it
 * (`PROFILE_MARGIN`).
 *
 * The banner is still gone, for the reason it went: a free-text `banner_url`
 * most profiles never set. The column is left in place, as the `posts` tables
 * were.
 */
export function ProfileView({ profileId, headerAction }: ProfileViewProps) {
  const theme = useTheme();
  const clearance = useTabBarClearance();
  const { width } = useWindowDimensions();
  const avatarSize = avatarSizeFor(width);
  /* A collection's card is told its width here, so its stack is the right size
     on its first frame: it would otherwise start from the app's margin. The
     page's column stops at `MaxContentWidth`, so the card's does too. */
  const tileWidth = Math.min(width, MaxContentWidth) - PROFILE_MARGIN * 2;
  const router = useRouter();
  const queryClient = useQueryClient();
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;
  const isSelf = viewerId === profileId;
  const [tab, setTab] = useState<ProfileTab>('profile');

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
  /* The physical / digital split under the games shelf (0028). A count, not a
     list, so it is one small aggregate rather than the copies themselves. */
  const collection = useQuery({
    queryKey: ['user-game-stats', profileId],
    queryFn: () => getUserGameStats(profileId),
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
  /* The wall is the foot of the Profile tab, so it loads with it. */
  const wall = useQuery({
    queryKey: ['wall', profileId],
    queryFn: () => getWall(profileId),
    enabled: tab === 'profile',
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

  const ownerName = profile.data ? displayNameFor(profile.data) : '';

  /*
   * One row renderer for the life of the screen, not one per render.
   *
   * It was an inline arrow, and this screen renders once per query that lands —
   * eleven of them on a cold open — so the list was handed a new `renderItem`
   * each time and re-rendered every visible row to find nothing had changed.
   * Declared above the early returns because it is a hook.
   */
  const renderRow = useCallback(
    ({ item }: { item: ProfileRow }) =>
      item.kind === 'header' ? (
        <DateGroupHeader label={item.label} />
      ) : (
        <View style={styles.rowWrap}>
          {item.kind === 'log' ? (
            /* The review card every list of reviews uses. It was a row of its
               own here — square art, the title, the score — until the owner
               had the Home card replace the rest. */
            <LogCard log={item.log} />
          ) : item.kind === 'list' ? (
            <ListTile list={item.list} width={tileWidth} />
          ) : item.item.type === 'post' ? (
            <WallPostRow post={item.item.post} />
          ) : (
            <ActivityRow entry={item.item.activity} ownerName={ownerName} />
          )}
        </View>
      ),
    [ownerName, tileWidth]
  );

  if (profile.isLoading) return <LoadingState />;
  if (profile.isLoadingError) return <ErrorState error={profile.error} />;
  if (!profile.data) return <EmptyState title="Profile not found" />;

  const person = profile.data;

  type Row = ProfileRow;

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
    case 'profile':
      // The profile is the list's header, and its rows are the wall. The wall
      // is the one list here that reads as a timeline, so it gets calendar
      // group headings — "Today", "Yesterday", "Last week" — rather than
      // relying on per-row relative stamps alone.
      rows = withDateGroups(wall.data ?? [], (item) => item.createdAt).map((row) =>
        row.type === 'header'
          ? ({ kind: 'header', id: `h:${row.label}`, label: row.label } as const)
          : ({ kind: 'wall', id: row.item.id, item: row.item } as const)
      );
      loading = wall.isLoading;
      error = wall.error;
      retry = () => void wall.refetch();
      emptyLabel = isSelf ? 'Nothing on your wall yet.' : 'Nothing on this wall yet.';
  }

  /**
   * Whichever query the visible tab is showing.
   *
   * Pull-to-refresh and the spinner both read from this, so the gesture always
   * refreshes what is under the finger. Reviews reads `logs`, which the header
   * refreshes anyway — it is listed for both so neither path has to special-case
   * the overlap.
   */
  const activeTabQuery =
    tab === 'profile' ? wall : tab === 'lists' ? lists : tab === 'steam' ? steamLibrary : logs;

  /** Unfollowing is quiet and reversible, so it confirms without alarm. */
  function confirmUnfollow() {
    Alert.alert(`Unfollow ${ownerName}?`, 'Their activity will stop appearing in your feed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unfollow', style: 'destructive', onPress: () => toggleFollow.mutate() },
    ]);
  }

  /*
   * The Profile tab, as the list's header: who it is, what they hold, and the
   * head of their wall — whose rows are the list's own, under it.
   *
   * Built only for that tab — the other three hand the list a header of their
   * own (a button, the Steam section) or none.
   */
  const overview = (
    <View style={styles.overview}>
      {/*
        Face on the left; name over reach on the right.

        The reference's row: the face a fifth of the display, and beside it the
        name with the four counts under it, the pair centred on the face. Name
        and face are read together; the handle is in the bar above, so this line
        is the name alone, a long one cut at the edge.
      */}
      <View style={styles.identity}>
        <Avatar uri={person.avatar_url} name={displayNameFor(person)} size={avatarSize} />

        <View style={[styles.identityColumn, { minHeight: avatarSize }]}>
          <Text variant="h3" numberOfLines={1} accessibilityRole="header">
            {displayNameFor(person)}
          </Text>

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
      </View>

      {/*
        Directly under the controls it is about.

        It covers two different failures. A **mutation** that failed is the
        louder one and keeps `danger`. A **query** that failed is quieter but
        matters as much: the Friend and Follow buttons hide themselves when they
        cannot read their own state, so without this line their absence would
        have no explanation at all.
      */}
      {(toggleFollow.isError || friendAction.isError) && (
        <Text variant="bodySmall" color="danger" style={styles.notice}>
          {(toggleFollow.error ?? friendAction.error) instanceof Error
            ? (toggleFollow.error ?? friendAction.error)!.message
            : 'Could not update. Check your connection and try again.'}
        </Text>
      )}

      {!isSelf && (stats.isLoadingError || friendState.isLoadingError) && (
        <Text variant="bodySmall" color="textMuted" style={styles.notice}>
          Could not load your connection to {ownerName}. Pull down to retry.
        </Text>
      )}

      {/*
        The bio and its facts, under the row — the owner's placing; the
        reference sets it between the name and the counts. The words in full
        ink, the place and the platform in a quieter line under them.

        Clamped. `bio` is 300 characters, so a full one pushed everything under
        it down by roughly nine lines. Four is enough to read someone's
        description.
      */}
      {(person.bio || person.favorite_platform || person.location) && (
        <View style={styles.bio}>
          {person.bio && (
            <Text variant="body" numberOfLines={4}>
              {person.bio}
            </Text>
          )}

          {(person.favorite_platform || person.location) && (
            <View style={styles.metaRow}>
              {person.location && <Meta icon="location-outline" label={person.location} />}
              {person.favorite_platform && (
                <Meta icon="game-controller-outline" label={person.favorite_platform} />
              )}
            </View>
          )}
        </View>
      )}

      {/*
        The actions, full width and under everything they are about: "Follow"
        is the single most likely tap on a stranger's page, and it shares its
        line with nothing but the other relationship.
      */}
      <View style={styles.actionRow}>
        {isSelf ? (
          headerAction
        ) : (
          <>
            {/* Friendship and following are separate relationships:
                friending needs consent and unlocks the wall, following is
                one-way and only shapes the feed.

                `state` is passed through undefined rather than coerced with
                `?? 'none'`. That fallback made a failed or in-flight fetch
                render **"Add friend" to someone who already is one** — and, on
                the wall, "Become friends with X to post on their wall" at the
                same time. Unknown is its own state and says nothing. */}
            <View style={styles.actionSlot}>
              <FriendButton
                state={friendState.data}
                pending={friendAction.isPending}
                failed={friendState.isLoadingError}
                onPress={(action) => friendAction.mutate(action)}
              />
            </View>
            {/* Same rule for following. This was `{stats.data && …}`, so a
                failed stats fetch made the Follow button *cease to exist* with
                nothing said — the control vanished rather than reporting it
                could not read its own state. */}
            {!stats.isLoadingError && (
              <View style={styles.actionSlot}>
                <Button
                  title={stats.data?.isFollowing ? 'Following' : 'Follow'}
                  variant={stats.data?.isFollowing ? 'secondary' : 'primary'}
                  size="small"
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

      {/* A box: the four they chose. */}
      <View style={styles.section}>
        <ProfileBox>
          <FavoritesWidget items={favoriteItems} listId={favorites.data?.id} isSelf={isSelf} />
        </ProfileBox>
      </View>

      {/* A box of its own: the library — one shelf for both sources, their
          logs and their Steam games, as a stack. It shared the favourites' box
          for one pass, and the owner had it detached. */}
      <View style={styles.section}>
        <ProfileBox>
          <GamesWidget
            ownerName={ownerName}
            profileId={profileId}
            games={shelf}
            achievementsUnlocked={achievementStats.data?.achievements_unlocked ?? null}
            /* Steam's total where an account is linked, the app's logged hours
               otherwise. Not summed: a game played on Steam *and* logged here
               would have its hours counted twice, and the larger, wronger number
               is the one people would notice. */
            playtimeMinutes={
              steamStats.data?.totalPlaytimeMinutes ??
              (achievementStats.data ? Math.round(achievementStats.data.hours_played * 60) : null)
            }
            digitalCount={collection.data?.digital ?? null}
            physicalCount={collection.data?.physical ?? null}
          />
        </ProfileBox>
      </View>

      {/* A box, and only when someone has pinned a track — it brings its own
          space above it, so a profile without one has no gap where it would
          be. */}
      <StarredSongWidget profileId={profileId} />

      {/*
        The wall, under everything else: its heading, then the composer. Its
        rows are the list's, below this header.

        The composer is for the owner always and for accepted friends —
        matching what the RLS policy will actually allow, so nobody is offered a
        box that will be rejected.

        `friendState.data &&` guards the other claim. Without it an unresolved
        query rendered the hint to an actual friend, telling them to befriend
        someone they already had.
      */}
      <View style={styles.section}>
        <ProfileSectionHeader title="Wall" />
        {viewerId && (isSelf || friendState.data === 'friends') ? (
          <WallComposer wallOwnerId={profileId} authorId={viewerId} isOwnWall={isSelf} />
        ) : !isSelf && friendState.data && friendState.data !== 'friends' ? (
          <Text variant="bodySmall" color="textMuted">
            Become friends with {ownerName} to post on their wall.
          </Text>
        ) : null}
      </View>
    </View>
  );

  /* What stands above a tab's rows. Every one of these scrolls with the list. */
  const header =
    tab === 'profile' ? (
      overview
    ) : tab === 'lists' ? (
      isSelf ? (
        <View style={styles.tabHead}>
          <Button
            title="New collection"
            variant="secondary"
            onPress={() => router.push('/new-list')}
            fullWidth
          />
        </View>
      ) : null
    ) : tab === 'steam' ? (
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
    ) : null;

  return (
    <View style={styles.screen}>
      {/*
        The tabs, at the top and outside the list: the reference's row under its
        title bar. Words, in the app's own pills; the four of them still run a
        little past a narrow phone's edge, and the row scrolls, as the
        reference's does.

        `inset`: this screen keeps the mock's margin, and the first pill lines
        up with the page.
      */}
      <TabBar
        tabs={TABS}
        value={tab}
        onChange={setTab}
        inset={PROFILE_MARGIN}
        label="Profile sections"
      />

      <FlatList
        /* A list per tab. Each starts at its own top: the offset somebody
           scrolled the profile to means nothing in their reviews. */
        key={tab}
        data={rows}
        keyExtractor={rowKey}
        renderItem={renderRow}
        ItemSeparatorComponent={RowSeparator}
        contentContainerStyle={[styles.content, { paddingBottom: Spacing.x48 + clearance }]}
        showsVerticalScrollIndicator={false}
        /*
         * Keyboard insets, and deliberately *not* the `<KeyboardAvoidingView>`
         * every other composer in this app uses.
         *
         * That pattern fits the shape those screens have — comments, the log
         * form, new-list and edit-profile all pin their composer to the bottom,
         * outside the scroller, so shrinking the container is exactly right.
         * The wall composer is different: it lives *inside* this list's header
         * and scrolls with the content. Wrapping the list would only shrink the
         * viewport; it would not bring a mid-content input above the keyboard.
         *
         * `automaticallyAdjustKeyboardInsets` is the iOS answer for an input
         * inside a scroller — it adds bottom inset equal to the keyboard, so the
         * focused field can be scrolled clear. Android gets the same outcome
         * from `softwareKeyboardLayoutMode: 'resize'` in app.json, where the
         * window itself resizes and the list scrolls the focused input into
         * view.
         *
         * `persistTaps` is what makes "Post" actually pressable while the
         * keyboard is up rather than the first tap only dismissing it;
         * `on-drag` is the timeline convention — scrolling away from a
         * half-written note puts the keyboard away rather than leaving it
         * covering the page.
         */
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            /* The visible tab is included, and drives the spinner: the gesture
               refreshes what is under the finger. `colors` as well as
               `tintColor`: the latter is iOS-only and Android was falling back
               to a default hue. */
            refreshing={logs.isRefetching || activeTabQuery.isRefetching}
            onRefresh={() => {
              logs.refetch();
              stats.refetch();
              achievementStats.refetch();
              favorites.refetch();
              friendCount.refetch();
              /* Included so "Pull down to retry" under the action row is a true
                 statement — this is the query whose failure hides those
                 buttons. */
              friendState.refetch();
              activeTabQuery.refetch();
            }}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
        ListHeaderComponent={header}
        /* Three outcomes, not two. A failure gets its own state and a way out —
           rendering "No reviews yet" because a request failed is the page
           stating something about a person that it does not know. The Steam
           tab is all header and has nothing to be empty of.

           The wall's are quiet lines, not the centred states the other tabs
           get: it is the last section of a page that is already full, and a
           screen-sized "Could not load" under somebody's whole profile would
           say the profile had failed. */
        ListEmptyComponent={
          tab === 'steam' ? null : loading ? (
            <LoadingState />
          ) : tab === 'profile' ? (
            <WallNotice
              label={error ? 'The wall did not load.' : emptyLabel}
              onRetry={error && retry ? retry : undefined}
            />
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
    </View>
  );
}

/**
 * What the wall says in place of its rows: that there is nothing on it, or that
 * it did not load — with the way to ask again beside the words.
 */
function WallNotice({ label, onRetry }: { label: string; onRetry?: () => void }) {
  return (
    <View style={styles.wallNotice}>
      <Text variant="body" color="textMuted">
        {label}
      </Text>
      {onRetry && (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Try loading the wall again"
          onPress={onRetry}
          /* A line of 13 is 19dp; fourteen each way reaches the tap floor. */
          hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
          scaleTo={0.94}>
          <Text variant="body" color="primaryText">
            Try again
          </Text>
        </PressableScale>
      )}
    </View>
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
      <Ionicons name={icon} size={14} color={theme.textSecondary} />
      <Text variant="body" color="textSecondary" numberOfLines={1} style={styles.metaLabel}>
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

  /* Figure over word, each centred on the other, as the reference sets "306 /
     Films": the figure bold at 16, the word at 11 in the quieter ink — a step
     under the name above them, so the name stays the first thing read. The row
     spreads the four across the column (`styles.counts`). */
  const body = (
    <>
      <Text variant="h4" numberOfLines={1}>
        {shown}
      </Text>
      <Text variant="bodySmall" color="textSecondary" numberOfLines={1}>
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
        /* Stacked, the count is a 21dp figure over a 15dp word — 36dp — and 8
           of slop each side takes it past both platforms' floors. */
        hitSlop={8}
        style={StyleSheet.flatten([styles.count])}>
        {body}
      </PressableScale>
    </Link>
  );
}

const styles = StyleSheet.create({
  /* The tab row, then the list filling what is left. */
  screen: { flex: 1 },
  /* Twenty under the tab row, whichever tab is showing: with the row's own
     eight that is the reference's distance from its tabs to the face. */
  content: { paddingTop: Spacing.x20, paddingBottom: Spacing.x48 },
  rowWrap: { paddingHorizontal: PROFILE_MARGIN },
  /* What a tab puts above its rows — the Collections tab's button — and the
     space before the first of them. */
  tabHead: { paddingHorizontal: PROFILE_MARGIN, paddingBottom: Spacing.x16 },
  overview: { paddingHorizontal: PROFILE_MARGIN },
  /* One row: the face, and the column beside it, centred on the face. */
  identity: { flexDirection: 'row', alignItems: 'center', gap: IDENTITY_GAP },
  /*
   * The name, then the counts twelve under it, as one block centred on the
   * face — 23 and 36 and the twelve between come to 71 against a 76dp face on a
   * 360dp phone, so the block and the face are the same height.
   *
   * `minHeight` (the face, inline) rather than a height, so the OS text-size
   * setting can grow the column instead of clipping the counts. `minWidth: 0`
   * so a long name truncates rather than widening the column past the screen.
   */
  identityColumn: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: Spacing.x12,
  },
  /*
   * The four counts spread across the column: the first under the name, the
   * last at the page's edge, the space between shared out. The reference sets
   * them 27pt apart from the name's left edge, which on its 375pt screen is the
   * same thing — four words at 11 take ~184dp of the 220 a 360dp phone leaves,
   * so "apart" here is twelve.
   */
  counts: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.x4 },
  /* Figure over word, centred. Shrinks rather than overflowing at a large OS
     text size or on a 320dp phone, where the words have no room to spare. */
  count: { alignItems: 'center', flexShrink: 1 },
  /* A line about a control that failed, under the row those controls follow. */
  notice: { marginTop: Spacing.x12 },
  /* Sixteen under the row; the bio and its facts close together, one block. */
  bio: { marginTop: Spacing.x16, gap: Spacing.x4 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.x16, rowGap: Spacing.x4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4, flexShrink: 1 },
  metaLabel: { flexShrink: 1 },
  /* Full width, and its children share the width evenly. `alignItems` stretch
     (the default) so both buttons are the same height whatever is in them. */
  actionRow: { flexDirection: 'row', gap: Spacing.x8, marginTop: Spacing.x16 },
  actionSlot: { flex: 1 },
  /* The reference's distance from one section to the next, and from the header
     to the first of them. */
  section: { marginTop: SECTION_GAP },
  steamStack: { gap: Spacing.x16 },
  /* One line where the wall's rows would be, at the page's margin, twelve
     under whatever the wall's head ended on. */
  wallNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    paddingHorizontal: PROFILE_MARGIN,
    paddingTop: Spacing.x12,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    paddingHorizontal: PROFILE_MARGIN,
    paddingTop: Spacing.x16,
    paddingBottom: Spacing.x8,
  },
  groupRule: { flex: 1, height: StyleSheet.hairlineWidth },
  wallDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: PROFILE_MARGIN,
    marginVertical: Spacing.x12,
  },
});
