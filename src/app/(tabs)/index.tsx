import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { LogCard } from '@/components/log-card';
import { ArticleCard } from '@/components/article-card';
import { PostCard } from '@/components/post-card';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  getDiscoverFeed,
  getEngagement,
  getHomeFeed,
  getUnreadCount,
  type FeedItem,
} from '@/lib/api';
import { useAuth } from '@/store/auth';

type FeedScope = 'following' | 'discover';

export default function FeedScreen() {
  const theme = useTheme();
  const router = useRouter();
  const userId = useAuth((state) => state.session?.user.id);
  const [scope, setScope] = useState<FeedScope>('following');

  const feed = useQuery({
    queryKey: ['feed', scope, userId],
    queryFn: () => (scope === 'following' && userId ? getHomeFeed(userId) : getDiscoverFeed()),
    enabled: !!userId,
  });

  const unread = useQuery({
    queryKey: ['notifications', 'unread', userId],
    queryFn: () => getUnreadCount(userId!),
    enabled: !!userId,
    refetchInterval: 60_000,
  });
  const unreadCount = unread.data ?? 0;

  const items = useMemo(() => feed.data ?? [], [feed.data]);

  // Split the ids by kind — likes/comments are stored per target type, so the
  // two need separate lookups even though they render in one list.
  const { postIds, logIds } = useMemo(() => {
    const postIds: string[] = [];
    const logIds: string[] = [];
    for (const item of items) {
      if (item.type === 'post') postIds.push(item.post.id);
      else logIds.push(item.log.id);
    }
    return { postIds, logIds };
  }, [items]);

  /*
   * One bulk engagement fetch for the whole page rather than a query per card.
   * Keyed on the ids so it re-runs when the feed content actually changes.
   */
  const engagement = useQuery({
    queryKey: ['engagement', scope, postIds.join(','), logIds.join(','), userId],
    queryFn: async () => {
      const [posts, logs] = await Promise.all([
        getEngagement('post', postIds, userId ?? null),
        getEngagement('log', logIds, userId ?? null),
      ]);
      return { posts, logs };
    },
    enabled: items.length > 0,
  });

  function renderItem(item: FeedItem) {
    if (item.type === 'post') {
      // Articles get their own card: headline-led, with a spoiler gate.
      if (item.post.kind === 'article') {
        return <ArticleCard article={item.post} />;
      }
      return <PostCard post={item.post} engagement={engagement.data?.posts[item.post.id]} />;
    }
    return <LogCard log={item.log} engagement={engagement.data?.logs[item.log.id]} />;
  }

  return (
    <Screen edges={['top']}>
      {/* Notifications live here rather than in the tab bar. */}
      <View style={styles.appBar}>
        <Text variant="title">GameLog</Text>

        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={
            unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
          }
          onPress={() => router.push('/notifications')}
          scaleTo={0.88}
          style={styles.bell}>
          <Ionicons
            name={unreadCount > 0 ? 'heart' : 'heart-outline'}
            size={26}
            color={unreadCount > 0 ? theme.danger : theme.text}
          />
          {unreadCount > 0 && (
            <View
              style={[
                styles.badge,
                { backgroundColor: theme.danger, borderColor: theme.background },
              ]}>
              <Text variant="micro" style={styles.badgeText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </PressableScale>
      </View>

      <View style={[styles.tabs, { borderBottomColor: theme.border }]}>
        {(['following', 'discover'] as const).map((option) => {
          const active = scope === option;
          return (
            <PressableScale
              key={option}
              onPress={() => setScope(option)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              scaleTo={0.96}
              style={StyleSheet.flatten([
                styles.tab,
                { borderBottomColor: active ? theme.text : 'transparent' },
              ])}>
              <Text variant="bodyStrong" color={active ? 'text' : 'textMuted'}>
                {option === 'following' ? 'Following' : 'Discover'}
              </Text>
            </PressableScale>
          );
        })}
      </View>

      {feed.isLoading ? (
        <LoadingState />
      ) : feed.isError ? (
        <ErrorState
          error={feed.error}
          action={<Button title="Retry" variant="secondary" onPress={() => feed.refetch()} />}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => renderItem(item)}
          contentContainerStyle={items.length === 0 ? styles.emptyContainer : styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.three }} />}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={feed.isRefetching}
              onRefresh={() => {
                feed.refetch();
                engagement.refetch();
              }}
              tintColor={theme.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title={scope === 'following' ? 'Your feed is quiet' : 'Nothing here yet'}
              message={
                scope === 'following'
                  ? 'Follow some people, or post something yourself.'
                  : 'Be the first — log a game or write a post.'
              }
              action={
                <Button
                  title="Create a post"
                  onPress={() => router.push('/create')}
                  variant="secondary"
                />
              }
            />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  bell: { padding: Spacing.one },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#FFFFFF', fontWeight: '700' },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { paddingVertical: Spacing.three, paddingHorizontal: Spacing.five, borderBottomWidth: 2 },
  listContent: { padding: Spacing.four, paddingBottom: Spacing.seven },
  emptyContainer: { flexGrow: 1 },
});
