import { useCallback, useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { caseHeightFor } from '@/components/game-case';
import { GameCaseBack } from '@/components/game-case-back';
import { GameCaseDisplay } from '@/components/game-case-display';
import { hasCase, type PlatformKey } from '@/constants/platform-cases';
import { PosterAspectRatio } from '@/constants/theme';
import { labelFor } from '@/constants/score';
import { STATUS_LABEL } from '@/constants/status';
import { useArrival } from '@/hooks/use-arrival';
import type { GameLog } from '@/lib/database.types';

/**
 * The case, as an object you can pick up and turn over.
 *
 * Two behaviours share one transform, and they belong together because they
 * answer the same question — *is this a picture of a box, or a box?*
 *
 *   **It has weight.** On arrival the case falls the last few millimetres into
 *   place: raised, over-turned and slightly small, settling on one spring with a
 *   single shallow overshoot. Not a fade — a fade says "content loaded", and
 *   this has to say "object landed".
 *
 *   **Pick it up.** Drag across the case and it turns under your finger, front
 *   through edge to back, where it prints the one thing no storefront has: your
 *   record. Past the commit angle it completes; short of it, it falls back. A
 *   tap does the same in one motion, which is what makes the back reachable
 *   without knowing the gesture is there.
 *
 * **The protected component's geometry is untouched.** `game-case.tsx` — its
 * template metadata, its cover window, its shadow, its pinned `Type.caseTitle`
 * and `Radius.caseImage` — is neither edited nor restyled. The one thing that
 * changed there is the *default value* of its `tilt` prop, 6 → 0, which is the
 * seam that prop exists to be: *"so a future 'rotate the case' animation can
 * drive it from a shared value without touching this component."* The front is
 * still handed `tilt={0}` explicitly and every degree of rotation is composed
 * here.
 *
 * ## The case rests square
 *
 * It used to sit at a permanent 6°. That angle was doing one job — saying "this
 * is an object, not a picture of one" — and two other things now say it better:
 * the case *lands* on arrival, and it *turns over* when you drag it. Both are
 * motion, and motion is a far stronger claim about physicality than a static
 * skew is. What the resting tilt cost was the artwork: a permanent rotation
 * foreshortens one edge of the cover for the entire time the page is open, on
 * the largest and most deliberate rendering of box art in the app.
 *
 * So rest is 0 and nothing else changes. The entrance still overshoots and
 * settles, and the turn still runs the full 180.
 */

/** Drag distance, as a fraction of the case width, that equals a half-turn. */
const TURN_PER_WIDTH = 1.15;

/**
 * How far past the front a drag must carry before releasing completes the turn.
 *
 * 52 rather than the geometric midpoint: a box you have turned most of the way
 * over goes the rest of the way by itself, and demanding a true 90° made honest
 * attempts fall back. Applied symmetrically from either face, so the control has
 * hysteresis instead of a hair trigger at the halfway point.
 */
const COMMIT_ANGLE = 52;

/** Past this, a release is a throw and its direction decides, not its distance. */
const FLING_VELOCITY = 550;

/** Rubber band. A drag can overshoot each face by this much and no further. */
const OVERTURN = 22;

/** The turned case comes toward you to be read. Small — it overlaps its neighbour. */
const READ_SCALE = 1.08;

/** The turn itself is stiffer than the landing. Plastic, not rubber. */
const TURN = { damping: 18, stiffness: 140, mass: 0.8 } as const;

export type GameCaseFlipProps = {
  coverUrl?: string | null;
  heroUrl?: string | null;
  title?: string | null;
  edition?: string | null;
  platform: PlatformKey;
  width: number;
  /** The viewer's own log, printed on the back. Null when they have none. */
  log: GameLog | null;
};

export function GameCaseFlip({
  coverUrl,
  heroUrl,
  title,
  edition,
  platform,
  width,
  log,
}: GameCaseFlipProps) {
  const reduceMotion = useReducedMotion();

  /** Degrees turned away from the front. 0 = front, 180 = back. */
  const turn = useSharedValue(0);
  /** Which face is settled — the value a drag is measured from. */
  const facing = useSharedValue(0);
  /**
   * 0 on mount → 1 landed.
   *
   * The first beat of the masthead's arrival: the case lands, then the action
   * row follows it in. Sharing `useArrival` with those buttons is what makes the
   * two one sequence rather than two components animating past each other.
   */
  const landed = useArrival();

  /*
   * A stand-in cover has no back to turn over.
   *
   * PC and mobile render bare artwork rather than a case, so there is no object
   * with two sides — turning one over would invent a physical fact the platform
   * never had. Those games keep the entrance and lose the gesture, which is the
   * same reasoning that gave them no case to begin with.
   */
  const flippable = hasCase(platform);

  /*
   * Both faces start at this wrapper's left edge.
   *
   * `<GameCase>` used to lay itself out as `width + spineWidth` and push the
   * face right by that much, so the back had to be inset by the same amount or
   * the turn would visibly slide sideways. The drawn spine is gone — the
   * template PNG is the whole object now — so the front's face and the back's
   * face are the same rectangle, and neither needs an offset.
   *
   * **The height has to be asked per platform, and getting that wrong was a
   * visible bug.** A case template is 540×680, so it renders at `width × 1.259`.
   * A PC or mobile game has no case and renders a bare 2:3 poster, which is
   * `width × 1.5` — 19% taller. This wrapper is a fixed-size box in a flex row,
   * so hard-coding `caseHeightFor` meant the poster overflowed it by
   * `width × 0.24` and drew straight over the platform buttons underneath: 36dp
   * of overlap at the 148dp the game page asks for on a 390dp phone. The layout
   * reserved a case and was handed a poster.
   */
  const height = flippable ? caseHeightFor(width) : width / PosterAspectRatio;

  /*
   * Changing platform puts the case back on its front, instantly.
   *
   * Two reasons, and the first is a bug rather than a preference: switching to
   * PC unmounts the back entirely, so a case left turned would show neither face
   * and read as an empty slot. The second is that the switcher hands you a
   * different object — different art, different branding — and the front is what
   * you asked to look at. Snapped rather than animated because the artwork
   * underneath swaps in the same frame; turning to reveal a face that already
   * changed would be animating a lie.
   */
  useEffect(() => {
    facing.set(0);
    turn.set(0);
  }, [platform, facing, turn]);

  const announce = useCallback((toBack: boolean) => {
    AccessibilityInfo.announceForAccessibility(toBack ? 'Showing your record' : 'Showing cover');
  }, []);

  /** Runs on the JS thread: a settle is one discrete event, never a per-frame cost. */
  const settle = useCallback(
    (toBack: boolean) => {
      const target = toBack ? 180 : 0;
      facing.set(target);
      turn.set(reduceMotion ? withTiming(target, { duration: 140 }) : withSpring(target, TURN));
      announce(toBack);
    },
    [announce, facing, reduceMotion, turn]
  );

  const pan = Gesture.Pan()
    /* Vertical slop stays generous so the page keeps scrolling: this sits in a
       FlatList header, and a case that swallowed vertical drags would make the
       whole masthead feel stuck. */
    .activeOffsetX([-12, 12])
    .failOffsetY([-14, 14])
    .enabled(flippable)
    .onUpdate((event) => {
      const swept = (event.translationX / (width * TURN_PER_WIDTH)) * 180;
      const raw = facing.get() + swept;
      turn.set(Math.max(-OVERTURN, Math.min(180 + OVERTURN, raw)));
    })
    .onEnd((event) => {
      const swept = (event.translationX / (width * TURN_PER_WIDTH)) * 180;
      const ended = facing.get() + swept;
      const flung = Math.abs(event.velocityX) > FLING_VELOCITY;
      /* A throw is decided by where it was going; a drag by how far it got. The
         threshold is measured from whichever face the drag started on. */
      const toBack = flung
        ? event.velocityX > 0
        : facing.get() < 90
          ? ended > COMMIT_ANGLE
          : ended > 180 - COMMIT_ANGLE;
      runOnJS(settle)(toBack);
    });

  const tap = Gesture.Tap()
    .enabled(flippable)
    .onEnd(() => {
      runOnJS(settle)(facing.get() < 90);
    });

  const gesture = Gesture.Exclusive(pan, tap);

  /**
   * One axis for both faces.
   *
   * The rotation lives here rather than on each face so they turn about the
   * *same* centre. Rotating them separately would spin each about its own middle
   * and the two would drift apart mid-turn, which reads as two cards rather than
   * one object with two sides.
   */
  const object = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { translateY: interpolate(landed.get(), [0, 1], [-14, 0]) },
      {
        scale:
          interpolate(landed.get(), [0, 1], [0.92, 1]) *
          interpolate(Math.abs(turn.get()), [0, 180], [1, READ_SCALE], 'clamp'),
      },
      {
        rotateY: `${turn.get() + interpolate(landed.get(), [0, 1], [14, 0])}deg`,
      },
    ],
  }));

  /*
   * Which face is showing, decided twice over.
   *
   * `backfaceVisibility` is the idiomatic answer and is honoured inconsistently
   * on Android, so a hard opacity step at the edge does the same job unaided. A
   * step, never a fade: crossfading two faces of one object shows both at once
   * through the middle of the turn, which reads as a glitch rather than a turn.
   */
  const frontFace = useAnimatedStyle(() => ({ opacity: turn.get() < 90 ? 1 : 0 }));
  const backFace = useAnimatedStyle(() => ({ opacity: turn.get() < 90 ? 0 : 1 }));

  const label = describe({ title, edition, platform, log, flippable });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessible
        accessibilityRole={flippable ? 'button' : 'image'}
        accessibilityLabel={label}
        accessibilityHint={flippable ? 'Turns the case over to show your record' : undefined}
        onAccessibilityTap={flippable ? () => settle(facing.get() < 90) : undefined}
        style={[styles.object, { width, height }, object]}>
        {/* Both faces are hidden from assistive tech and the whole object above
            carries one label: `<GameCase>` marks *itself* `accessible` with an
            image role, which would otherwise sit inside this button as a second
            stop announcing the same artwork again. */}
        <Animated.View
          style={frontFace}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          <GameCaseDisplay
            coverUrl={coverUrl}
            heroUrl={heroUrl}
            title={title}
            edition={edition}
            platform={platform}
            width={width}
            tilt={0}
          />
        </Animated.View>

        {flippable && (
          <Animated.View
            style={[styles.back, backFace]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants">
            <View style={styles.shadow}>
              <GameCaseBack platform={platform} log={log} width={width} />
            </View>
          </Animated.View>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * One sentence carrying everything both faces print.
 *
 * A screen reader never sees the turn, so it must not be made to perform one:
 * the record is announced with the artwork rather than hidden behind a gesture.
 */
function describe({
  title,
  edition,
  platform,
  log,
  flippable,
}: {
  title?: string | null;
  edition?: string | null;
  platform: PlatformKey;
  log: GameLog | null;
  flippable: boolean;
}): string {
  const object = [title, edition, platform.toUpperCase()].filter(Boolean).join(', ');
  if (!flippable) return object;
  if (!log) return `${object}. Not logged.`;

  const record = [
    STATUS_LABEL[log.status],
    /* The blurb is printed on the back now, so it has to be announced. Only
       the headline — the body is truncated to two printed lines, and reading a
       clipped half-sentence aloud is worse than not reading it. The full text
       is on the review screen, which the page links to. */
    log.review_title?.trim() ? `titled ${log.review_title.trim()}` : null,
    log.rating !== null ? `scored ${log.rating} out of 100, ${labelFor(log.rating)}` : null,
    log.played_on?.trim() ? `played on ${log.played_on.trim()}` : null,
    log.hours_played != null ? `${log.hours_played} hours` : null,
    log.platinum ? 'platinum earned' : null,
  ].filter(Boolean);

  return `${object}. Your record: ${record.join(', ')}.`;
}

const styles = StyleSheet.create({
  /*
   * Sized explicitly and painted above its siblings.
   *
   * The case sits in a row beside the title column, and turning it scales it
   * past its own bounds — a static `zIndex` keeps it in front for that moment
   * without recomputing stacking every frame. At rest it overlaps nothing, so
   * this changes no pixel of the incumbent layout.
   */
  object: { alignItems: 'flex-start', justifyContent: 'flex-start', zIndex: 2 },
  /*
   * Pre-turned a half turn, so the parent's rotation lands it facing you.
   *
   * Without this the back rides the parent to 180° and you are looking at the
   * *reverse* of the back face — every glyph and every word mirrored. The static
   * 180 here cancels it: at rest the composed angle is 180° (turned away, and
   * hidden by the opacity step), and at the end of a turn it is 360° ≡ 0°, square
   * to the viewer exactly as the front rests.
   *
   * It has to be on this child rather than folded into the parent's animated
   * angle, because the parent is the one axis both faces share — adding 180
   * there would turn the front as well and simply move the mirror.
   */
  back: { position: 'absolute', top: 0, transform: [{ rotateY: '180deg' }] },
  /* The back is the same shell, so it casts the same shadow. Values match
     `game-case.tsx` exactly — a lighter shadow would read as a different,
     flimsier object halfway through the turn. Split from the face itself
     because Android clips elevation under `overflow: 'hidden'`. */
  shadow: {
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 6, height: 12 },
    elevation: 12,
  },
});
