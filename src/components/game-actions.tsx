import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Share, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getListMembership, saveLog, toggleSingletonMembership } from '@/lib/api';
import type { GameLog } from '@/lib/database.types';
import type { Game } from '@/lib/games';
import { useAuth } from '@/store/auth';

export type GameActionsProps = {
  game: Game;
  /** The viewer's existing log, if any — drives the Playing/Played toggles. */
  log: GameLog | null;
};

/**
 * The quick-action row on a game page: review, favourite, wishlist, mark
 * playing/completed, share.
 *
 * Status toggles write straight through `saveLog` so a user can mark something
 * without opening the full log form; the form is still there for ratings and
 * reviews.
 */
export function GameActions({ game, log }: GameActionsProps) {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useAuth((state) => state.session?.user.id);

  const membership = useQuery({
    queryKey: ['list-membership', userId, game.id],
    queryFn: () => getListMembership(userId!, game.id),
    enabled: !!userId,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['list-membership', userId, game.id] });
    queryClient.invalidateQueries({ queryKey: ['my-log', userId, game.id] });
    queryClient.invalidateQueries({ queryKey: ['favorites', userId] });
    queryClient.invalidateQueries({ queryKey: ['lists', userId] });
    queryClient.invalidateQueries({ queryKey: ['feed'] });
    queryClient.invalidateQueries({ queryKey: ['user-logs', userId] });
  }

  const toggleList = useMutation({
    mutationFn: async ({ kind, next }: { kind: 'favorites' | 'wishlist'; next: boolean }) => {
      if (!userId) throw new Error('You must be signed in.');
      await toggleSingletonMembership(userId, kind, game, next);
    },
    onSuccess: invalidate,
  });

  const setStatus = useMutation({
    mutationFn: async (status: 'playing' | 'played') => {
      if (!userId) throw new Error('You must be signed in.');
      // Preserve whatever the user already recorded; only the status changes.
      await saveLog(userId, {
        game,
        status,
        rating: log?.rating ?? null,
        review: log?.review ?? null,
        completionPercent: log?.completion_percent ?? null,
        platinum: log?.platinum ?? false,
        hoursPlayed: log?.hours_played ?? null,
        playedOn: log?.played_on ?? null,
      });
    },
    onSuccess: invalidate,
  });

  async function share() {
    try {
      await Share.share({
        message: game.storeUrl ? `${game.title} — ${game.storeUrl}` : game.title,
      });
    } catch {
      // Sheet dismissed.
    }
  }

  const favorited = membership.data?.favorited ?? false;
  const wishlisted = membership.data?.wishlisted ?? false;
  const error = toggleList.error ?? setStatus.error;

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <Action
          icon="star"
          outline="star-outline"
          active={favorited}
          tint={theme.accent}
          label="Favourite"
          onPress={() => toggleList.mutate({ kind: 'favorites', next: !favorited })}
        />
        <Action
          icon="bookmark"
          outline="bookmark-outline"
          active={wishlisted}
          tint={theme.primary}
          label="Wishlist"
          onPress={() => toggleList.mutate({ kind: 'wishlist', next: !wishlisted })}
        />
        <Action
          icon="game-controller"
          outline="game-controller-outline"
          active={log?.status === 'playing'}
          tint={theme.success}
          label="Playing"
          onPress={() => setStatus.mutate('playing')}
        />
        <Action
          icon="checkmark-circle"
          outline="checkmark-circle-outline"
          active={log?.status === 'played'}
          tint={theme.primary}
          label="Played"
          onPress={() => setStatus.mutate('played')}
        />
        <Action
          icon="paper-plane"
          outline="paper-plane-outline"
          active={false}
          tint={theme.textSecondary}
          label="Share"
          onPress={share}
        />
      </View>

      {/* The one primary button on the page — writing a review is what this
          screen is for, and everything above it is a one-tap toggle. */}
      <Button
        title={log ? 'Edit your review' : 'Write a review'}
        icon="create-outline"
        fullWidth
        onPress={() => router.push({ pathname: '/log/[id]', params: { id: game.id } })}
      />

      {error && (
        <Text variant="micro" color="danger">
          {error instanceof Error ? error.message : 'Could not update.'}
        </Text>
      )}
    </View>
  );
}

function Action({
  icon,
  outline,
  active,
  tint,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  outline: keyof typeof Ionicons.glyphMap;
  active: boolean;
  tint: string;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      scaleTo={0.92}
      style={styles.action}>
      {/* Same rectangle as every other control; only the fill and the edge move
          when it turns on, so five of these in a row stay a quiet strip until
          one of them is active. */}
      <View
        style={[
          styles.actionIcon,
          {
            backgroundColor: active ? `${tint}1F` : theme.surfaceElevated,
            borderColor: active ? `${tint}66` : theme.border,
          },
        ]}>
        <Ionicons
          name={active ? icon : outline}
          size={20}
          color={active ? tint : theme.textMuted}
        />
      </View>
      <Text variant="micro" color={active ? 'text' : 'textMuted'}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.three },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  action: { alignItems: 'center', gap: Spacing.one, flex: 1 },
  actionIcon: {
    width: 46,
    height: 46,
    borderRadius: Radius.control,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
