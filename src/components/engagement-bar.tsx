import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Share, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useLikeToggle } from '@/hooks/use-like-toggle';
import { useTheme } from '@/hooks/use-theme';
import type { Engagement, TargetType } from '@/lib/api';

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

  /* The optimistic toggle lives in the hook, shared with the collection
     masthead — see `hooks/use-like-toggle`. */
  const { liked, likeCount, commentCount, toggle } = useLikeToggle(
    targetType,
    targetId,
    engagement
  );

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
          onPress={toggle}
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
        <Text variant="h5">
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
        <Text variant="bodySmall" color="textMuted">
          {count}
        </Text>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  stack: { gap: Spacing.x4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x24 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    paddingVertical: Spacing.x4,
  },
});
