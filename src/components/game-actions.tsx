import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Share, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { parseReviewMetrics } from '@/constants/review-metrics';
import { Radius, Spacing, withAlpha } from '@/constants/theme';
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
 * Whether a game is still in the future.
 *
 * Derived at render from `releaseDate` rather than stored, which is what makes
 * the page "update itself": the game query has a 30-minute `staleTime`, so the
 * first visit after launch day refetches, the date is no longer ahead of now,
 * and every hidden control reappears. No release-tracking service, no webhook,
 * no polling — the answer was always in the data IGDB already returns.
 *
 * A missing date means *unknown*, not unreleased. A game with no announced date
 * keeps its actions rather than being locked out on a technicality.
 */
export function isUnreleased(game: Pick<Game, 'releaseDate'>): boolean {
  if (!game.releaseDate) return false;
  const released = Date.parse(game.releaseDate);
  return Number.isFinite(released) && released > Date.now();
}

/** "14 March 2027", or the year alone when IGDB only has that much. */
export function formatReleaseDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

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
      /*
       * Preserve whatever the user already recorded; only the status changes.
       *
       * **Every column has to be restated, including the ones this button has
       * no opinion about.** `saveLog` upserts the whole row, so a field left
       * out is not "unchanged" — it is written as null. Omitting these two used
       * to mean that marking a game you had reviewed as Played silently deleted
       * the review's headline and its per-category scores, leaving an untitled
       * body and a rating with nothing behind it.
       */
      await saveLog(userId, {
        game,
        status,
        rating: log?.rating ?? null,
        reviewMetrics: parseReviewMetrics(log?.review_metrics ?? null),
        reviewTitle: log?.review_title ?? null,
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

  /*
   * An unreleased game drops everything that asserts you have played it.
   *
   * "Playing", "Played" and "Write a review" are all claims about a game nobody
   * can have touched yet, and a status written now would be a lie the feed
   * repeats. Favourite and Wishlist stay: wanting a game before it exists is
   * exactly what a wishlist is for.
   */
  const unreleased = isUnreleased(game);

  return (
    <View style={styles.wrapper}>
      {unreleased && game.releaseDate && (
        <View style={[styles.unreleased, { borderColor: theme.border }]}>
          <Ionicons name="calendar-outline" size={16} color={theme.textSecondary} />
          <View style={styles.unreleasedText}>
            <Text variant="caption" color="textMuted">
              PLANNED RELEASE
            </Text>
            <Text variant="h5">{formatReleaseDate(game.releaseDate)}</Text>
          </View>
        </View>
      )}

      <View style={styles.row}>
        <Action
          icon="star"
          outline="star-outline"
          active={favorited}
          tint={theme.accent}
          label="Favourite"
          onPress={() => toggleList.mutate({ kind: 'favorites', next: !favorited })}
        />
        {/* No tint: a wishlist is a list you are on or off, with no verdict
            attached, so it takes the same one-step-lighter selected state as
            every other control in the app. */}
        <Action
          icon="bookmark"
          outline="bookmark-outline"
          active={wishlisted}
          label="Wishlist"
          onPress={() => toggleList.mutate({ kind: 'wishlist', next: !wishlisted })}
        />
        {!unreleased && (
          <Action
            icon="game-controller"
            outline="game-controller-outline"
            active={log?.status === 'playing'}
            tint={theme.success}
            label="Playing"
            onPress={() => setStatus.mutate('playing')}
          />
        )}
        {!unreleased && (
          <Action
            icon="checkmark-circle"
            outline="checkmark-circle-outline"
            active={log?.status === 'played'}
            label="Played"
            onPress={() => setStatus.mutate('played')}
          />
        )}
        {/* Never active — sharing is an act, not a state. */}
        <Action
          icon="paper-plane"
          outline="paper-plane-outline"
          active={false}
          label="Share"
          onPress={share}
        />
      </View>

      {/* The one primary button on the page — writing a review is what this
          screen is for, and everything above it is a one-tap toggle. Absent
          before release: there is nothing to review yet. */}
      {!unreleased && (
        <Button
          title={log ? 'Edit your review' : 'Write a review'}
          icon="create-outline"
          fullWidth
          onPress={() => router.push({ pathname: '/log/[id]', params: { id: game.id } })}
        />
      )}

      {error && (
        <Text variant="caption" color="danger">
          {error instanceof Error ? error.message : 'Could not update.'}
        </Text>
      )}
    </View>
  );
}

/**
 * One quick-action toggle.
 *
 * `tint` is the exception, not the default. Two of these carry meaning a
 * greyscale state cannot: Favourite is the same judgement the rating scale's
 * warm colour expresses, and Playing is a live status the app colours `success`
 * wherever else it appears. The rest — Wishlist, Played, Share — had borrowed
 * `primary` for no semantic reason and now take the ordinary one-step-lighter
 * selected state, so the strip reads as four quiet controls and two meanings
 * rather than five competing colours.
 */
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
  /** Only for states whose meaning is the colour. Omit for everything else. */
  tint?: string;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  const background = active
    ? tint
      ? withAlpha(tint, 0.12)
      : theme.surfaceSelected
    : theme.surfaceElevated;
  const border = active ? (tint ? withAlpha(tint, 0.4) : theme.borderStrong) : theme.border;
  const glyph = active ? (tint ?? theme.text) : theme.textMuted;

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
      <View style={[styles.actionIcon, { backgroundColor: background, borderColor: border }]}>
        <Ionicons name={active ? icon : outline} size={20} color={glyph} />
      </View>
      <Text variant="caption" color={active ? 'text' : 'textMuted'}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.x12 },
  unreleased: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    paddingVertical: Spacing.x12,
    paddingHorizontal: Spacing.x16,
    borderRadius: Radius.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
  unreleasedText: { gap: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  action: { alignItems: 'center', gap: Spacing.x4, flex: 1 },
  actionIcon: {
    width: 46,
    height: 46,
    borderRadius: Radius.control,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
