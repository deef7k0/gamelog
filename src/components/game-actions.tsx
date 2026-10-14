import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';

import { AddToCollection } from '@/components/add-to-collection';
import {
  AccessibilityInfo,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MiniPlayerBar } from '@/components/player/mini-player';
import { vividLook } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import {
  DOCK,
  barProgress,
  capsuleBeside,
  circleAlpha,
  dockBottom,
  dockFootRoom,
  dockFrames,
  dockHeight,
  dockWidth,
  foldProgress,
  keysAlpha,
  labelAlpha,
  lerpFrame,
  type DockFrame,
  type DockFrames,
} from '@/constants/action-dock';
import { PROGRESS_META, progressChoiceFor } from '@/constants/progress';
import { Elevation, Radius, Spacing, Type, type AccentRoles } from '@/constants/theme';
import { homeBarMoved, homeBarOpen } from '@/constants/top-bar';
import { useAccent } from '@/hooks/use-accent';
import { ARRIVAL_CONTROL, useLandingArrival } from '@/hooks/use-arrival';
import { useScreenChrome } from '@/hooks/use-screen-chrome';
import { useTheme } from '@/hooks/use-theme';
import { getListMembership, toggleSingletonMembership } from '@/lib/api';
import type { GameLog } from '@/lib/database.types';
import type { Game } from '@/lib/games';
import { formatReleaseDate, isUnreleased } from '@/lib/games/release';
import { useAuth } from '@/store/auth';
import { useMiniPlayerActive, useNowPlaying } from '@/store/player';

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

/** `tween(BAR_MORPH_MS)` on Compose's default easing. */
const MORPH = {
  duration: DOCK.morphMs,
  easing: Easing.bezier(DOCK.easing[0], DOCK.easing[1], DOCK.easing[2], DOCK.easing[3]),
};

/**
 * The game page's actions — review, favourite, wishlist, progress, collect —
 * as separate bars floating at the foot of the screen: SimpMusic's folding
 * navigation bar, read from its source (`constants/action-dock.ts` has the
 * numbers and where each was read).
 *
 * ```text
 *   expanded                               contracted
 *   ( ✎  Write a review               )
 *   ( (★)(🔖)(＋)(▤)                   )    ( (★)(🔖)(＋)(▤)       ) (✎)
 * ```
 *
 * The owner's direction (2026-10-14), after a first build that was one panel:
 * "These are *bars*, not a card or panel anymore. They are separate floating
 * bars or buttons, depending on their state."
 *
 * - **Expanded**, the review button is a bar on its own and the keys' capsule
 *   runs the full width under it.
 * - **Contracted**, the capsule makes room and the review button is a circle
 *   at its end. Every bar's frame is interpolated from one layout to the other
 *   over 300ms, as the reference's `ConstraintLayout` does; the review
 *   button's words go in the first half of the way.
 * - **With music playing**, the mini player is one of the bars, as the
 *   reference's is: over the capsule while expanded, with the review button a
 *   circle beside the capsule; contracted, the capsule folds into a circle at
 *   the start and the player sits inline after it. The app's own mini player
 *   stays off this route for that reason (`hidesMiniPlayer`).
 * - **An unreleased game has no review button**: the capsule alone, folding to
 *   its circle when contracted. Its date is in the masthead.
 *
 * Contracted by real travel downward, expanded again by real travel upward or
 * at the very top — Home's rule, which is the reference's (`useDockFold`). A
 * folded capsule opens the bars when pressed. Under Reduce Motion the layouts
 * switch without moving; with a screen reader on they stay expanded.
 */
/* Memoised: the page passes the query's own game and log objects and a stable
   opener, so it re-renders when one of those changes and not otherwise. */
export const GameActions = memo(function GameActions({
  game,
  log,
  onOpenProgress,
}: GameActionsProps) {
  const theme = useTheme();
  /** The collection picker, opened by the last key. */
  const [picking, setPicking] = useState(false);
  /* The palette is a Material 3 scheme seeded by the game's box art: the vivid
     `primary` for the one loud control, `primaryContainer` for a lit key,
     `surfaceContainerHigh` for an unlit one, and `surfaceContainer` — the
     reference's capsule colour — for the capsule they sit in. */
  const accent = useAccent();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useAuth((state) => state.session?.user.id);
  const insets = useSafeAreaInsets();
  const { width: display } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

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
   * exactly what a wishlist is for. The log form refuses one as well, so no
   * other way in can write one either (`app/log/[id]`).
   */
  const unreleased = isUnreleased(game);
  const review = !unreleased;
  const playerActive = useMiniPlayerActive();
  const track = useNowPlaying();
  const player = playerActive && track !== null;

  const width = dockWidth(display);
  const bottom = dockBottom(insets.bottom);
  const height = dockHeight({ width, review, player });
  /* The narrowest the capsule is drawn unfolded: its keys keep this layout
     while it folds into its circle, and are cut by its edge. */
  const keysWidth = review ? capsuleBeside(width) : width;

  /* The four layouts the bars move between: expanded or not, and with the
     mini player among them or not. */
  const layouts = useMemo<DockLayouts>(
    () => ({
      openSolo: dockFrames({ width, expanded: true, review, player: false }),
      shutSolo: dockFrames({ width, expanded: false, review, player: false }),
      openPlay: dockFrames({ width, expanded: true, review, player: true }),
      shutPlay: dockFrames({ width, expanded: false, review, player: true }),
    }),
    [width, review]
  );

  const fold = useDockFold();
  const { open, still } = fold;
  const expanded = fold.expanded;

  /* The mini player joining the bars, or leaving them: the same 300ms as the
     fold, so the others make room for it as the reference's do. */
  const playing = useSharedValue(player ? 1 : 0);
  useEffect(() => {
    const to = player ? 1 : 0;
    playing.set(reduceMotion ? to : withTiming(to, MORPH));
  }, [player, playing, reduceMotion]);

  /* Whether the capsule is a circle when contracted — with music in the row,
     or with no review button beside it. */
  const folds = player || !review;
  const folded = folds && !expanded;

  /* Every frame as React knows it, restated as a plain style after the
     animated one: Reanimated can drop a settled value and put a view back at
     its first frame (CLAUDE.md § Gotchas), and these are layouts React can
     name. */
  const rest = (key: keyof DockFrames) => frameAt(layouts, key, expanded ? 1 : 0, player ? 1 : 0);
  const restActions = rest('actions');
  const restReview = rest('review');
  const restBar = labelAlpha(barProgress(restReview.width, width));

  const actionsStyle = useAnimatedStyle(() => {
    const frame = frameAt(layouts, 'actions', still ? 1 : open.get(), playing.get());
    return { ...frame, borderRadius: frame.height / 2 };
  }, [layouts, still]);

  const keysStyle = useAnimatedStyle(() => {
    const frame = frameAt(layouts, 'actions', still ? 1 : open.get(), playing.get());
    return {
      width: Math.max(frame.width, keysWidth) - DOCK.inset * 2,
      top: (frame.height - DOCK.key) / 2,
      opacity: keysAlpha(foldProgress(frame.width, keysWidth)),
    };
  }, [layouts, still, keysWidth]);

  const circleStyle = useAnimatedStyle(() => {
    const frame = frameAt(layouts, 'actions', still ? 1 : open.get(), playing.get());
    return { opacity: circleAlpha(foldProgress(frame.width, keysWidth)) };
  }, [layouts, still, keysWidth]);

  const reviewStyle = useAnimatedStyle(() => {
    if (!layouts.openSolo.review) return {};
    return frameAt(layouts, 'review', still ? 1 : open.get(), playing.get());
  }, [layouts, still]);

  /*
   * The review button's two faces, cross-faded by how far it is a bar: the
   * glyph and the words centred as one row across the bar, and the glyph alone
   * centred in the circle. Each is centred by its own layout — nothing is
   * measured, so the words sit in the middle of the bar whatever their length.
   * The bar's face goes in the first half of the fold (`labelAlpha`, the
   * reference's `fabAlpha`), before the bar is too narrow to hold it.
   */
  const barFaceStyle = useAnimatedStyle(() => {
    if (!layouts.openSolo.review) return {};
    const frame = frameAt(layouts, 'review', still ? 1 : open.get(), playing.get());
    return { opacity: labelAlpha(barProgress(frame.width, width)) };
  }, [layouts, still, width]);
  const circleFaceStyle = useAnimatedStyle(() => {
    if (!layouts.openSolo.review) return {};
    const frame = frameAt(layouts, 'review', still ? 1 : open.get(), playing.get());
    return { opacity: 1 - labelAlpha(barProgress(frame.width, width)) };
  }, [layouts, still, width]);

  const playerStyle = useAnimatedStyle(() => {
    const frame = frameAt(layouts, 'player', still ? 1 : open.get(), 1);
    return { ...frame, opacity: playing.get() };
  }, [layouts, still]);

  const vivid = useMemo(() => vividLook(accent.color), [accent.color]);
  const reviewTitle = log ? 'Edit your review' : 'Write a review';

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
      One progress key where Playing and Played used to be two: it shows the
      answer — whichever of the seven you picked, lit — and opens the question,
      `<ProgressSheet>`, where one more tap saves and closes. Unlit with a plus
      when there is no log, because then it is an invitation rather than a
      state.
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
              : 'Set your progress',
            onPress: onOpenProgress,
          },
        ] satisfies ActionSpec[])),
    /*
      Add to collection. Not a toggle, so it carries no selected state at all —
      it announces as an action rather than as a permanently unselected one.
      Sharing is the top bar's disc, where a share belongs on every screen.
    */
    {
      icon: 'albums',
      outline: 'albums-outline',
      label: 'Collect',
      onPress: () => setPicking(true),
    },
  ];

  return (
    <>
      <View
        pointerEvents="box-none"
        style={[styles.dock, { bottom, height }]}
        accessibilityRole="toolbar"
        accessibilityLabel="Actions">
        <View pointerEvents="box-none" style={[styles.row, { width, height }]}>
          {/* The page's write failed: said over the bars, where the key that
              was pressed is. An opaque surface, so `danger` measures the 4.61:1
              it was chosen for on any page. */}
          {error && (
            <View
              pointerEvents="none"
              accessibilityLiveRegion="polite"
              style={[styles.error, { bottom: height + DOCK.gap, backgroundColor: theme.surface }]}>
              <Ionicons name="alert-circle" size={14} color={theme.danger} />
              <Text variant="caption" color="danger" style={styles.errorText}>
                {error instanceof Error ? error.message : 'Could not update.'}
              </Text>
            </View>
          )}

          {/*
            The capsule of keys — `FlatTabBar`'s surface, `surfaceContainer`,
            its corners a half of its height. The keys are this page's own:
            the connected Material 3 group they have always been, 6 in from the
            capsule's edge. Folded, the capsule is the reference's circle, and
            pressing it opens the bars.
          */}
          <Animated.View
            style={[
              styles.capsule,
              { backgroundColor: accent.m3.surfaceContainer },
              actionsStyle,
              { ...restActions, borderRadius: restActions.height / 2 },
            ]}>
            <Animated.View
              pointerEvents={folded ? 'none' : 'auto'}
              accessibilityElementsHidden={folded}
              importantForAccessibility={folded ? 'no-hide-descendants' : 'auto'}
              style={[
                styles.keys,
                keysStyle,
                {
                  width: Math.max(restActions.width, keysWidth) - DOCK.inset * 2,
                  top: (restActions.height - DOCK.key) / 2,
                  opacity: folded ? 0 : 1,
                },
              ]}>
              {actions.map((action, index) => (
                <Action
                  key={action.label}
                  {...action}
                  /* Shape comes from position in the list, so dropping the
                     progress key on an unreleased game re-closes the group on
                     the keys left. */
                  position={
                    actions.length === 1
                      ? 'solo'
                      : index === 0
                        ? 'start'
                        : index === actions.length - 1
                          ? 'end'
                          : 'middle'
                  }
                  /* Offset by one beat when the review button is there, so it
                     leads the arrival. */
                  delay={ACTION_ARRIVAL_START + (review ? index + 1 : index) * ACTION_ARRIVAL_STEP}
                />
              ))}
            </Animated.View>

            {folds && (
              <Animated.View
                pointerEvents={folded ? 'auto' : 'none'}
                style={[styles.circle, circleStyle, { opacity: folded ? 1 : 0 }]}>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel="Show the actions: favourite, wishlist and the rest"
                  accessibilityElementsHidden={!folded}
                  importantForAccessibility={folded ? 'auto' : 'no-hide-descendants'}
                  onPress={fold.expand}
                  scaleTo={0.9}
                  style={styles.circleKey}>
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={22}
                    color={accent.m3.onSurfaceVariant}
                  />
                </PressableScale>
              </Animated.View>
            )}
          </Animated.View>

          {/* The mini player, among the bars while music is kept playing. */}
          {player && (
            <Animated.View
              style={[
                styles.frame,
                playerStyle,
                { ...frameAt(layouts, 'player', expanded ? 1 : 0, 1), opacity: 1 },
              ]}>
              {/* The dock's height, not the player's own 56. */}
              <MiniPlayerBar style={styles.player} />
            </Animated.View>
          )}

          {/*
            The review button: the bar on its own, or the circle at the row's
            end. The vivid fill `<Button tone="vivid">` paints — the one
            loud control on the screen — and the raised shadow it floats on.
            Its words go in the first half of the fold, so the circle is the
            glyph alone, centred.
          */}
          {review && (
            <Animated.View style={[styles.frame, reviewStyle, restReview]}>
              <Arriving delay={ACTION_ARRIVAL_START} style={styles.fill}>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={reviewTitle}
                  onPress={() => router.push({ pathname: '/log/[id]', params: { id: game.id } })}
                  pressedColor={vivid.pressed}
                  scaleTo={0.96}
                  style={StyleSheet.flatten([
                    styles.review,
                    Elevation.raised,
                    { backgroundColor: vivid.fill },
                  ])}>
                  <View style={styles.reviewClip}>
                    {/* The bar's face: as wide as the bar is when expanded, and
                        centred on the button, so the bar cuts its ends as it
                        narrows and fades. */}
                    <Animated.View
                      pointerEvents="none"
                      style={[styles.reviewFace, { width }, barFaceStyle, { opacity: restBar }]}>
                      <Ionicons name="create-outline" size={20} color={vivid.ink} />
                      <Text numberOfLines={1} style={[styles.reviewLabel, { color: vivid.ink }]}>
                        {reviewTitle}
                      </Text>
                    </Animated.View>
                    <Animated.View
                      pointerEvents="none"
                      style={[styles.reviewCircle, circleFaceStyle, { opacity: 1 - restBar }]}>
                      <Ionicons name="create-outline" size={20} color={vivid.ink} />
                    </Animated.View>
                  </View>
                </PressableScale>
              </Arriving>
            </Animated.View>
          )}
        </View>
      </View>

      {/* Mounted here rather than at the page level so the dock owns its own
          control: `<GameActions>` is the only thing that opens it. */}
      <AddToCollection game={game} visible={picking} onClose={() => setPicking(false)} />
    </>
  );
});

/** The four layouts, by name. */
type DockLayouts = {
  openSolo: DockFrames;
  shutSolo: DockFrames;
  openPlay: DockFrames;
  shutPlay: DockFrames;
};

const NO_FRAME: DockFrame = { left: 0, bottom: 0, width: 0, height: 0 };

/**
 * One bar's frame at `open` (0 contracted, 1 expanded) and `playing` (0
 * without the mini player, 1 with it): the two interpolations the reference's
 * `ConstraintLayout` makes, one after the other. The mini player has no frame
 * in the layouts without it, so it only ever reads its own.
 */
function frameAt(
  layouts: DockLayouts,
  key: keyof DockFrames,
  open: number,
  playing: number
): DockFrame {
  'worklet';
  const play = lerpFrame(
    layouts.shutPlay[key] ?? NO_FRAME,
    layouts.openPlay[key] ?? NO_FRAME,
    open
  );
  if (key === 'player') return play;
  const solo = lerpFrame(
    layouts.shutSolo[key] ?? NO_FRAME,
    layouts.openSolo[key] ?? NO_FRAME,
    open
  );
  return lerpFrame(solo, play, playing);
}

/**
 * How much room the game page leaves at its foot for the bars: the contracted
 * row where it rests, and a section's distance over it.
 */
export function useActionDockRoom(): number {
  const insets = useSafeAreaInsets();
  return dockFootRoom(dockBottom(insets.bottom));
}

/**
 * Whether the bars are expanded, from the page's scroll — Home's rule, which
 * is the reference's: expanded at the very top, contracted by real travel
 * downward, expanded again by real travel upward.
 *
 * `open` is the morph's progress on the UI thread, 1 expanded to 0
 * contracted; `expanded` is the same as React state, for what the morph
 * changes beyond pixels — which controls can be pressed and which a screen
 * reader is told about. `still` is a screen reader being on: then the bars
 * never contract. `expand` is the folded capsule's press.
 */
function useDockFold() {
  const fallback = useSharedValue(0);
  const scrollY = useScreenChrome()?.scrollY ?? fallback;
  const reduceMotion = useReducedMotion();
  const screenReader = useScreenReaderOn();

  const open = useSharedValue(1);
  const isOpen = useSharedValue(true);
  /* Where the page was when the bars last answered it. */
  const anchor = useSharedValue(0);
  const [expanded, setExpanded] = useState(true);

  useAnimatedReaction(
    () => scrollY.get(),
    (offset, was) => {
      if (offset === was || screenReader) return;
      const next = homeBarOpen(isOpen.get(), anchor.get(), offset, DOCK.hold, DOCK.slop);
      if (homeBarMoved(anchor.get(), offset, DOCK.slop)) anchor.set(offset);
      if (next === isOpen.get()) return;
      isOpen.set(next);
      /* Under Reduce Motion the layouts switch: nothing moves. */
      open.set(reduceMotion ? (next ? 1 : 0) : withTiming(next ? 1 : 0, MORPH));
      runOnJS(setExpanded)(next);
    },
    [reduceMotion, screenReader]
  );

  const expand = useCallback(() => {
    anchor.set(scrollY.get());
    isOpen.set(true);
    open.set(reduceMotion ? 1 : withTiming(1, MORPH));
    setExpanded(true);
  }, [anchor, isOpen, open, reduceMotion, scrollY]);

  return { open, expanded: expanded || screenReader, still: screenReader, expand };
}

/** Whether a screen reader is running — and when that changes. */
function useScreenReaderOn(): boolean {
  const [on, setOn] = useState(false);

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((enabled) => {
      if (alive) setOn(enabled);
    });
    const listener = AccessibilityInfo.addEventListener('screenReaderChanged', setOn);
    return () => {
      alive = false;
      listener.remove();
    };
  }, []);

  return on;
}

/**
 * A tonal key's colours, on or off — Material 3's filled-tonal → filled pair,
 * in M3's own roles:
 *
 *  - **off** — `surfaceContainerHigh` and `onSurfaceVariant` ink, outline glyph.
 *  - **on** — `primaryContainer` and `onPrimaryContainer` ink, solid glyph.
 *
 * The keys in the dock and the masthead's "You reviewed…" key are drawn from
 * this one rule, so the two cannot drift apart.
 */
function tonalKey(accent: AccentRoles, active: boolean) {
  const fill = active ? accent.m3.primaryContainer : accent.m3.surfaceContainerHigh;
  return {
    fill,
    ink: active ? accent.m3.onPrimaryContainer : accent.m3.onSurfaceVariant,
    style: { backgroundColor: fill, borderColor: fill },
  };
}

/**
 * Your own record of the game, in the masthead: a key that says when you wrote
 * about it — or scored it — and what you gave it, and opens it.
 *
 * ```text
 *   ( ✎  You reviewed this game on 3 May 2026                    87 )
 * ```
 *
 * **The dock's key, copied**: the owner's direction (2026-10-14) — "the same
 * material 3 style as the action buttons… copy the button for, for example,
 * the favourite one". So it is an unlit tonal key (`tonalKey`): the same fill,
 * the same hairline in that fill, the same 52, the same full round ends a key
 * alone in its group has, its glyph and its words in the key's ink. Under the
 * stats strip and the Ratings card, at the masthead's full width.
 *
 * - **A review** opens the review's own page.
 * - **A score with no writing** opens the log form, where the score is.
 * - **Neither** — a status alone, or a platinum alone — draws nothing.
 *
 * The score is the key's ink, bold: a score's own colour on this fill is
 * 3.65:1 for a low one, under AA, and a score is data, lifted for nobody. The
 * number is the carrier, and the word for it is spoken.
 */
export function YourLogButton({ log, style }: { log: GameLog; style?: StyleProp<ViewStyle> }) {
  const router = useRouter();
  const accent = useAccent();

  const wrote = !!log.review?.trim();
  if (!wrote && log.rating === null) return null;

  const key = tonalKey(accent, false);
  const date = formatReleaseDate(log.created_at);
  const sentence = wrote ? `You reviewed this game on ${date}` : `You scored this game on ${date}`;
  const spoken = [
    sentence,
    log.rating !== null ? `rated ${Math.round(log.rating)} out of 100` : null,
    log.platinum ? 'platinum' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <PressableScale
      accessibilityRole={wrote ? 'link' : 'button'}
      accessibilityLabel={`${spoken}. ${wrote ? 'Opens your review.' : 'Opens your log.'}`}
      scaleTo={0.96}
      onPress={() =>
        wrote
          ? router.push({ pathname: '/review/[id]', params: { id: log.id } })
          : router.push({ pathname: '/log/[id]', params: { id: log.game_id } })
      }
      style={StyleSheet.flatten([
        styles.action,
        groupCorners('solo'),
        key.style,
        styles.yourLog,
        style,
      ])}>
      <Ionicons name={wrote ? 'reader-outline' : 'create-outline'} size={22} color={key.ink} />
      <Text variant="body" numberOfLines={2} style={[styles.yourLogText, { color: key.ink }]}>
        {sentence}
      </Text>
      {log.platinum && <Ionicons name="trophy-outline" size={18} color={key.ink} />}
      {log.rating !== null && (
        <Text variant="h5" style={{ color: key.ink }}>
          {Math.round(log.rating)}
        </Text>
      )}
    </PressableScale>
  );
}

/**
 * An unreleased game's date, as a fact in its masthead where the ratings would
 * be: a quiet label over the date. Notices, not controls, so a card's corner
 * and a hairline rather than a key's fill.
 */
export function PlannedRelease({
  releaseDate,
  style,
}: {
  releaseDate: string;
  style?: StyleProp<ViewStyle>;
}) {
  const accent = useAccent();

  return (
    <View
      accessible
      accessibilityLabel={`Planned release: ${formatReleaseDate(releaseDate)}`}
      style={[styles.unreleased, { borderColor: accent.m3.outlineVariant }, style]}>
      <Ionicons name="calendar-outline" size={16} color={accent.quietInk} />
      <View style={styles.unreleasedText}>
        {/* Label over value, as the owner's reference sets a fact: the label
            small and quiet, the value the bold line. */}
        <Text variant="bodySmall" style={{ color: accent.quietInk }}>
          Planned release
        </Text>
        <Text variant="itemTitle">{formatReleaseDate(releaseDate)}</Text>
      </View>
    </View>
  );
}

/**
 * How the bars land, in milliseconds.
 *
 * The masthead's cover starts at 0 and is still settling when the review
 * button begins, so the page reads as one arrival with the object leading it.
 * Five beats put the last at 262ms, inside the 500–800ms an authored focal
 * entrance is allowed.
 */
const ACTION_ARRIVAL_START = 110;
const ACTION_ARRIVAL_STEP = 38;

/**
 * The corner where two keys meet, and the gap they meet across: Material's
 * connected-group rule. Only the *outer* edges of the group are round, because
 * they are the edges of the object; every internal edge is nearly square, so
 * a pair of them across a 4dp gap reads as a seam in one bar. `GROUP_END` is
 * `Radius.pill` — a true semicircle on a 52dp key, concentric with the
 * capsule's round end 6dp outside it.
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
 * Where a key sits in the group, which is the only thing that decides its
 * shape. `solo` is a key alone: round at both ends.
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
 * physics the cover lands on. Opacity rides along so a control never reads as
 * interactive before it has arrived.
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
     it — see `useLandingArrival` for what is lost without it. */
  return (
    <Animated.View style={[style, animated, landed && styles.arrived]}>{children}</Animated.View>
  );
}

/**
 * One key in the capsule: a wide tonal key, a glyph and no word. The word is
 * its `accessibilityLabel`; the glyphs are the most conventional in the set —
 * a star, a bookmark, a progress mark, a stack. On and off are carried by the
 * fill and the glyph both (`tonalKey`).
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
  const key = tonalKey(accent, active);

  return (
    /* The arrival wraps the key rather than the key animating itself: the
       press scale below is also a transform, and two `useAnimatedStyle`
       results on one view would have the later one replace the earlier. */
    <Arriving delay={delay} style={styles.actionSlot}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={label}
        /* `selected` only where there is something to be selected. */
        accessibilityState={{ selected: active, busy, disabled: busy }}
        disabled={busy}
        onPress={onPress}
        scaleTo={0.92}
        style={StyleSheet.flatten([
          styles.action,
          groupCorners(position),
          active ? Elevation.raised : Elevation.none,
          key.style,
          busy && styles.actionBusy,
        ])}>
        <Ionicons name={active ? icon : outline} size={22} color={key.ink} />
      </PressableScale>
    </Arriving>
  );
}

const styles = StyleSheet.create({
  /* Over the page, at its foot, the row centred in it: nothing of its own is
     drawn, so touches between the bars reach the page. `bottom` and `height`
     are set inline. */
  dock: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  row: { position: 'relative' },
  /* Every bar is placed by its frame, from the row's left and foot. */
  frame: { position: 'absolute' },
  fill: { flex: 1 },
  player: { height: DOCK.top, borderRadius: DOCK.top / 2 },
  /* The keys keep a layout of their own while the capsule folds round them,
     and its edge cuts them — `FlatTabBar`'s clip. */
  capsule: { position: 'absolute', overflow: 'hidden' },
  keys: {
    position: 'absolute',
    left: DOCK.inset,
    height: DOCK.key,
    flexDirection: 'row',
    gap: GROUP_GAP,
  },
  /* The folded circle's glyph, a `CollapsedBarSize` square at the capsule's
     start — `foldedCircle`. */
  circle: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DOCK.folded,
  },
  circleKey: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  review: { flex: 1, borderRadius: DOCK.top / 2 },
  reviewClip: {
    flex: 1,
    borderRadius: DOCK.top / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Centred on the button by the clip's own alignment: a row as wide as the
     expanded bar, its glyph and words in its middle. */
  reviewFace: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.x8,
  },
  reviewCircle: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* `<Button>`'s label, at the smaller bar's size. */
  reviewLabel: { ...Type.button },
  error: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    paddingVertical: Spacing.x8,
    paddingHorizontal: Spacing.x12,
    borderRadius: Radius.card,
  },
  errorText: { flex: 1 },
  /* `Arriving`'s end state, identical to the animated style at 1. */
  arrived: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
  /* The arrival wrapper is the row's flex child, so it carries the width share.
     The key inside stretches to fill it. */
  actionSlot: { flex: 1 },
  /* Wide, not round, and shaped by `groupCorners` rather than here — a blanket
     radius would be overridden on some corners and not others. */
  action: {
    minHeight: DOCK.key,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* The write is a single round trip, so this is a brief dim rather than a
     spinner. It also stops a second tap on a slow connection recomputing
     `next` from state the first tap has not updated yet. */
  actionBusy: { opacity: 0.5 },
  /* A key with words in it: a row, the words starting past the glyph. */
  yourLog: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: Spacing.x12,
    paddingVertical: Spacing.x8,
    paddingLeft: Spacing.x20,
    paddingRight: Spacing.x20,
  },
  yourLogText: { flex: 1 },
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
});
