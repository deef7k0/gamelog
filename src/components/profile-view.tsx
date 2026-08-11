import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ArticleCard } from '@/components/article-card';
import { ConnectAccountCard } from '@/components/gaming/connect-card';
import { LibraryWidget } from '@/components/gaming/library-widget';
import { SteamSection } from '@/components/gaming/steam-section';
import { ListTile } from '@/components/list-tile';
import { LogCard } from '@/components/log-card';
import { PostCard } from '@/components/post-card';
import { AchievementsWidget, FavoritesWidget } from '@/components/profile-widgets';
import { StarredSongWidget } from '@/components/starred-song-widget';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/screen';
import { Card } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { HeroAspectRatio, Radius, Spacing } from '@/constants/theme';
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
  getUserPosts,
  getWall,
  removeFriendship,
  sendFriendRequest,
  unfollowUser,
  type FriendState,
} from '@/lib/api';
import { displayNameFor, withDateGroups } from '@/lib/format';
import { useGamingSync, useLinkedAccount } from '@/hooks/use-gaming';
import { useAuth } from '@/store/auth';

type ProfileTab = 'wall' | 'posts' | 'reviews' | 'lists' | 'steam' | 'about';

const TABS: { key: ProfileTab; label: string }[] = [
  { key: 'wall', label: 'Wall' },
  { key: 'posts', label: 'Posts' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'lists', label: 'Collections' },
  { key: 'steam', label: 'Steam' },
  { key: 'about', label: 'About' },
];

export type ProfileViewProps = {
  profileId: string;
  headerAction?: ReactNode;
};

/**
 * Profile, laid out the way X/Twitter does it.
 *
 * Order is: banner → identity → bio → stats → compact widgets → tab bar → tab
 * content. The tab bar is the last thing in `ListHeaderComponent`, so it sits
 * directly above the list it controls rather than being buried under full-width
 * favourite and achievement sections.
 */
export function ProfileView({ profileId, headerAction }: ProfileViewProps) {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;
  const isSelf = viewerId === profileId;
  const [tab, setTab] = useState<ProfileTab>('wall');

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
  const posts = useQuery({
    queryKey: ['user-posts', profileId],
    queryFn: () => getUserPosts(profileId),
    enabled: tab === 'posts',
  });
  const lists = useQuery({
    queryKey: ['lists', profileId],
    queryFn: () => getLists(profileId),
    enabled: tab === 'lists',
  });
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
    queryFn: () => getOwnedGames(profileId, { sort: 'most-played', limit: 8 }),
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

  if (profile.isLoading) return <LoadingState />;
  if (profile.isError) return <ErrorState error={profile.error} />;
  if (!profile.data) return <EmptyState title="Profile not found" />;

  const person = profile.data;
  // Reviews are logs that carry an actual article, not just a score.
  const reviews = (logs.data ?? []).filter((log) => log.review);

  type Row =
    | { kind: 'header'; id: string; label: string }
    | { kind: 'log'; id: string; log: (typeof reviews)[number] }
    | { kind: 'post'; id: string; post: NonNullable<typeof posts.data>[number] }
    | { kind: 'list'; id: string; list: NonNullable<typeof lists.data>[number] }
    | { kind: 'wall'; id: string; item: NonNullable<typeof wall.data>[number] };

  let rows: Row[] = [];
  let loading = false;
  let emptyLabel = '';

  switch (tab) {
    case 'posts':
      rows = (posts.data ?? []).map((post) => ({ kind: 'post', id: post.id, post }));
      loading = posts.isLoading;
      emptyLabel = 'No posts yet';
      break;
    case 'reviews':
      rows = reviews.map((log) => ({ kind: 'log', id: log.id, log }));
      loading = logs.isLoading;
      emptyLabel = 'No reviews yet';
      break;
    case 'lists':
      rows = (lists.data ?? []).map((list) => ({ kind: 'list', id: list.id, list }));
      loading = lists.isLoading;
      emptyLabel = 'No collections yet';
      break;
    case 'steam':
    case 'about':
      // Both render entirely from the header; the list itself stays empty.
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
      emptyLabel = isSelf ? 'Your wall is empty' : 'Nothing on this wall yet';
  }

  const ownerName = displayNameFor(person);

  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => `${row.kind}:${row.id}`}
      renderItem={({ item }) =>
        item.kind === 'header' ? (
          <DateGroupHeader label={item.label} />
        ) : (
          <View style={styles.rowWrap}>
            {item.kind === 'post' ? (
              item.post.kind === 'article' ? (
                <ArticleCard article={item.post} showAuthor={false} />
              ) : (
                <PostCard post={item.post} showAuthor={false} />
              )
            ) : item.kind === 'list' ? (
              <ListTile list={item.list} />
            ) : item.kind === 'wall' ? (
              item.item.type === 'post' ? (
                <WallPostRow post={item.item.post} />
              ) : (
                <ActivityRow entry={item.item.activity} ownerName={ownerName} ownerId={profileId} />
              )
            ) : (
              <LogCard log={item.log} showAuthor={false} />
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
      refreshControl={
        <RefreshControl
          refreshing={logs.isRefetching}
          onRefresh={() => {
            logs.refetch();
            stats.refetch();
            achievementStats.refetch();
            favorites.refetch();
          }}
          tintColor={theme.primary}
        />
      }
      ListHeaderComponent={
        <View>
          <View style={styles.banner}>
            {person.banner_url ? (
              <Image
                source={{ uri: person.banner_url }}
                style={styles.bannerImage}
                contentFit="cover"
                transition={220}
                accessibilityIgnoresInvertColors
              />
            ) : (
              <View style={[styles.bannerImage, { backgroundColor: theme.surfaceElevated }]} />
            )}
          </View>

          <View style={styles.headerBody}>
            <View style={styles.identity}>
              <View style={[styles.avatarRing, { borderColor: theme.background }]}>
                <Avatar uri={person.avatar_url} name={displayNameFor(person)} size={76} />
              </View>
              <View style={styles.identityAction}>
                {isSelf ? (
                  headerAction
                ) : (
                  <View style={styles.actionRow}>
                    {/* Friendship and following are separate relationships:
                        friending needs consent and unlocks the wall, following
                        is one-way and only shapes the feed. */}
                    <FriendButton
                      state={friendState.data ?? 'none'}
                      pending={friendAction.isPending}
                      onPress={(action) => friendAction.mutate(action)}
                    />
                    {stats.data && (
                      <Button
                        title={stats.data.isFollowing ? 'Following' : 'Follow'}
                        variant={stats.data.isFollowing ? 'secondary' : 'primary'}
                        size="small"
                        onPress={() => toggleFollow.mutate()}
                        loading={toggleFollow.isPending}
                      />
                    )}
                  </View>
                )}
              </View>
            </View>

            <View style={styles.nameBlock}>
              <Text variant="h1" numberOfLines={1}>
                {displayNameFor(person)}
              </Text>
              <Text variant="bodySmall" color="textMuted" numberOfLines={1}>
                @{person.username}
              </Text>
            </View>

            {person.bio && (
              <Text variant="body" color="textSecondary">
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

            {/* X-style inline counts: value bold, label muted, on one line. */}
            <View style={styles.counts}>
              <Count value={stats.data?.logged} label="Logged" />
              <Count value={friendCount.data} label="Friends" />
              <Count value={stats.data?.followers} label="Followers" />
              <Count value={stats.data?.following} label="Following" />
            </View>

            <View style={styles.widgets}>
              <FavoritesWidget
                items={favorites.data?.items ?? []}
                listId={favorites.data?.id}
                isSelf={isSelf}
              />
            </View>

            {/* The library widget only earns its space once Steam is linked. */}
            {steamAccount.data && (
              <View style={styles.widgets}>
                <LibraryWidget
                  profileId={profileId}
                  games={steamLibrary.data ?? []}
                  stats={steamStats.data}
                  loading={steamLibrary.isLoading}
                  isPrivate={steamAccount.data.visibility === 'private'}
                />
              </View>
            )}

            <View style={styles.widgets}>
              <AchievementsWidget stats={achievementStats.data} profileId={profileId} />
            </View>

            {/* Renders nothing until someone pins a track, so it costs no
                vertical space on a profile that has not used the feature. */}
            <View style={styles.widgets}>
              <StarredSongWidget profileId={profileId} />
            </View>

            {toggleFollow.isError && (
              <Text variant="bodySmall" color="danger">
                {toggleFollow.error instanceof Error
                  ? toggleFollow.error.message
                  : 'Could not update follow.'}
              </Text>
            )}
          </View>

          {/* Tab bar, flush against the content it filters. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[styles.tabs, { borderBottomColor: theme.border }]}
            contentContainerStyle={styles.tabsContent}>
            {TABS.map((entry) => {
              const active = tab === entry.key;
              return (
                <PressableScale
                  key={entry.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => setTab(entry.key)}
                  scaleTo={0.94}
                  style={StyleSheet.flatten([
                    styles.tab,
                    { borderBottomColor: active ? theme.primary : 'transparent' },
                  ])}>
                  <Text variant="h5" color={active ? 'text' : 'textMuted'}>
                    {entry.label}
                  </Text>
                </PressableScale>
              );
            })}
          </ScrollView>

          {/* Composer sits under the tab bar. Shown to the owner always, and to
              accepted friends — matching what the RLS policy will actually
              allow, so nobody is offered a box that will be rejected. */}
          {tab === 'wall' && viewerId && (isSelf || friendState.data === 'friends') && (
            <View style={styles.rowWrap}>
              <WallComposer wallOwnerId={profileId} authorId={viewerId} isOwnWall={isSelf} />
            </View>
          )}

          {tab === 'wall' && !isSelf && friendState.data !== 'friends' && (
            <View style={styles.rowWrap}>
              <Text variant="bodySmall" color="textMuted">
                Become friends with {ownerName.split(' ')[0]} to post on their wall.
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
                  message={`${ownerName.split(' ')[0]} has not linked a Steam account.`}
                />
              )}
            </View>
          )}

          {tab === 'about' && (
            <View style={styles.rowWrap}>
              <Card>
                <View style={styles.about}>
                  <AboutRow label="Username" value={`@${person.username}`} />
                  {person.favorite_platform && (
                    <AboutRow label="Favourite platform" value={person.favorite_platform} />
                  )}
                  {person.location && <AboutRow label="Location" value={person.location} />}
                  {person.steam_id && <AboutRow label="Steam linked" value="Yes" />}
                  <AboutRow
                    label="Joined"
                    value={new Date(person.created_at).toLocaleDateString(undefined, {
                      month: 'long',
                      year: 'numeric',
                    })}
                  />
                </View>
              </Card>
            </View>
          )}
        </View>
      }
      ListEmptyComponent={
        tab === 'about' || tab === 'steam' ? null : loading ? (
          <LoadingState />
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
 */
function FriendButton({
  state,
  pending,
  onPress,
}: {
  state: FriendState;
  pending: boolean;
  onPress: (action: 'request' | 'accept' | 'remove') => void;
}) {
  switch (state) {
    case 'friends':
      return (
        <Button
          title="Friends"
          variant="secondary"
          size="small"
          loading={pending}
          onPress={() => onPress('remove')}
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
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={14} color={theme.textMuted} />
      <Text variant="bodySmall" color="textMuted">
        {label}
      </Text>
    </View>
  );
}

function Count({ value, label }: { value?: number; label: string }) {
  return (
    <View style={styles.count}>
      <Text variant="h5">{value ?? '—'}</Text>
      <Text variant="bodySmall" color="textMuted">
        {label}
      </Text>
    </View>
  );
}

function AboutRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.aboutRow}>
      <Text variant="bodySmall" color="textMuted">
        {label}
      </Text>
      <Text variant="bodySmall">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.x48 },
  rowWrap: { paddingHorizontal: Spacing.x16 },
  banner: { width: '100%' },
  bannerImage: { width: '100%', aspectRatio: HeroAspectRatio / 2 },
  headerBody: { paddingHorizontal: Spacing.x16, gap: Spacing.x12 },
  identity: { flexDirection: 'row', alignItems: 'flex-end', marginTop: -Spacing.x40 },
  avatarRing: { borderRadius: Radius.pill, borderWidth: 4 },
  identityAction: { flex: 1, alignItems: 'flex-end', paddingBottom: Spacing.x8 },
  nameBlock: { gap: 1 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.x16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
  actionRow: { flexDirection: 'row', gap: Spacing.x8, alignItems: 'center' },
  counts: { flexDirection: 'row', gap: Spacing.x16, flexWrap: 'wrap' },
  count: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.x4 },
  widgets: { flexDirection: 'row', gap: Spacing.x12 },
  tabs: { borderBottomWidth: StyleSheet.hairlineWidth, marginTop: Spacing.x16 },
  tabsContent: { paddingHorizontal: Spacing.x8 },
  tab: { paddingVertical: Spacing.x12, paddingHorizontal: Spacing.x16, borderBottomWidth: 2.5 },
  about: { gap: Spacing.x12 },
  aboutRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.x16 },
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
