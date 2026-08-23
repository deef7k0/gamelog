import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Share, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { parseReviewMetrics } from '@/constants/review-metrics';
import { Elevation, Radius, Spacing } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
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
  /* The masthead sits on the brightest stop of `<ScrollAmbience>`; see the note
     on `AccentRoles.quietInk`. Every grey in this component was measured there
     and failed. */
  const accent = useAccent();
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
          <Ionicons name="calendar-outline" size={16} color={accent.quietInk} />
          <View style={styles.unreleasedText}>
            <Text variant="label" style={{ color: accent.quietInk }}>
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
          label="Favourite"
          onPress={() => toggleList.mutate({ kind: 'favorites', next: !favorited })}
        />
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

      {/* On a lit page `danger` (#F35555) measures 1.96:1 — the one message
          that has to be read was the least readable thing here. An opaque
          surface restores it to the 4.61:1 the token was chosen for, and gives
          the message an edge so it reads as a notice rather than as stray red
          text under a button. */}
      {error && (
        <View style={[styles.error, { backgroundColor: theme.surface }]}>
          <Ionicons name="alert-circle" size={14} color={theme.danger} />
          <Text variant="caption" color="danger" style={styles.errorText}>
            {error instanceof Error ? error.message : 'Could not update.'}
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * One quick-action toggle, in the colour of the page it sits on.
 *
 * The `tint` prop is gone. It existed so Favourite could be `accent` and Playing
 * `success` while the other three stayed grey, which was three colour stories in
 * five adjacent buttons — defensible when the page was greyscale, incoherent now
 * that the whole screen is lit by the game's own artwork.
 */
function Action({
  icon,
  outline,
  active,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  outline: keyof typeof Ionicons.glyphMap;
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  const accent = useAccent();
  const theme = useTheme();

  /*
   * Every one of these is a solid block of the game's colour — the same fill and
   * the same near-black ink as the primary button below them, so the action row
   * and "Write a review" read as one family rather than as a grey strip above a
   * coloured button.
   *
   * **State is not the fill.** With all five filled there is no fill left to
   * change, so on/off is carried by the two things that are still free:
   *
   *  - the **glyph**, outline when off and solid when on. This is the oldest
   *    convention there is for a toggle of exactly this shape — an outlined star
   *    against a filled one — and it survives being the only difference because
   *    the shapes differ, not merely their colour.
   *  - the **label** underneath, which steps from `textSecondary` to `text`.
   *
   * Two carriers, neither of them hue, which is what keeps the row readable for
   * someone who cannot separate the colours at all.
   */
  const glyph = accent.ink;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      scaleTo={0.92}
      style={styles.action}>
      {/* Border colour matches the fill rather than being dropped: the
          hairline is load-bearing for *size*, and removing it would shrink
          every button by a pixel and break the row's alignment with the
          primary button under it. */}
      <View
        style={[
          styles.actionIcon,
          Elevation.control,
          { backgroundColor: accent.color, borderColor: accent.color },
        ]}>
        <Ionicons name={active ? icon : outline} size={20} color={glyph} />
      </View>
      {/* `quietInk`, not `textSecondary`. This row sits on the brightest part
          of the page's ambient gradient, where the grey measured 2.76:1 — so
          the *off* half of a two-carrier toggle was the half you could not
          read. Near-white-carrying-the-hue holds ≥4.66:1 there and still steps
          down clearly from `text`. */}
      <Text variant="caption" style={{ color: active ? theme.text : accent.quietInk }}>
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
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    paddingVertical: Spacing.x8,
    paddingHorizontal: Spacing.x12,
    borderRadius: Radius.control,
  },
  errorText: { flex: 1 },
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
