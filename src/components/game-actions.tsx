import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { memo, useState } from 'react';
import { useRouter } from 'expo-router';

import { AddToCollection } from '@/components/add-to-collection';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { KEY_GROUP_GAP, TonalKey, keyPosition, type KeyPosition } from '@/components/ui/tonal-key';
import { PROGRESS_META, progressChoiceFor } from '@/constants/progress';
import { Radius, Spacing } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { ARRIVAL_CONTROL, useLandingArrival } from '@/hooks/use-arrival';
import { useTheme } from '@/hooks/use-theme';
import { getListMembership, toggleSingletonMembership } from '@/lib/api';
import type { GameLog } from '@/lib/database.types';
import type { Game } from '@/lib/games';
import { formatReleaseDate, isUnreleased } from '@/lib/games/release';
import { hasWriting } from '@/lib/review-quote';
import { useAuth } from '@/store/auth';

export type GameActionsProps = {
  game: Game;
  /** The viewer's existing log, if any — drives the progress key. */
  log: GameLog | null;
  /**
   * Open the progress sheet. The page owns it: it is a `<SlideUpSheet>`, and a
   * sheet has to be a sibling of `<Screen>` or the page's own back disc floats
   * over it.
   */
  onOpenProgress: () => void;
};

/* Whether a game is out yet, and its date as words: one definition, shared with
   the log form, the profile's quick log and Surprise Me, which keep an
   unreleased game from being reviewed too. */
export { formatReleaseDate, isUnreleased } from '@/lib/games/release';

/**
 * The quick-action row on a game page: review, favourite, wishlist, progress,
 * collect.
 *
 * Progress opens a sheet (`<ProgressSheet>`) that saves on one tap, so marking a
 * game completed is two taps without ever opening the review form; the form is
 * still there for scores and writing.
 */
/* Memoised: the page passes the query's own game and log objects and a stable
   opener, so it re-renders when one of those changes and not otherwise. */
export const GameActions = memo(function GameActions({
  game,
  log,
  onOpenProgress,
}: GameActionsProps) {
  const theme = useTheme();
  /** The collection picker, opened by the fifth action. */
  const [picking, setPicking] = useState(false);
  /* The masthead's palette is a Material 3 scheme seeded by the game's box art:
     the review button and the lit keys under it are filled with `primary`,
     their words and glyphs in its `onPrimary` (`lib/filled`), and the unlit
     keys sit on `surfaceContainerHigh`. See `AccentRoles` and
     `theme/dynamic-color.ts`. */
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
    // The game page's "On GameLog": how many have it on their wishlist.
    queryClient.invalidateQueries({ queryKey: ['game-audience', game.id] });
  }

  const toggleList = useMutation({
    mutationFn: async ({ kind, next }: { kind: 'favorites' | 'wishlist'; next: boolean }) => {
      if (!userId) throw new Error('You must be signed in.');
      await toggleSingletonMembership(userId, kind, game, next);
    },
    onSuccess: invalidate,
  });

  /* Which key is writing: the two share one mutation, and a tap on one must
     not dim the other. While the lists are first loading both are dimmed and
     hold their taps: drawn "off" and then switched on, they claimed a state
     they did not know, and a tap then would have written the wrong one. */
  const busyKind = toggleList.isPending ? toggleList.variables?.kind : undefined;
  const favorited = membership.data?.favorited ?? false;
  const wishlisted = membership.data?.wishlisted ?? false;
  const error = toggleList.error;
  const progress = progressChoiceFor(log);
  const progressMeta = progress ? PROGRESS_META[progress] : null;

  /*
   * An unreleased game drops everything that asserts you have played it.
   *
   * "Playing", "Played" and "Write a review" are all claims about a game nobody
   * can have touched yet, and a status written now would be a lie the feed
   * repeats. Favourite and Wishlist stay: wanting a game before it exists is
   * exactly what a wishlist is for.
   */
  const unreleased = isUnreleased(game);

  const actions: ActionSpec[] = [
    {
      icon: 'star',
      outline: 'star-outline',
      active: favorited,
      busy: busyKind === 'favorites' || membership.isLoading,
      label: 'Favourite',
      onPress: () => toggleList.mutate({ kind: 'favorites', next: !favorited }),
    },
    {
      icon: 'bookmark',
      outline: 'bookmark-outline',
      active: wishlisted,
      busy: busyKind === 'wishlist' || membership.isLoading,
      label: 'Wishlist',
      onPress: () => toggleList.mutate({ kind: 'wishlist', next: !wishlisted }),
    },
    /*
      One progress key where Playing and Played used to be two.

      Those two were values of one enum drawn as two switches, and the enum has
      five values now (0022) and a completion level beside it (0023) — seven
      answers in all, which is no longer a row of toggles. So the key shows the
      answer and opens the question: its glyph is whichever of the seven you
      picked, lit, and tapping it raises `<ProgressSheet>`, where one more tap
      saves and closes. Two taps to "Completed", which is what the old Played
      key cost as well.

      Unlit with a plus when there is no log, because then it is an invitation
      rather than a state — and because every other glyph here means a specific
      answer, and showing one of them before you have given it would be a claim.
    */
    ...(unreleased
      ? []
      : ([
          {
            icon: progressMeta?.icon ?? 'add-circle',
            outline: progressMeta?.outline ?? 'add-circle-outline',
            active: log !== null,
            label: progressMeta
              ? `Your progress: ${progressMeta.label}. Change it.`
              : 'Log your progress',
            /* The one printed word in the group, and only until there is a
               log: a bare "+" beside Collect's stack does not say "log this
               game", and this key is the ten-second path the review button
               is not (the owner, 2026-10-21). Once logged, its glyph is the
               answer and says enough. */
            caption: log ? undefined : 'Log',
            onPress: onOpenProgress,
          },
        ] satisfies ActionSpec[])),
    /*
      Add to collection, in the slot Share used to hold.
      
      Share was the odd one out in this row: every other control writes something
      to your account, and it opened the OS sheet. Putting a game on a shelf is
      the thing a person browsing a game page actually wants a fifth button for,
      and it is the one path into a collection that starts from the game — the
      `add-to-list` route starts from the collection and cannot serve it.
      
      Sharing moved to the top bar: a disc at the top right, beside the
      trailer switch (the owner, 2026-10-21) — it had been lost in the move.
      
      Not a toggle, so it carries no selected state at all — it used to announce
      as a permanently unselected one to a screen reader.
    */
    {
      icon: 'albums',
      outline: 'albums-outline',
      label: 'Collect',
      onPress: () => setPicking(true),
    },
  ];

  return (
    <View style={styles.wrapper}>
      {unreleased && game.releaseDate && (
        <View style={[styles.unreleased, { borderColor: theme.border }]}>
          <Ionicons name="calendar-outline" size={16} color={accent.quietInk} />
          <View style={styles.unreleasedText}>
            {/* Label over value, as the owner's reference sets a fact: the
                label small and quiet, the value the bold line. */}
            <Text variant="bodySmall" style={{ color: accent.quietInk }}>
              Planned release
            </Text>
            <Text variant="itemTitle">{formatReleaseDate(game.releaseDate)}</Text>
          </View>
        </View>
      )}

      {/*
        The primary action leads, and the toggles sit under it.

        It used to be the other way round: five labelled tiles, then the review
        button closing the group. That order made the page's whole reason for
        existing the *last* thing on it, and it is the order a transport control
        answers directly — a player puts play in the middle and its modifiers
        underneath, because the modifiers are about the thing you are pressing.
        Writing a review is what this screen is for; favouriting is what you do
        on the way past.

        First beat of the arrival now, so the stagger runs down the cluster the
        way the eye does rather than up it.
      */}
      {!unreleased && (
        <Arriving delay={ACTION_ARRIVAL_START}>
          {/* `raised`, not the default `control`. This button is filled with
              the accent and sits on a gradient built from the same hue, so its
              edge had nothing to be an edge against — see the note on
              `ButtonProps.elevation`.

              `large`: the weight of a transport control's primary key, closed
              into the same full pill every button is.

              `tone="vivid"`: the fill carries the game's own colour at full
              strength rather than at the tone the accent uses everywhere else.
              This is the button the whole screen exists for, it sits directly
              above a row of tonal keys drawn from the same palette, and the page
              behind all of it is that palette's darkest tone — so at the shared
              `primary` it was only marginally the loudest thing here. See the
              note on `ButtonProps.tone`; nothing else in the app takes it. */}
          {/* "Edit" only when there is writing to edit: a log that is a
              status alone has no review yet, and saying so was a false claim. */}
          <Button
            title={
              log && hasWriting(log)
                ? 'Edit your review'
                : log
                  ? 'Write your review'
                  : 'Write a review'
            }
            icon="create-outline"
            size="large"
            tone="vivid"
            elevation="raised"
            fullWidth
            onPress={() => router.push({ pathname: '/log/[id]', params: { id: game.id } })}
          />
        </Arriving>
      )}

      {/*
        Built as a list rather than five literal elements so the arrival stagger
        stays contiguous. An unreleased game drops the middle two, and hard-coded
        delays would leave a hole in the sequence where they used to be — the
        remaining buttons would land 0, 1, then a beat of nothing, then 4.
      */}
      <View style={styles.row}>
        {actions.map((action, index) => (
          <Action
            key={action.label}
            {...action}
            /* Shape comes from position in the list rather than being written
               per button, so dropping the middle two on an unreleased game
               re-closes the group on whichever keys are left. */
            position={keyPosition(index, actions.length)}
            /* Offset by one beat when the review button is present, so it leads
               the sequence it now leads visually. */
            delay={ACTION_ARRIVAL_START + (unreleased ? index : index + 1) * ACTION_ARRIVAL_STEP}
          />
        ))}
      </View>

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

      {/* Mounted here rather than at the page level so the row owns its own
          control: `<GameActions>` is the only thing that opens it, and a
          `visible` flag threaded up to `game/[id]` would make two components
          responsible for one piece of state. */}
      <AddToCollection game={game} visible={picking} onClose={() => setPicking(false)} />
    </View>
  );
});

/**
 * How the row lands, in milliseconds.
 *
 * The case starts at 0 and is still settling when the first button begins, so
 * the masthead reads as one arrival with the object leading it rather than as
 * two animations that happen to overlap. Five buttons plus the primary put the
 * last beat at 300ms, and the whole sequence finishes inside the 500–800ms an
 * authored focal entrance is allowed.
 */
const ACTION_ARRIVAL_START = 110;
const ACTION_ARRIVAL_STEP = 38;

/**
 * The corner where two keys meet, and the gap they meet across.
 *
 * These two numbers are what make the row read as **one segmented control**
 * rather than as five loose capsules. Every key was a full pill, so each one
 * closed on itself and the group looked cut into pieces — the shape said
 * "five things" while the row means "one set of five".
 *
 * Material's connected-group rule, and it is a shape argument rather than a
 * decorative one: only the *outer* edges of the group are round, because they
 * are the edges of the object. Every internal edge is nearly square, so a pair
 * of them across a 4dp gap reads as a seam in one bar. The first key is round on
 * its left and squared on its right; the last is the mirror; the three between
 * are rounded squares.
 *
 * The corners are `<TonalKey>`'s now (`keyCorners`), shared with Surprise
 * Me's Backlog and Next by the owner's direction (2026-10-16). Its end is
 * `Radius.pill` — at a 52dp key that resolves to a true 26dp
 * semicircle, which is what closes the group. `GROUP_SEAM` is `Radius.lg`, the
 * last step of the app's own scale below the pill: squarer than the 12 it used
 * to be, so the three inner keys read as segments cut out of one bar rather than
 * as capsules parked next to each other. The outer ends keep the pill, so the
 * group still closes on itself — that contrast between a hard seam and a round
 * end is what says "one object, divided" rather than "five buttons". It is part
 * of the same narrow Material-3 exception the vivid review button documents —
 * see `ButtonProps.tone` — and belongs to this cluster and to Surprise Me's
 * pair, which is the same object.
 */
const GROUP_GAP = KEY_GROUP_GAP;

/**
 * One quick-action toggle: a wide tonal key under the primary button.
 *
 * ## No label, and what replaced it
 *
 * The word under each glyph is gone. Five labelled tiles read as a form of five
 * fields; five keys read as a control panel for the object above them, which is
 * what they are. The glyphs are the five most conventional in the set — an
 * outlined star, a bookmark, a controller, a tick, a stack — and each carries
 * its `accessibilityLabel`, so the word is still spoken, just not printed.
 *
 * The honest cost: a first-time user has to recognise five icons rather than
 * read five words. That is the trade a transport control makes everywhere it
 * appears, and it is only affordable because these five are conventions rather
 * than invented marks.
 *
 * ## Fill is a state carrier again
 *
 * These used to be five solid blocks of the accent, which meant on/off had to be
 * carried by the glyph and the label alone — and with the label gone that would
 * leave exactly one carrier. Moving the *off* state to a tonal fill restores the
 * pair:
 *
 *  - **off** — `surfaceContainerHigh`, the neutral palette at tone 24, and an
 *    outline glyph.
 *  - **on** — the game's colour, filled as the review button is, with a
 *    solid glyph in the fill's own `onPrimary` (`filledRoles`, 2026-10-17).
 *
 * This is Material's filled-tonal → filled toggle, and it is also the reason the
 * old note here said a grey strip above a coloured button read as disabled: a
 * *grey* row would. A tonal row carrying the game's own hue does not, and it now
 * sits below the primary rather than above it, where a quieter tier is what the
 * eye expects.
 */
type ActionSpec = {
  icon: keyof typeof Ionicons.glyphMap;
  outline: keyof typeof Ionicons.glyphMap;
  /** Omit entirely for a control that is an act rather than a state. */
  active?: boolean;
  /** A write is in flight. Blocks the second tap of a double-tap. */
  busy?: boolean;
  label: string;
  /** A printed word beside the glyph — the progress key, until logged. */
  caption?: string;
  onPress: () => void;
};

/**
 * Drops its child into place on mount, as one beat of a staggered group.
 *
 * Falls from slightly above rather than rising from below, which is the same
 * physics the case lands on: things with weight come down onto the page. Opacity
 * rides along so a control never reads as interactive before it has arrived.
 */
function Arriving({
  delay,
  style,
  children,
}: {
  delay: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const { progress, landed } = useLandingArrival(delay, ARRIVAL_CONTROL);

  const animated = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [
      { translateY: interpolate(progress.get(), [0, 1], [-10, 0]) },
      { scale: interpolate(progress.get(), [0, 1], [0.9, 1]) },
    ],
  }));

  /* The landed pose as a plain style once the spring is done, so React holds
     it. Without it the review button and the keys under it could vanish: their
     React props were the first frame (opacity 0), and a JS stall could drop the
     animated end state — see `useLandingArrival`. */
  return (
    <Animated.View style={[style, animated, landed && styles.arrived]}>{children}</Animated.View>
  );
}

function Action({
  icon,
  outline,
  active,
  busy = false,
  label,
  caption,
  onPress,
  delay,
  position,
}: ActionSpec & { delay: number; position: KeyPosition }) {
  /* The key is `<TonalKey>`, shared with Surprise Me's Backlog and Next, so
     the two are the same object. The arrival wraps it here: the key's own
     press scale is a transform too, and two `useAnimatedStyle` results on one
     view would have the later one silently replace the earlier. */
  return (
    <Arriving delay={delay} style={styles.actionSlot}>
      <TonalKey
        icon={icon}
        outline={outline}
        active={active}
        busy={busy}
        label={label}
        caption={caption}
        onPress={onPress}
        position={position}
      />
    </Arriving>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.x12 },
  /* Notices, not controls, so a card's corner. */
  unreleased: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    paddingVertical: Spacing.x12,
    paddingHorizontal: Spacing.x16,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  unreleasedText: { gap: 1 },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    paddingVertical: Spacing.x8,
    paddingHorizontal: Spacing.x12,
    borderRadius: Radius.card,
  },
  errorText: { flex: 1 },
  /* A real gap now that the keys are wide pills rather than centred glyph-and-
     label columns. `space-between` on flex-1 children put the gap inside the
     buttons; this puts it between them. */
  /* `GROUP_GAP`, not `x8`. Six read as five separate controls that happened to
     be adjacent; four reads as the seams of one bar. See the note on the
     constant. */
  row: { flexDirection: 'row', gap: GROUP_GAP },
  /* `Arriving`'s end state, identical to the animated style at 1. */
  arrived: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
  /* The arrival wrapper is the row's flex child, so it carries the width share
     that `action` used to. The button inside stretches to fill it. */
  actionSlot: { flex: 1 },
});
