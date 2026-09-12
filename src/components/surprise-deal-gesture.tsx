import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { Platform } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  Easing,
  runOnJS,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { ARRIVAL_CONTROL, ARRIVAL_OBJECT } from '@/hooks/use-arrival';

/** Which way the deck moved. `1` = on to the next, `-1` = back to the last one. */
export type DealDirection = 1 | -1;

/** Horizontal travel before the drag takes over, so a tap still reads as a tap. */
const ACTIVATE_AT = 10;

/** A flick counts even when it has not travelled far. dp per second. */
const COMMIT_VELOCITY = 620;

/**
 * Resistance applied to a swipe with nothing behind it.
 *
 * The card still moves — a gesture that does nothing at all reads as a dead
 * screen rather than as an edge — but it moves a third as far and never commits,
 * which is the language the platform's own scroll views use at the end of a list.
 */
const RUBBER_BAND = 0.32;

export type DealGesture = ReturnType<typeof Gesture.Pan>;

export type UseDealGestureOptions = {
  /**
   * Which way this zone deals, and therefore which way it accepts a drag.
   *
   * `1` is the next game and only recognises a drag to the **left**; `-1` is the
   * previous one and only recognises a drag to the **right**. A zone that
   * accepted both would fight the other one for the same touch and would let a
   * drag begun on the left edge deal forward, which is the opposite of what the
   * hand just did.
   */
  direction: DealDirection;
  dealX: SharedValue<number>;
  bloom: SharedValue<number>;
  /** Travel in dp at which releasing deals. */
  commitAt: number;
  /** How far the card flies before it is let go. */
  exitDistance: number;
  /** False at the start of the deck: the back swipe rubber-bands instead. */
  canGoBack: boolean;
  onDeal: (direction: DealDirection) => void;
};

/**
 * The deal, as a gesture. **One per zone — never share the instance.**
 *
 * An RNGH gesture object carries recogniser state, so attaching a single one to
 * two `<GestureDetector>`s does not give you two recognisers: the second mount
 * wins the object and the first side goes dead. That is exactly what happened
 * here, and the symptom is precise — the swipe worked on one edge and nowhere
 * else. Each zone builds its own.
 *
 * Lives apart from both the card and the light because it belongs to neither:
 * the screen owns `dealX`, the edges own the touch area, and the card only
 * *reads* the result. Keeping it here is what let the gesture move off the
 * artwork without the card's animation changing at all.
 */
export function useDealGesture({
  direction,
  dealX,
  bloom,
  commitAt,
  exitDistance,
  canGoBack,
  onDeal,
}: UseDealGestureOptions): DealGesture {
  const reduceMotion = useReducedMotion();

  /** Latches so the threshold tick fires once per crossing, not once per frame. */
  const armed = useSharedValue(false);

  const tick = useCallback(() => {
    if (Platform.OS === 'ios') Haptics.selectionAsync().catch(() => {});
  }, []);

  const commit = useCallback(
    (direction: DealDirection) => {
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      onDeal(direction);
    },
    [onDeal]
  );

  /* Nothing behind you: the back zone still moves the card, but never commits. */
  const blocked = direction === -1 && !canGoBack;
  /* The card travels away from the finger's start, so forward is negative. */
  const sign = direction === 1 ? -1 : 1;

  return (
    Gesture.Pan()
      /*
       * One-sided, and that is the whole point of a directional zone: the right
       * edge recognises only a drag to the left, the left edge only a drag to
       * the right. A single number rather than a pair is how RNGH expresses
       * that — a pair would arm this zone for both, and then a drag begun on the
       * left edge could deal forward, which is the opposite of what the hand did.
       *
       * Deliberately **no `failOffsetY`**: nothing on this screen scrolls, so
       * there is no vertical gesture to yield to, and an 18dp cancel band was
       * rejecting most real thumb swipes.
       */
      .activeOffsetX(sign * ACTIVATE_AT)
      .onUpdate((event) => {
        'worklet';
        /* Clamped to this zone's own direction. Without it, dragging back past
           the start would carry the card the *other* way and light the opposite
           edge — one gesture quietly doing both jobs. */
        const travel =
          sign === -1 ? Math.min(0, event.translationX) : Math.max(0, event.translationX);
        const next = blocked ? travel * RUBBER_BAND : travel;
        dealX.set(next);

        const past = Math.abs(next) > commitAt && !blocked;
        if (past !== armed.get()) {
          armed.set(past);
          bloom.set(withSpring(past ? 1 : 0, ARRIVAL_CONTROL));
          if (past) runOnJS(tick)();
        }
      })
      .onEnd((event) => {
        'worklet';
        const travel =
          sign === -1 ? Math.min(0, event.translationX) : Math.max(0, event.translationX);
        const travelled = Math.abs(travel) > commitAt;
        /* Velocity has to agree with the direction, or a flick back toward the
           edge you started from would deal the card you were refusing. */
        const flicked = event.velocityX * sign > COMMIT_VELOCITY;

        armed.set(false);
        bloom.set(withSpring(0, ARRIVAL_CONTROL));

        if (blocked || !(travelled || flicked)) {
          dealX.set(withSpring(0, ARRIVAL_OBJECT));
          return;
        }

        if (reduceMotion) {
          /* No flight. The card is replaced and the incoming one fades in, which
             is the crossfade both platform references prescribe here. */
          dealX.set(0);
          runOnJS(commit)(direction);
          return;
        }

        dealX.set(
          withTiming(
            sign * exitDistance,
            /* Leaves faster than it arrived, and decelerates rather than easing
               out of a bounce: the card is leaving the hand, not settling. */
            { duration: 200, easing: Easing.out(Easing.cubic) },
            (finished) => {
              'worklet';
              if (finished) runOnJS(commit)(direction);
            }
          )
        );
      })
  );
}

/*
 * `<SwipeZone>` is gone, and the reason is worth keeping.
 *
 * It was a pair of absolutely-positioned strips laid *over* the content, each
 * running from `EDGE_INSET` (28dp, to clear iOS's interactive pop and Android's
 * predictive Back) in to where the cover began, and floored above the controls
 * so it could not swallow them. Three constraints, and together they put the
 * gesture in two narrow columns in the upper middle of the display — you had to
 * find it, at a specific height, at a specific distance from the bezel.
 *
 * The screen attaches `Gesture.Race(next, previous)` to its own container
 * instead. There is no geometry to get wrong: the drag starts anywhere,
 * including the literal edge and including on top of the artwork and the cards.
 * It does not eat taps either, because both gestures wait for `ACTIVATE_AT` of
 * horizontal travel before activating — a press that does not move still reaches
 * the control under it.
 *
 * The cost is that the outermost band is no longer reserved for the OS. On iOS a
 * drag to the right from the left edge is also the interactive back gesture, so
 * the two can contend there; the app's own `Another game` / bookmark controls and
 * the accessibility actions all still work regardless. If that contention turns
 * out to be a problem in the hand, the fix is `gestureEnabled: false` on this
 * route rather than putting the inset back.
 */
