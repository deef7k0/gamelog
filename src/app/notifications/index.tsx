import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { RefreshControl, SectionList, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  getNotifications,
  groupNotifications,
  markAllRead,
  type AppNotification,
  type NotificationKind,
} from '@/lib/api';
import { displayNameFor, timeAgo } from '@/lib/format';
import { useAuth } from '@/store/auth';

const VERB: Record<NotificationKind, string> = {
  like: 'liked your',
  comment: 'commented on your',
  reply: 'replied to your comment on a',
  follow: 'started following you',
  friend_request: 'sent you a friend request',
  friend_accepted: 'accepted your friend request',
  wall_post: 'posted on your wall',
};

const ICON: Record<NotificationKind, keyof typeof Ionicons.glyphMap> = {
  like: 'heart',
  comment: 'chatbubble',
  reply: 'return-down-forward',
  follow: 'person-add',
  friend_request: 'person-add',
  friend_accepted: 'people',
  wall_post: 'create',
};

/** Kinds that are about a person rather than a post or review. */
const PERSON_KINDS: readonly NotificationKind[] = [
  'follow',
  'friend_request',
  'friend_accepted',
  'wall_post',
];

export default function NotificationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useAuth((state) => state.session?.user.id);

  const notifications = useQuery({
    queryKey: ['notifications', userId],
    queryFn: () => getNotifications(userId!),
    enabled: !!userId,
  });

  const sections = useMemo(
    () => groupNotifications(notifications.data ?? []),
    [notifications.data]
  );

  const markRead = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      await markAllRead(userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const hasUnread = (notifications.data ?? []).some((entry) => !entry.read);

  function open(notification: AppNotification) {
    // Friend requests, follows and wall posts are all resolved on a profile —
    // the request is accepted from there, and wall posts live there too.
    if (PERSON_KINDS.includes(notification.kind)) {
      const target =
        notification.kind === 'wall_post'
          ? (userId ?? notification.actor_id)
          : notification.actor_id;
      router.push({ pathname: '/profile/[id]', params: { id: target } });
      return;
    }
    if (notification.target_type && notification.target_id) {
      router.push({
        pathname: '/comments/[type]/[id]',
        params: { type: notification.target_type, id: notification.target_id },
      });
    }
  }

  if (notifications.isLoading) {
    return (
      <Screen edges={[]} insetHeader>
        <LoadingState />
      </Screen>
    );
  }

  if (notifications.isError) {
    return (
      <Screen edges={[]} insetHeader>
        <ErrorState error={notifications.error} />
      </Screen>
    );
  }

  return (
    <Screen edges={[]} insetHeader>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={sections.length === 0 ? styles.empty : styles.content}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={notifications.isRefetching}
            onRefresh={notifications.refetch}
            tintColor={theme.primary}
          />
        }
        ListHeaderComponent={
          hasUnread ? (
            <PressableScale
              accessibilityRole="button"
              onPress={() => markRead.mutate()}
              scaleTo={0.98}
              style={StyleSheet.flatten([styles.markRead, { borderColor: theme.border }])}>
              <Text variant="caption" color="primary">
                Mark all as read
              </Text>
            </PressableScale>
          ) : null
        }
        renderSectionHeader={({ section }) => (
          <Text variant="section" style={styles.sectionTitle}>
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => (
          <PressableScale
            accessibilityRole="button"
            onPress={() => open(item)}
            scaleTo={0.99}
            style={StyleSheet.flatten([
              styles.row,
              { backgroundColor: item.read ? 'transparent' : theme.primaryMuted },
            ])}>
            <View>
              <Avatar uri={item.actor?.avatar_url} name={displayNameFor(item.actor)} size={44} />
              <View style={[styles.badge, { backgroundColor: theme.background }]}>
                <Ionicons
                  name={ICON[item.kind]}
                  size={12}
                  color={item.kind === 'like' ? theme.danger : theme.primary}
                />
              </View>
            </View>

            <View style={styles.rowText}>
              <Text variant="body" numberOfLines={2}>
                <Text variant="bodyStrong">{displayNameFor(item.actor)}</Text> {VERB[item.kind]}
                {PERSON_KINDS.includes(item.kind)
                  ? ''
                  : item.target_type === 'log'
                    ? ' review'
                    : ' post'}
              </Text>
              <Text variant="micro" color="textMuted">
                {timeAgo(item.created_at)}
              </Text>
            </View>

            {!item.read && <View style={[styles.dot, { backgroundColor: theme.primary }]} />}
          </PressableScale>
        )}
        ListEmptyComponent={
          <EmptyState
            title="Nothing yet"
            message="Likes, comments and new followers will show up here."
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.one, paddingBottom: Spacing.seven },
  empty: { flexGrow: 1 },
  sectionTitle: { marginTop: Spacing.four, marginBottom: Spacing.two },
  /* Outlined, not filled: it is a button, and the fill it used to have is the
     one thing the de-bubble reserved for content that is *yours*. */
  markRead: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.medium,
  },
  rowText: { flex: 1, gap: 2 },
  badge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
