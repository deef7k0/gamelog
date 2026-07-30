import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { setLiked, type Engagement, type TargetType } from '@/lib/api';
import { useAuth } from '@/store/auth';

export type EngagementBarProps = {
  targetType: TargetType;
  targetId: string;
  engagement?: Engagement;
  /** Extra text shown after the counts, e.g. a game title for sharing. */
  shareMessage?: string;
  /**
   * `inline` puts counts beside their icons (compact, used on log cards).
   * `stacked` is the Instagram treatment: bare icons, then a bold "N likes"
   * line underneath. The like count has to live in here either way because the
   * optimistic toggle state does.
   */
  layout?: 'inline' | 'stacked';
};

/** Like / comment / share row shared by post cards and log cards. */
export function EngagementBar({
  targetType,
  targetId,
  engagement,
  shareMessage,
  layout = 'inline',
}: EngagementBarProps) {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useAuth((state) => state.session?.user.id);

  /*
   * Optimistic local state. The feed's engagement map is fetched in bulk and
   * only refreshed on pull-to-refresh, so without this a tapped heart would
   * stay grey until the next refetch.
   */
  const [override, setOverride] = useState<{ liked: boolean; delta: number } | null>(null);

  const liked = override?.liked ?? engagement?.likedByViewer ?? false;
  const likeCount = (engagement?.likes ?? 0) + (override?.delta ?? 0);
  const commentCount = engagement?.comments ?? 0;

  const toggle = useMutation({
    mutationFn: async (next: boolean) => {
      if (!userId) throw new Error('You must be signed in.');
      await setLiked(userId, targetType, targetId, next);
    },
    onMutate: (next: boolean) => {
      const base = engagement?.likedByViewer ?? false;
      // Delta is relative to the server value, so toggling back to the original
      // state cancels out to zero rather than drifting.
      setOverride({ liked: next, delta: next === base ? 0 : next ? 1 : -1 });
    },
    onError: () => setOverride(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  async function handleShare() {
    try {
      await Share.share({ message: shareMessage ?? 'Check this out on GameLog' });
    } catch {
      // User dismissed the sheet; nothing to report.
    }
  }

  const stacked = layout === 'stacked';
  // Stacked mode uses bare, larger, higher-contrast icons — the Instagram look.
  const idleTint = stacked ? theme.text : theme.textMuted;
  const iconSize = stacked ? 25 : 21;

  return (
    <View style={stacked ? styles.stack : undefined}>
      <View style={styles.row}>
        <Action
          icon={liked ? 'heart' : 'heart-outline'}
          tint={liked ? theme.danger : idleTint}
          count={stacked ? undefined : likeCount}
          size={iconSize}
          label={liked ? 'Unlike' : 'Like'}
          onPress={() => toggle.mutate(!liked)}
        />

        <Action
          icon="chatbubble-outline"
          tint={idleTint}
          count={stacked ? undefined : commentCount}
          size={iconSize}
          label="Comments"
          onPress={() =>
            router.push({
              pathname: '/comments/[type]/[id]',
              params: { type: targetType, id: targetId },
            })
          }
        />

        <Action
          icon="paper-plane-outline"
          tint={idleTint}
          size={iconSize}
          label="Share"
          onPress={handleShare}
        />
      </View>

      {stacked && likeCount > 0 && (
        <Text variant="bodyStrong">
          {likeCount} {likeCount === 1 ? 'like' : 'likes'}
        </Text>
      )}
    </View>
  );
}

function Action({
  icon,
  tint,
  count,
  label,
  size = 21,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  count?: number;
  label: string;
  size?: number;
  onPress: () => void;
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      scaleTo={0.9}
      style={styles.action}>
      <Ionicons name={icon} size={size} color={tint} />
      {count !== undefined && count > 0 && (
        <Text variant="caption" color="textMuted">
          {count}
        </Text>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  stack: { gap: Spacing.one },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.five },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
});
