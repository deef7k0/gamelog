import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useRouter } from 'expo-router';

import { AddToCollection } from '@/components/add-to-collection';
import { Alert, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { parseReviewMetrics } from '@/constants/review-metrics';
import { Elevation, Radius, Spacing } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { ARRIVAL_CONTROL, useArrival } from '@/hooks/use-arrival';
import { useTheme } from '@/hooks/use-theme';
import { deleteLog, getListMembership, saveLog, toggleSingletonMembership } from '@/lib/api';
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
  /** The collection picker, opened by the fifth action. */
  const [picking, setPicking] = useState(false);
  /* The masthead's palette is a Material 3 scheme seeded by the game's box art:
     `accent.color` (M3 `primary`) for the one loud control, `primaryContainer`
     for the lit keys under it, `surfaceContainerHigh` for the unlit ones. See
     `AccentRoles` and `theme/dynamic-color.ts`. */
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

  /*
   * Does the log hold anything a delete would destroy?
   *
   * `logs.status` is a NOT NULL enum of four values (migration 0001), so there
   * is no "logged, but no status" row to fall back to — clearing a status means
   * removing the log. That is fine when the log *is* the status and nothing
   * else, and it is data loss when the person wrote a review. The row below is
   * what decides which of those two a tap is about.
   */
  const logHasContent = Boolean(
    log &&
    (log.rating !== null ||
      log.review ||
      log.review_title ||
      log.hours_played !== null ||
      log.completion_percent !== null ||
      log.platinum)
  );

  const setStatus = useMutation({
    mutationFn: async (status: 'playing' | 'played' | null) => {
      if (!userId) throw new Error('You must be signed in.');
      if (status === null) {
        await deleteLog(userId, game.id);
        return;
      }
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

  /** Toggle the active status off. Confirms first when that would lose writing. */
  function clearStatus() {
    if (!logHasContent) {
      setStatus.mutate(null);
      return;
    }
    Alert.alert(
      'Remove your log?',
      `Your score and review for ${game.title} are deleted along with it. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => setStatus.mutate(null) },
      ]
    );
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

  const actions: ActionSpec[] = [
    {
      icon: 'star',
      outline: 'star-outline',
      active: favorited,
      busy: toggleList.isPending,
      label: 'Favourite',
      onPress: () => toggleList.mutate({ kind: 'favorites', next: !favorited }),
    },
    {
      icon: 'bookmark',
      outline: 'bookmark-outline',
      active: wishlisted,
      busy: toggleList.isPending,
      label: 'Wishlist',
      onPress: () => toggleList.mutate({ kind: 'wishlist', next: !wishlisted }),
    },
    /*
      Playing and Played are two values of one four-value enum, not two
      independent switches — setting either replaces the other, and there is no
      null to toggle back to. They were nevertheless rendered exactly like
      Favourite and Wishlist, which *are* independent booleans, and pressing a
      lit one wrote the same status a second time. So the row taught the toggle
      rule with its first two buttons and broke it on the next two, on the two
      that publish to your followers' feeds.

      They toggle for real now. Pressing the lit one clears the log — with a
      confirm when there is a score or a review to lose, and silently when the
      log is nothing but the status itself, because there a confirm is ceremony
      over nothing.
    */
    ...(unreleased
      ? []
      : ([
          {
            icon: 'game-controller',
            outline: 'game-controller-outline',
            active: log?.status === 'playing',
            busy: setStatus.isPending,
            label: 'Playing',
            onPress: () =>
              log?.status === 'playing' ? clearStatus() : setStatus.mutate('playing'),
          },
          {
            icon: 'checkmark-circle',
            outline: 'checkmark-circle-outline',
            active: log?.status === 'played',
            busy: setStatus.isPending,
            label: 'Played',
            onPress: () => (log?.status === 'played' ? clearStatus() : setStatus.mutate('played')),
          },
        ] satisfies ActionSpec[])),
    /*
      Add to collection, in the slot Share used to hold.
      
      Share was the odd one out in this row: every other control writes something
      to your account, and it opened the OS sheet. Putting a game on a shelf is
      the thing a person browsing a game page actually wants a fifth button for,
      and it is the one path into a collection that starts from the game — the
      `add-to-list` route starts from the collection and cannot serve it.
      
      Sharing has not gone anywhere: the top bar's disc still carries it, which
      is where a share belongs on every other screen in the app.
      
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
            <Text variant="label" style={{ color: accent.quietInk }}>
              PLANNED RELEASE
            </Text>
            <Text variant="h5">{formatReleaseDate(game.releaseDate)}</Text>
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

              `pill` + `large`: the shape and weight of a transport control's
              primary key. See the note on `ButtonProps.shape` for why this is
              allowed to leave the app's shared `Radius.control`.

              `tone="vivid"`: the fill carries the game's own colour at full
              strength rather than at the tone the accent uses everywhere else.
              This is the button the whole screen exists for, it sits directly
              above a row of tonal keys drawn from the same palette, and the page
              behind all of it is that palette's darkest tone — so at the shared
              `primary` it was only marginally the loudest thing here. See the
              note on `ButtonProps.tone`; nothing else in the app takes it. */}
          <Button
            title={log ? 'Edit your review' : 'Write a review'}
            icon="create-outline"
            size="large"
            shape="pill"
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
            position={
              actions.length === 1
                ? 'solo'
                : index === 0
                  ? 'start'
                  : index === actions.length - 1
                    ? 'end'
                    : 'middle'
            }
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
}

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
 * `GROUP_END` is `Radius.pill` — at a 52dp key that resolves to a true 26dp
 * semicircle, which is what closes the group. `GROUP_SEAM` is `Radius.lg`, the
 * last step of the app's own scale below the pill: squarer than the 12 it used
 * to be, so the three inner keys read as segments cut out of one bar rather than
 * as capsules parked next to each other. The outer ends keep the pill, so the
 * group still closes on itself — that contrast between a hard seam and a round
 * end is what says "one object, divided" rather than "five buttons". It is part
 * of the same narrow Material-3 exception the primary button's `shape="pill"`
 * documents — see `ButtonProps.shape` — and belongs to this cluster and nothing
 * else.
 */
const GROUP_END = Radius.pill;
const GROUP_SEAM = Radius.lg;
const GROUP_GAP = Spacing.x4;

/** The four corner radii for a key at `position`. */
function groupCorners(position: GroupPosition) {
  const start = position === 'start' || position === 'solo';
  const end = position === 'end' || position === 'solo';

  return {
    borderTopLeftRadius: start ? GROUP_END : GROUP_SEAM,
    borderBottomLeftRadius: start ? GROUP_END : GROUP_SEAM,
    borderTopRightRadius: end ? GROUP_END : GROUP_SEAM,
    borderBottomRightRadius: end ? GROUP_END : GROUP_SEAM,
  };
}

/**
 * Where a key sits in the group, which is the only thing that decides its shape.
 *
 * `solo` exists because the group is built from a list that an unreleased game
 * shortens — if it ever came down to one key, a lone half-round shape would look
 * like a rendering fault rather than a button.
 */
type GroupPosition = 'start' | 'middle' | 'end' | 'solo';

type ActionSpec = {
  icon: keyof typeof Ionicons.glyphMap;
  outline: keyof typeof Ionicons.glyphMap;
  /** Omit entirely for a control that is an act rather than a state. */
  active?: boolean;
  /** A write is in flight. Blocks the second tap of a double-tap. */
  busy?: boolean;
  label: string;
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
  const progress = useArrival(delay, ARRIVAL_CONTROL);

  const animated = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [
      { translateY: interpolate(progress.get(), [0, 1], [-10, 0]) },
      { scale: interpolate(progress.get(), [0, 1], [0.9, 1]) },
    ],
  }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

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
 *  - **on** — `primaryContainer`, the seed's hue at tone 30, with
 *    `onPrimaryContainer` ink and a solid glyph.
 *
 * This is Material's filled-tonal → filled toggle, and it is also the reason the
 * old note here said a grey strip above a coloured button read as disabled: a
 * *grey* row would. A tonal row carrying the game's own hue does not, and it now
 * sits below the primary rather than above it, where a quieter tier is what the
 * eye expects.
 */
function Action({
  icon,
  outline,
  active = false,
  busy = false,
  label,
  onPress,
  delay,
  position,
}: ActionSpec & { delay: number; position: GroupPosition }) {
  const accent = useAccent();

  return (
    /* The arrival wraps the button rather than the button animating itself: the
       press scale below is also a transform, and two `useAnimatedStyle` results
       on one view would have the later one silently replace the earlier. */
    <Arriving delay={delay} style={styles.actionSlot}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={label}
        /* `selected` only where there is something to be selected. Collect
           carries no `active`, so it announces as an action rather than as a
           permanently unselected toggle. */
        accessibilityState={{ selected: active, busy, disabled: busy }}
        disabled={busy}
        onPress={onPress}
        scaleTo={0.92}
        /* `Elevation.raised` on the lit state only. A tonal key is part of the
           page's own surface stack and should sit *in* it; the active one is a
           solid block of the accent on a gradient made of the same hue, where
           depth is the only edge available. One tier under `overlay`, so the
           game case keeps the heaviest shadow on the page. */
        style={StyleSheet.flatten([
          styles.action,
          groupCorners(position),
          active ? Elevation.raised : Elevation.none,
          {
            /*
              Material 3's filled-tonal → filled pair, in M3's own roles.
 
              The row used to light up in `accent.color` — the primary fill —
              which put it at the same volume as the review button directly
              above it. Two elements wearing the loudest colour on the screen is
              two primary actions, and this row is explicitly the *modifiers*
              for the one above.
 
              `primaryContainer` is the role M3 has for exactly that: the seed's
              own hue at tone 30, unmistakably lit, unmistakably quieter than
              tone 80. Off is `surfaceContainerHigh`, the same step the platform
              keys and the rows inside cards take.
            */
            backgroundColor: active ? accent.m3.primaryContainer : accent.m3.surfaceContainerHigh,
            borderColor: active ? accent.m3.primaryContainer : accent.m3.surfaceContainerHigh,
          },
          busy && styles.actionBusy,
        ])}>
        <Ionicons
          name={active ? icon : outline}
          size={22}
          /* `quietInk` off, near-black on: both are measured against the fill
             directly behind them rather than against the page, which is what the
             old `textSecondary` label got wrong on a lit gradient. */
          color={active ? accent.m3.onPrimaryContainer : accent.m3.onSurfaceVariant}
        />
      </PressableScale>
    </Arriving>
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
  /* A real gap now that the keys are wide pills rather than centred glyph-and-
     label columns. `space-between` on flex-1 children put the gap inside the
     buttons; this puts it between them. */
  /* `GROUP_GAP`, not `x8`. Six read as five separate controls that happened to
     be adjacent; four reads as the seams of one bar. See the note on the
     constant. */
  row: { flexDirection: 'row', gap: GROUP_GAP },
  /* The arrival wrapper is the row's flex child, so it carries the width share
     that `action` used to. The button inside stretches to fill it. */
  actionSlot: { flex: 1 },
  /*
   * Wide, not round, and shaped by `groupCorners` rather than here.
   *
   * No `borderRadius` in this rule at all — a blanket value would be overridden
   * on some corners and not others depending on position, which is the kind of
   * half-applied style that only shows up on one of the five buttons.
   *
   * 52 rather than the old 46: with the label gone the glyph is the entire
   * control, and this is the height at which the row balances a 60dp primary
   * instead of looking like its footnote. Past both tap floors on its own.
   */
  action: {
    minHeight: 52,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* The write is a single round trip, so this is a brief dim rather than a
     spinner — long enough to say "heard you", short enough not to flash. It is
     also what stops a second tap on a slow connection recomputing `next` from
     state the first tap has not updated yet. */
  actionBusy: { opacity: 0.5 },
});
