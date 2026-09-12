import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Poster } from '@/components/ui/poster';
import { PlatformMarks } from '@/components/ui/platform-chip';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ScoreLine } from '@/components/ui/score';
import { Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { platformFamilies } from '@/constants/platform-family';
import { Elevation, PosterAspectRatio, Radius, Spacing } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { ARRIVAL_CONTROL, ARRIVAL_OBJECT, useArrival } from '@/hooks/use-arrival';
import { useSquareCover } from '@/hooks/use-square-cover';
import { useTheme } from '@/hooks/use-theme';
import type { GameSearchResult } from '@/lib/games/types';

/** Which way the deck moved. `1` = on to the next, `-1` = back to the last one. */
export type DealDirection = 1 | -1;

/**
 * How far the card must travel before releasing it deals.
 *
 * A fraction of the card rather than of the screen: the card is the thing being
 * moved, and the same 30% feels identical whether it is 150dp wide on an SE or
 * 190 on a Pro Max. A screen fraction would make the gesture heavier on the
 * larger phone, which is backwards.
 */
const COMMIT_FRACTION = 0.3;

/** Rotation at full travel, in degrees. A dealt card turns as it leaves the hand. */
const EXIT_ROTATION = 9;

/* The two beats behind the case. Controls follow the object; the object never
   waits for them. Capped far under the 500ms where an entrance starts to read as
   latency. */
const TITLE_DELAY = 70;
const SUPPORT_DELAY = 130;

/** How far the type and controls travel relative to the card in front of them. */
const FOLLOW_RATIO = 0.22;

/**
 * The square's share of the display width.
 *
 * It ran flush to `SQUARE_GUTTER` on both sides — genuinely edge to edge — and
 * that was too much. A cover with nothing either side of it stops reading as an
 * object on a page and starts reading as the page, which is why the reference
 * leaves a margin: the art is unmistakably the subject *and* unmistakably a
 * thing sitting in a room. 0.84 is that margin — about 31dp a side on a 390dp
 * phone — and the space it buys back goes to the block underneath, which is the
 * part you act on.
 */
const SQUARE_RATIO = 0.84;

/**
 * The square's corner.
 *
 * A step above `Radius.caseImage` (12), which is the game case's own token and
 * not this component's to move. At 328dp a 12 reads as very nearly square; 18 is
 * where the softening is visible as an intention without the art starting to
 * look like a chip.
 */
const SQUARE_RADIUS = 18;

/** Edge of the two round controls beside the title. Past both tap floors. */
const ROUND_ACTION = 48;

export type RevealLayout = {
  /**
   * Width of the **portrait fallback**, for a game with no square art.
   *
   * Derived from `squareWidth` so the two shapes are the same height — see where
   * it is computed. Height is 1.5x this; a poster is 2:3.
   */
  artWidth: number;
  /**
   * Edge length of the **square** cover, when the game has one.
   *
   * **The budget, and `artWidth` is derived from it** — not the other way round.
   * A square cover is album art: the reference is a now-playing screen, where
   * the art is the top of the page. Sizing it as a fraction of a poster would
   * give a square the size of a poster, which reads as a cropped poster rather
   * than as a record sleeve.
   */
  squareWidth: number;
  /** How far a dealt card travels before it is let go. */
  exitDistance: number;
  /** Too short for the standing hint and the metadata row. */
  compact: boolean;
};

/**
 * Sizes the reveal against the viewport it actually has.
 *
 * The one screen in the app that must not scroll, so it is also the one screen
 * whose artwork is a function of the display rather than a fixed dp value.
 * Everywhere else a literal is right — retuning the spacing ladder must not move
 * the art — but here the art has a job the ladder cannot do for it, which is fit.
 *
 * It is a plain `<Poster>` now, not the physical case. That removes the hardest
 * constraint this function had: `<GameCaseDisplay>` is variable-height by
 * platform (a console case is 1.259x its width, a PC cover 1.5x), so every
 * budget here had to reserve the taller shape and live with the gap under the
 * shorter one. A poster is always 2:3, so the height below is exact.
 */
export function revealLayout(width: number, height: number): RevealLayout {
  const compact = height < 700;

  /*
   * The square: the content width, unless the display is too short to spend it.
   *
   * `SQUARE_RATIO` of the width is what normally binds — 328dp on a 390dp phone,
   * leaving a real margin either side rather than running to the gutter. The
   * height factor is a guard rather than a ratio: a square is 1.5x taller than a
   * poster of the same width, and that height comes out of the spacer between
   * the meta block and the support cards.
   *
   * A compact display drops to 0.32 and *does* bind — a 360x640 phone shows a
   * 204dp square rather than a 302dp one. That is the same call `compact` makes
   * everywhere else in this function: the screen must not scroll, so on a short
   * display the artwork is what yields.
   *
   */
  const squareWidth = Math.round(
    Math.max(140, Math.min(width * SQUARE_RATIO, height * (compact ? 0.32 : 0.42)))
  );

  /*
   * The portrait fallback, sized to the **same height** as the square.
   *
   * This used to be its own budget — `min(200, width * 0.42, height * 0.2)` —
   * and that was fine while it was the only shape this screen drew. It is not
   * any more: a game with square art shows a 328dp block and one without showed
   * a 164dp poster, so dealing through the deck changed the size of the subject
   * and moved everything under it by a different amount each time.
   *
   * Matching the *height* rather than the width is what fixes it. A 2:3 poster
   * whose height equals the square's edge is 0.667 as wide — narrower, which is
   * correct, because it is a different object — and the block below it starts at
   * exactly the same y whichever one is on screen. Nothing else moves.
   */
  const artWidth = Math.round(squareWidth * PosterAspectRatio);

  return {
    artWidth,
    squareWidth,
    exitDistance: Math.round(width * 1.15),
    /*
     * Short displays drop the standing swipe hint and the metadata row.
     *
     * A 640dp Android phone gives up 48 of it to the navigation bar, and this
     * screen now carries a review as well as a soundtrack. The hint teaches
     * something the `Another game` button already does, and the platform marks
     * repeat what the cover art already shows — those two go before the artwork
     * or the writing does.
     */
    compact,
  };
}

/**
 * An opacity beat that runs whatever the motion setting says.
 *
 * `useArrival` resolves to 1 immediately under Reduce Motion, which is right for
 * movement and wrong for continuity: with every spring flattened there would be
 * no transition between one game and the next at all, just a cut. Both platform
 * references ask for a crossfade in exactly this case, so this is driven
 * separately and is never switched off.
 */
function useCrossfade(duration = 180): SharedValue<number> {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(withTiming(1, { duration, easing: Easing.out(Easing.quad) }));
  }, [duration, progress]);

  return progress;
}

/**
 * Type and controls trailing the card by a fraction of its travel.
 *
 * Not a ratio picked for effect: it is what makes the block read as one object
 * with a card in front of it rather than as a card sliding across a static page.
 * They also clear faster than the case, so the words are gone before the artwork
 * is — which is what stops the old title being legible under the new one.
 */
function useFollowStyle(
  dealX: SharedValue<number>,
  fade: SharedValue<number>,
  arrival: SharedValue<number>,
  lift: number,
  clearAt: number
) {
  return useAnimatedStyle(() => {
    const offset = dealX.get();
    const arrived = arrival.get();

    return {
      opacity: fade.get() * arrived * interpolate(Math.abs(offset), [0, clearAt], [1, 0], 'clamp'),
      transform: [
        { translateX: offset * FOLLOW_RATIO },
        { translateY: interpolate(arrived, [0, 1], [lift, 0]) },
      ],
    };
  });
}

export type SurpriseRevealProps = {
  game: GameSearchResult;
  /**
   * Which way the deck last moved, so the incoming card enters from the side it
   * came from. Continuity is the whole reason the direction is carried this far.
   */
  from: DealDirection;
  /** False at the start of the deck: swiping back rubber-bands instead. */
  canGoBack: boolean;
  onDeal: (direction: DealDirection) => void;
  /**
   * Live card offset, owned by the screen.
   *
   * Hoisted out of this component because the swipe lights are mounted at screen
   * level and read the same value — and because this component is keyed on the
   * game, so a value living here would be destroyed by the very deal it is
   * animating. The screen resets it as part of `deal()`.
   */
  dealX: SharedValue<number>;
  onOpenGame: () => void;
  /**
   * Banish this game from every future roll. Double tap on the cover.
   *
   * The gesture is on the artwork rather than on a control because the artwork
   * is the game — this is "not this one", said to the thing itself, and a sixth
   * button under the card would be a permanent affordance for an action most
   * people take rarely. It is not the only route: the same list is editable in
   * Settings, which is also where it can be undone.
   */
  onHide: () => void;
  /**
   * Whether the "you have hidden this game" panel is showing over the cover.
   *
   * Owned by the screen, which also owns the ten-second timer — this component
   * is keyed on the game and would lose any timer of its own to the next deal.
   * Note it does **not** mean "this game is hidden": it means the panel is up.
   * A game stays hidden forever; the panel is a ten-second announcement, and the
   * card underneath is fully usable throughout.
   */
  hidden: boolean;
  /**
   * The viewer has already played or dropped this one.
   *
   * Reachable with the exclusion on: `excludeLogged` abandons the filter rather
   * than handing back an empty batch, and `getUserLogs` only covers the hundred
   * most recent logs. Saying so on the card is what keeps that honest.
   */
  alreadyPlayed?: boolean;
  /**
   * The most-liked review of this game, or nothing when it has none.
   *
   * Sits between the title and the music because that is its order of use: what
   * the game *is*, then what one person made of it, then what it sounds like.
   */
  review?: ReactNode;
  /** The soundtrack row, mounted by the screen so this file owns no data. */
  soundtrack: ReactNode;
  /**
   * Put this game on the backlog. The bookmark beside the title.
   *
   * A round icon button rather than the full-width `Add to backlog` bar this
   * replaced. The bar and its twin took a whole row at the bottom of a screen
   * that must not scroll, to carry two words each — and the pair of them sat
   * below the review and the soundtrack, which is under the fold on a short
   * display. Beside the title they are where the eye already is, and the two
   * icons are the conventional ones: a bookmark saves, a skip arrow advances.
   */
  onBacklog: () => void;
  /** Drives the bookmark's glyph and its disabled state. */
  backlog: { done: boolean; busy: boolean; failed: boolean };
  layout: RevealLayout;
};

/**
 * One dealt game.
 *
 * ## The motion thesis
 *
 * The card is dealt. The entry deck on Discover is cut, and this is what came
 * off it — so the object you swiped toward is the object you swipe away. Left
 * deals the next game, right puts the last one back, and the case travels under
 * the finger the whole way rather than waiting for a release to animate.
 *
 * That is the feature's one authored moment. Everything else is quiet supporting
 * state: the case lands on `ARRIVAL_OBJECT`, the title and the controls follow on
 * `ARRIVAL_CONTROL` in two short beats, and nothing loops.
 *
 * ## Why the gesture survives Reduce Motion and the fly-off does not
 *
 * A swipe is an *input*. Removing it would answer an accessibility preference by
 * deleting an accessibility affordance — the same reasoning `<PressableScale>`
 * records for dimming instead of switching off. So the drag still tracks the
 * finger; what changes is the *reply*. The card crossfades instead of flying,
 * per both platform references, and the arrival springs collapse to the opacity
 * beat alone.
 *
 * The visible `Roll again` control is not this gesture's fallback, it is the
 * primary path — a gesture is never the only way to reach an action here — and
 * `accessibilityActions` puts both directions in the VoiceOver rotor besides.
 */
export function SurpriseReveal({
  game,
  from,
  canGoBack,
  onDeal,
  dealX,
  onOpenGame,
  onHide,
  hidden,
  alreadyPlayed = false,
  review,
  soundtrack,
  onBacklog,
  backlog,
  layout,
}: SurpriseRevealProps) {
  const accent = useAccent();
  const theme = useTheme();

  /*
   * The square cover, and **nothing is drawn until it has an answer**.
   *
   * `resolved` is the fix for the flicker this screen had: it painted the IGDB
   * portrait the moment the game arrived and replaced it with the square a beat
   * later, so every deal was two different covers. Holding the skeleton through
   * the lookup means one cover per game — and the answer is on disk afterwards,
   * so a game you have seen before resolves before its first paint. See
   * `useSquareCover`.
   */
  const square = useSquareCover({ gameId: game.id, title: game.title });

  const commitAt = layout.artWidth * COMMIT_FRACTION;

  const caseArrival = useArrival(0, ARRIVAL_OBJECT);
  const titleArrival = useArrival(TITLE_DELAY, ARRIVAL_CONTROL);
  const supportArrival = useArrival(SUPPORT_DELAY, ARRIVAL_CONTROL);
  const fade = useCrossfade();

  const caseStyle = useAnimatedStyle(() => {
    const offset = dealX.get();
    const arrived = caseArrival.get();
    /* Enters from the side the deck moved, so a card dealt forward arrives from
       the right and a card put back arrives from the left. */
    const entering = interpolate(arrived, [0, 1], [from * 44, 0]);

    return {
      opacity:
        fade.get() * interpolate(Math.abs(offset), [0, layout.exitDistance], [1, 0.2], 'clamp'),
      transform: [
        { translateX: offset + entering },
        { scale: interpolate(arrived, [0, 1], [0.94, 1]) },
        {
          rotate: `${interpolate(
            offset,
            [-layout.exitDistance, 0, layout.exitDistance],
            [-EXIT_ROTATION, 0, EXIT_ROTATION]
          )}deg`,
        },
      ],
    };
  });

  const titleStyle = useFollowStyle(dealX, fade, titleArrival, 14, commitAt * 2);
  const supportStyle = useFollowStyle(dealX, fade, supportArrival, 10, commitAt * 2);

  const families = platformFamilies(game.platforms);

  /*
   * Two taps on the same artwork, and the order between them is the whole trick.
   *
   * `Gesture.Exclusive` makes the double tap the favoured one: the single tap is
   * held until the double has had its chance to fail, so one tap still opens the
   * game page and two never do it on the way past. Written as gesture handlers
   * rather than as a `<Pressable>` because a Pressable claims the touch through
   * React Native's own responder system and would race the recogniser — the same
   * fight this file's own note records between the old card-drag and the
   * Pressable that replaced it.
   *
   * `.runOnJS(true)` on both: these call straight into a mutation and a router
   * push, so there is nothing to gain from a worklet and `runOnJS` wrapping at
   * every call site to lose.
   */
  const openGame = Gesture.Tap()
    .runOnJS(true)
    .onEnd((_event, success) => {
      if (success) onOpenGame();
    });

  const hideGame = Gesture.Tap()
    .runOnJS(true)
    .numberOfTaps(2)
    .onEnd((_event, success) => {
      if (!success) return;
      /* The one moment in this feature that removes something permanently, so it
         gets the heavier tick — `selectionAsync` is what the deck and the swipe
         threshold use, and this is not a selection. iOS only, for the reason
         `<SurpriseEntry>` records: Android's generic buzz reads as an error. */
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
      onHide();
    });

  const artTaps = Gesture.Exclusive(hideGame, openGame);

  return (
    <View style={styles.root}>
      {/* See `styles.spacer`: half the slack sits above the artwork, which is
          what lowers it clear of the floating discs. */}
      <View style={styles.spacer} />

      {/*
        The card, and the only thing the gesture moves.

        `accessibilityActions` is what makes the swipe reachable without one:
        VoiceOver lists both directions in the rotor, so the deck can be walked
        forward and back by somebody who cannot perform a drag at all.
      */}
      <Animated.View
        style={[styles.card, caseStyle]}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${game.title}. Open game page.`}
        accessibilityHint="Swipe left anywhere for another game, right to go back. Double tap the cover to hide this game from future rolls."
        accessibilityActions={ACTIONS}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'activate') onOpenGame();
          /* Straight to `onDeal`, not through the gesture's `commit`: the
               rotor is not a drag, so there is no card in flight to animate out
               and no haptic to acknowledge a threshold nobody crossed. */
          if (event.nativeEvent.actionName === 'next') onDeal(1);
          if (event.nativeEvent.actionName === 'previous' && canGoBack) onDeal(-1);
          /* A double tap is not performable by somebody driving the screen from
             the rotor, so hiding is in the rotor as an action of its own. A
             gesture is never the only way to reach something here. */
          if (event.nativeEvent.actionName === 'hide') onHide();
        }}>
        {/* No accessibility props of its own: the wrapper above is `accessible`,
            so it is the single focusable element and this would be announced
            inside it as a second button with the same name. */}
        <GestureDetector gesture={artTaps}>
          <View importantForAccessibility="no">
            {/*
              Square when the game has square art, portrait when it does not.

              Not a crop either way. A 2:3 cover forced into a square loses a
              third of itself, and this screen deals one game at a time — the
              artwork is the entire content of the view, so it is the last thing
              that should be cut. A game SteamGridDB has never heard of shows its
              IGDB box art at 2:3, whole, which is what this screen always did.

              The size difference between the two is real and deliberate: see
              `RevealLayout.squareWidth`. The card has no fixed height and the
              spacer below it flexes, so the two shapes cost nothing to swap
              between.
            */}
            {!square.resolved ? (
              /* The answer is not in yet. A skeleton in the square's own shape,
                 never the IGDB cover — drawing that and then replacing it is the
                 exact flicker `resolved` exists to prevent. */
              <Skeleton
                width={layout.squareWidth}
                height={layout.squareWidth}
                radius={SQUARE_RADIUS}
              />
            ) : square.uri ? (
              <SquareArt uri={square.uri} size={layout.squareWidth} title={game.title} />
            ) : (
              <Poster
                coverUrl={game.coverUrl}
                heroUrl={game.heroUrl}
                title={game.title}
                width={layout.artWidth}
                steamAppId={game.steamAppId}
                edition={game.edition}
                elevated
              />
            )}
            <HiddenNotice
              showing={hidden}
              width={square.uri ? layout.squareWidth : layout.artWidth}
            />
          </View>
        </GestureDetector>
      </Animated.View>

      {/*
        Everything the card says about the game, and the two things you can do
        to it — in the artwork's own column.

        Two rows, and they align differently on purpose. The facts pill is
        **centred on the cover**, because a score is a verdict on the object above
        it and belongs on its axis. The title, the credit line and the two
        controls are a **row ranged to the cover's edges**: left is what this is,
        right is what you can do with it, which is how a now-playing bar reads.

        Everything centred — which is what this was — makes a poster, and a
        poster is a thing you look at rather than a thing you act on. Everything
        ranged left loses the score's relationship to the art. One of each is the
        composition.

        The buttons are vertically centred against the two-line text column
        rather than pinned to its first line: they belong to the block, not to
        the line they happen to sit beside.
      */}
      <Animated.View style={[styles.meta, { width: layout.squareWidth }, titleStyle]}>
        {/*
            The facts, on an opaque tinted fill, and that is not decoration.

            `<ScoreLine>` draws in the score ramp and `<PlatformMarks>` draws each
            platform's brand colour, both as bare glyphs with nothing behind them.
            Measured against the vibrant ambience stop across all ten hues that is
            1.98:1 for `scoreLow` and 1.24:1 for Xbox green — brand colours picked
            against a near-black page, asked to hold up on a lit one.
            `accent.elevated` is `tint(surfaceElevated, hue, 0.3)`, which restores
            the original luminance rather than lightening it, so the block reads
            as the same surface step it would be on any other screen and every
            mark clears.

            The pool tag that used to sit above this is gone. "Popular" described
            the *query* rather than the game, on the one screen whose whole
            content is a single game — and it was the first line of the block, so
            the first thing read under the artwork was a piece of app plumbing.
            The pool is still chosen in Settings, which is where that fact lives.
          */}
        <View style={[styles.facts, { backgroundColor: accent.elevated }]}>
          <PlatformMarks families={families} />
          {game.score !== null && <ScoreLine score={game.score} />}
        </View>

        <View style={styles.titleRow}>
          <View style={styles.titleText}>
            {/*
            `h3`, down from `h1`, and bold is what it keeps.

            23px over a 12px credit line made the title the second-largest object
            on a screen whose largest is the artwork — two things competing to be
            the subject. At 16 it sits a step above the copy around it and lets
            the cover be the picture. Weight rather than size is what makes it
            stand out now, which is how the reference does it too.

            One line, and it scrolls when it does not fit — see `<MarqueeText>`.
            The old block wrapped to two, which moved everything under it by a
            line depending on how long the game's name happened to be.
          */}
            <MarqueeText
              text={game.title}
              variant="h3"
              /* The heading for the whole screen: a screen reader lands on the
               game's name, not on a row of platform glyphs. */
              accessibilityRole="header"
            />

            <Text variant="bodySmall" numberOfLines={1} style={{ color: accent.quietInk }}>
              {[game.releaseYear, game.developer, alreadyPlayed ? 'you’ve played this' : null]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>

          {/*
          Bookmark and skip, replacing the two full-width buttons that used to
          close the screen.

          Both were below the review and the soundtrack — the bottom of a screen
          that must not scroll — to carry two words each. The glyphs are the
          conventional pair and need no words: a bookmark saves a thing for
          later, a skip arrow moves to the next one. Each keeps its spoken label,
          so nothing is lost to a screen reader.
        */}
          <View style={styles.metaActions}>
            <RoundAction
              icon={backlog.done ? 'bookmark' : backlog.failed ? 'refresh' : 'bookmark-outline'}
              label={
                backlog.done
                  ? `${game.title} is in your backlog`
                  : backlog.failed
                    ? 'Could not add to your backlog. Try again.'
                    : `Add ${game.title} to your backlog`
              }
              selected={backlog.done}
              busy={backlog.busy}
              onPress={onBacklog}
              accent={accent}
              theme={theme}
            />
            <RoundAction
              icon="play-skip-forward"
              label="Another game"
              onPress={() => onDeal(1)}
              accent={accent}
              theme={theme}
            />
          </View>
        </View>
      </Animated.View>

      {/* One fixed step from the title block to the cards, not a flex hole. See
          `styles.spacer`. */}
      <Animated.View
        style={[styles.support, styles.supportGap, { width: layout.squareWidth }, supportStyle]}>
        {review}
        {soundtrack}
      </Animated.View>

      {/* Absorbs the difference between a 667pt display and an 852 one, so the
          reveal fills either without a scroll view and without a breakpoint. Its
          twin is above the artwork. */}
      <View style={styles.spacer} />

      {/* A standing instruction, not a coach mark: it does not appear on a timer,
          cannot be dismissed into never being seen again, and stops mattering the
          moment the gesture is learned. Hidden from screen readers, which are
          told the same thing by the case's own hint. */}
      {!layout.compact && (
        <Text
          variant="caption"
          style={[styles.hint, { color: accent.quietInk }]}
          importantForAccessibility="no"
          accessibilityElementsHidden>
          {/* Both gestures, in one line. The hide is worth naming here more than
              the swipe is: a swipe is the thing a card invites anyway, and a
              double tap on artwork is invisible until somebody says it exists. */}
          Swipe for another game · double tap the cover to hide it
        </Text>
      )}
    </View>
  );
}

const ACTIONS = [
  { name: 'next', label: 'Next game' },
  { name: 'previous', label: 'Previous game' },
  { name: 'hide', label: 'Hide this game from Surprise Me' },
];

/**
 * What the double tap has to say, drawn over the cover it was performed on.
 *
 * ## Why it is on the artwork and not at the edge of the screen
 *
 * Because the artwork is what was pressed, and because nothing else moves. The
 * card is not replaced, not dimmed and not dismissed — so a toast in a corner
 * would be the only evidence a deliberate gesture on a specific object did
 * anything, sixty per cent of a screen away from the object. Covering the cover
 * is the acknowledgement: the thing you said "not this one" about is the thing
 * that goes behind glass.
 *
 * ## Why it is mounted even when it is not showing
 *
 * So it can fade out. An unmounted overlay can only appear and vanish; Reanimated
 * layout animations would give it an exit, but `exiting` on a view inside a
 * gesture-handled, spring-animated subtree is a lot of machinery to buy one
 * crossfade. Zero opacity plus `pointerEvents="none"` costs one static view and
 * leaves the double tap underneath reachable the whole time — which matters,
 * because hiding an already-hidden game is a legal thing to do and simply
 * restarts the ten seconds.
 *
 * The opacity beat runs under Reduce Motion for the reason `useCrossfade`
 * records: with every spring flattened, a cut is not a transition.
 */
/**
 * A square cover, framed like the poster it replaces.
 *
 * Not a `<Poster>` with a different aspect ratio. `<Poster>` is the app's
 * portrait primitive — 2:3 is in its name, its docblock and its `PosterProps` —
 * and it carries a Steam-capsule preference and an edition badge that both
 * assume that shape. Teaching it a second ratio would put a branch in the one
 * component that is on nearly every screen, to serve one screen.
 *
 * What it does borrow is the frame: the same `Radius.caseImage` corner, the same
 * outer-view-fill / inner-view-clip split that `<Poster>` documents (Android
 * clips `elevation` away under `overflow: 'hidden'`, so the shadow and the clip
 * cannot share a view), and `Elevation.raised`, which is the tier `<Poster
 * elevated>` uses for a detail hero. The artwork changes shape; the object it is
 * mounted in does not.
 *
 * No edition badge. At this size the art is the screen, and the one game on it
 * is about to be named in `h1` directly underneath.
 */
function SquareArt({ uri, size, title }: { uri: string; size: number; title: string | null }) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.squareFrame,
        { width: size, height: size, backgroundColor: theme.surfaceElevated },
        Elevation.raised,
      ]}>
      <View style={styles.squareClip}>
        <Image
          source={{ uri, cacheKey: `square-${uri}` }}
          style={styles.squareImage}
          cachePolicy="memory-disk"
          contentFit="cover"
          transition={220}
          accessibilityIgnoresInvertColors
          accessibilityLabel={title ? `Cover art for ${title}` : undefined}
        />
      </View>
    </View>
  );
}

/**
 * One of the two round controls beside the title.
 *
 * Not `<IconButton>`: that primitive is a `Radius.control` rounded rectangle
 * with a hairline edge, which is the app's shape for a control in a toolbar or a
 * form. These are transport keys for the card above them — the same argument
 * `<Button shape="pill">` makes on the game page — and the circle is what says
 * so. They are the only two of their kind in the app and they stay that way.
 */
function RoundAction({
  icon,
  label,
  onPress,
  selected = false,
  busy = false,
  accent,
  theme,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  selected?: boolean;
  busy?: boolean;
  accent: ReturnType<typeof useAccent>;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, busy, disabled: busy }}
      disabled={busy}
      onPress={onPress}
      scaleTo={0.9}
      style={StyleSheet.flatten([
        styles.roundAction,
        busy && styles.roundBusy,
        {
          /* M3's filled-tonal → filled pair, the same one the game page's action
             row uses. A saved bookmark is a *state*, so it lights; skip is an
             act and stays tonal however many times it is pressed. */
          backgroundColor: selected ? accent.m3.primaryContainer : accent.m3.surfaceContainerHigh,
        },
      ])}>
      <Ionicons
        name={icon}
        size={22}
        /* Measured against the fill directly behind it rather than against the
           page — the fill is the only thing under the glyph. */
        color={selected ? accent.m3.onPrimaryContainer : theme.text}
      />
    </PressableScale>
  );
}

/**
 * How long the title holds still at each end of its travel, in ms.
 *
 * A marquee that turns round the instant it arrives is unreadable at exactly the
 * moment it matters — the end of the title is the part you could not see. It
 * rests there for as long as it rested at the start.
 */
const MARQUEE_HOLD = 1400;

/** Scroll speed, in ms per dp. Slow enough to read a proper noun at a glance. */
const MARQUEE_MS_PER_DP = 22;

/** How fast it returns. A snap back, not a second read of the same words. */
const MARQUEE_RETURN_MS = 420;

/**
 * A single line of text that scrolls to reveal its end, then loops.
 *
 * For the one string on this screen whose length is not ours: a game's title.
 * "The Legend of Zelda: Tears of the Kingdom" does not fit beside two round
 * buttons at any type size this block can afford, and the alternatives are both
 * worse — wrapping to two lines moves everything under it by a line depending on
 * the game, and truncating loses the half of a subtitle that distinguishes one
 * edition from another.
 *
 * ## How it measures
 *
 * A second, off-screen copy at `left: -9999` inside a 9999dp box, where nothing
 * constrains it, reports its natural width; the visible window reports the space
 * available. The difference is the travel. This is two `onLayout` callbacks
 * rather than an effect — a layout event is an event, so the state it sets is
 * not the setState-in-an-effect the React Compiler rules forbid.
 *
 * ## When it does nothing
 *
 * A title that fits is not animated at all, which is the overwhelming majority
 * of them. Neither is any title under Reduce Motion: a looping horizontal
 * crawl is precisely the vestibular trigger that setting exists for, and the
 * fallback is an ellipsis, which is what the block did before.
 */
function MarqueeText({
  text,
  variant,
  accessibilityRole,
}: {
  text: string;
  variant: 'h3';
  accessibilityRole?: 'header';
}) {
  const reduceMotion = useReducedMotion();
  const [boxWidth, setBoxWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);

  const overflow = boxWidth > 0 && textWidth > boxWidth ? Math.ceil(textWidth - boxWidth) : 0;
  const scrolling = overflow > 0 && !reduceMotion;

  const offset = useSharedValue(0);

  useEffect(() => {
    if (!scrolling) {
      offset.set(0);
      return;
    }

    offset.set(0);
    offset.set(
      withRepeat(
        withSequence(
          withDelay(
            MARQUEE_HOLD,
            withTiming(-overflow, {
              duration: overflow * MARQUEE_MS_PER_DP,
              easing: Easing.inOut(Easing.quad),
            })
          ),
          withDelay(
            MARQUEE_HOLD,
            withTiming(0, { duration: MARQUEE_RETURN_MS, easing: Easing.out(Easing.quad) })
          )
        ),
        -1,
        false
      )
    );

    return () => {
      offset.set(0);
    };
  }, [scrolling, overflow, offset]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));

  return (
    <View
      style={styles.marquee}
      onLayout={(event) => setBoxWidth(event.nativeEvent.layout.width)}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={text}>
      {/* The probe. Never seen, never read aloud, never part of the layout. */}
      <View style={styles.marqueeProbe} pointerEvents="none" accessibilityElementsHidden>
        <Text
          variant={variant}
          numberOfLines={1}
          style={styles.marqueeText}
          onLayout={(event) => setTextWidth(event.nativeEvent.layout.width)}>
          {text}
        </Text>
      </View>

      <Animated.View style={style}>
        {/* An explicit width when it is scrolling, so the line is laid out at its
            natural size and the window does the cutting. Without it the Text
            truncates itself to the window and there is nothing left to reveal. */}
        <Text
          variant={variant}
          numberOfLines={1}
          style={scrolling ? { width: textWidth } : undefined}
          importantForAccessibility="no">
          {text}
        </Text>
      </Animated.View>
    </View>
  );
}

function HiddenNotice({ showing, width }: { showing: boolean; width: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(withTiming(showing ? 1 : 0, { duration: 220, easing: Easing.out(Easing.quad) }));
  }, [showing, progress]);

  const style = useAnimatedStyle(() => ({ opacity: progress.get() }));

  return (
    <Animated.View
      style={[styles.notice, style]}
      /* Never a touch target. The card underneath keeps every one of its
         gestures while this is up — that is the whole point of not advancing. */
      pointerEvents="none"
      /* The screen announces the same sentence through `AccessibilityInfo` at
         the moment it happens, so reading it again here would be the second
         time. `accessibilityElementsHidden` keeps it out of the rotor without
         keeping it off the display. */
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden>
      {/* Sized off the cover so the glyph scales with the art rather than
          swamping it on a small display. */}
      <Ionicons name="eye-off" size={Math.round(width * 0.26)} color="#FFFFFF" />
      <Text variant="h5" style={styles.noticeTitle}>
        You have hidden this game
      </Text>
      <Text variant="caption" style={styles.noticeBody}>
        We won’t recommend you this game anymore, check your settings to undo this.
      </Text>
    </Animated.View>
  );
}

/**
 * The reveal's own shape, held while a fresh batch loads.
 *
 * A skeleton rather than a spinner, per DESIGN.md §22 — and here the rule is
 * earned twice over, because the shape of what is coming is known exactly and
 * the alternative was tearing the whole screen down to a centred
 * `ActivityIndicator` on every fiftieth press.
 */
export function SurpriseRevealSkeleton({ layout }: { layout: RevealLayout }) {
  /*
   * The square, because that is the shape this screen is designed around now.
   *
   * There is no way to know which of the two is coming — the square lookup needs
   * the game the skeleton exists because we do not yet have — so one of the two
   * cases gets a shape change on arrival either way. It goes to the fallback: a
   * game with no SteamGridDB art settles from a square into a poster, which is
   * the less common path and the one where a jump is least surprising, because
   * something visibly different arrived.
   */
  return (
    <View style={styles.root}>
      <View style={styles.spacer} />

      <View style={[styles.card, { height: layout.squareWidth }]}>
        <Skeleton width={layout.squareWidth} height={layout.squareWidth} radius={SQUARE_RADIUS} />
      </View>

      {/* The meta block's shape, in the artwork's own column: the facts pill
          centred, then the title, the credit line and the two controls. */}
      <View style={[styles.meta, styles.skeletonMeta, { width: layout.squareWidth }]}>
        <View style={styles.skeletonFacts}>
          <Skeleton width={96} height={20} radius={Radius.pill} />
        </View>
        <View style={styles.titleRow}>
          <View style={styles.titleText}>
            <Skeleton width={168} height={18} radius={Radius.sm} />
            <Skeleton width={124} height={12} radius={Radius.sm} />
          </View>
          <View style={styles.metaActions}>
            <Skeleton width={ROUND_ACTION} height={ROUND_ACTION} radius={Radius.pill} />
            <Skeleton width={ROUND_ACTION} height={ROUND_ACTION} radius={Radius.pill} />
          </View>
        </View>
      </View>

      <View style={[styles.support, styles.supportGap, { width: layout.squareWidth }]}>
        <Skeleton width="100%" height={64} radius={Radius.card} />
      </View>

      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
  /*
   * No `height`. `<GameCaseDisplay>` sizes itself and its height depends on the
   * platform, so a fixed box either leaves a gap under a console case or is
   * overflowed by a PC cover — which is the overlap this screen shipped with.
   * The flex spacer below absorbs whichever it turns out to be.
   */
  card: { alignItems: 'center' },
  /*
   * **Exactly as wide as the artwork**, set inline from `layout.squareWidth`.
   *
   * This is the alignment rule for the whole screen and it is worth stating
   * plainly: the cover is the widest object here, so the cover's edges are the
   * page's margins. Everything else — the facts pill, the title, the credit
   * line, the two cards below — is laid out in that same column and lines up
   * with it on both sides.
   *
   * It used to be `alignSelf: 'stretch'` with a 12dp gutter, which made every
   * block wider than the art it belonged to. Nothing shared an edge with
   * anything, and a column whose items each start at a different x reads as
   * broken rather than as loose.
   */
  meta: { gap: Spacing.x8, marginTop: Spacing.x20 },
  /* The title and the two controls on one line. `center` on the cross axis puts
     the buttons against the middle of the two-line text column rather than
     against its first line. */
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  /* `flex: 1` and `minWidth: 0`. The second is what lets the marquee's clip
     actually clip: without it a long title measures its natural width and pushes
     the buttons off the row instead of being cut by it. */
  titleText: { flex: 1, minWidth: 0, gap: Spacing.x4 },
  metaActions: { flexDirection: 'row', gap: Spacing.x8 },
  skeletonMeta: { gap: Spacing.x8 },
  /* The facts pill is centred on the artwork; its placeholder is too. */
  skeletonFacts: { alignSelf: 'center' },
  /* Centred on the artwork, on its own line above the title.
     
     `alignSelf: 'center'` inside a column that is exactly the cover's width is
     what makes "91 EXCELLENT" centre *on the cover* rather than on the display —
     the same thing here only because the column is centred too, and the right
     thing to write because it stays true if the column ever moves. */
  facts: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: Spacing.x12,
    /* Pill, not `Radius.control` — this is metadata, and shape is the only thing
       left distinguishing a run of facts from a row of buttons. */
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.x12,
    paddingVertical: Spacing.x4,
  },
  /* Circular, and the one shape in the app allowed to be: these are the
     transport controls for the card above them, not form buttons, and the round
     key is what the reference — and every music player — uses to say so. */
  roundAction: {
    width: ROUND_ACTION,
    height: ROUND_ACTION,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundBusy: { opacity: 0.5 },
  /* The window the title scrolls inside. `hidden` is the whole mechanism. */
  marquee: { alignSelf: 'stretch', overflow: 'hidden' },
  /* Off-screen twin, measured at its natural width so the marquee knows how far
     it has to travel. `left: -9999` rather than `opacity: 0` — an invisible copy
     still occupies its own line and would double the block's height. */
  marqueeProbe: { position: 'absolute', left: -9999, top: 0, width: 9999 },
  marqueeText: { alignSelf: 'flex-start' },
  /*
   * The four offsets written out rather than `StyleSheet.absoluteFillObject` —
   * that is gone from the RN types on SDK 57 (see CLAUDE.md).
   *
   * `Radius.caseImage` so the scrim ends exactly where the artwork does; a
   * square overlay on a rounded poster leaves four lit corners. The fill is a
   * plain black alpha rather than a theme token on purpose: it sits on *artwork*,
   * which is the one surface in the app whose colour is unknown at build time,
   * and 0.82 is what carries white type over a bright cover as well as a dark one.
   */
  notice: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.x8,
    paddingHorizontal: Spacing.x12,
    borderRadius: SQUARE_RADIUS,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
  },
  noticeTitle: { textAlign: 'center' },
  /* Not `textMuted`: the token is chosen against the app's near-black page, and
     this sits on an 82% scrim over arbitrary artwork. A white at 78% is the same
     idea — quieter than the line above — without borrowing a value measured
     somewhere else. */
  noticeBody: { textAlign: 'center', color: 'rgba(255, 255, 255, 0.78)' },
  /* Fill and shadow out here, clip on the child — Android drops `elevation`
     under `overflow: 'hidden'`. Same split `<Poster>` documents. */
  squareFrame: { borderRadius: SQUARE_RADIUS },
  squareClip: { width: '100%', height: '100%', borderRadius: SQUARE_RADIUS, overflow: 'hidden' },
  squareImage: { width: '100%', height: '100%' },
  /*
   * Two spacers, equal, one above the artwork and one below the cards.
   *
   * There was one, between the meta block and the cards, and it took **all** the
   * slack: the artwork sat hard against the top of the display with the floating
   * discs on top of it, and a 90dp hole opened in the middle of the screen. Slack
   * at both ends instead centres the whole column vertically, which lowers the
   * art clear of the discs and leaves the internal gaps at the fixed, small
   * values they are written as.
   *
   * They collapse to nothing on a short display, where `squareWidth`'s own height
   * guard has already given up artwork to make the content fit.
   */
  spacer: { flex: 1, minHeight: Spacing.x16 },
  /* Width comes from `layout.squareWidth` inline, like the meta block — the
     cards line up with the artwork's edges, not with a page gutter. */
  support: { gap: Spacing.x12 },
  /* The breathing space between the title block and the cards, and all of it. */
  supportGap: { marginTop: Spacing.x24 },
  hint: { marginTop: Spacing.x12 },
});
