import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { Platform } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  runOnJS,
  useReducedMotion,
  useSharedValue,
  withSpring,
  type SharedValue,
  type WithSpringConfig,
} from 'react-native-reanimated';

import { ARRIVAL_CONTROL } from '@/hooks/use-arrival';

/** Which way the deck moved. `1` = on to the next, `-1` = back to the last one. */
export type DealDirection = 1 | -1;

/** Horizontal travel before the drag takes over, so a tap still reads as a tap. */
const ACTIVATE_AT = 10;

/** A flick counts even when it has not travelled far. dp per second. */
const COMMIT_VELOCITY = 620;

/**
 * Resistance applied to a swipe with nothing behind it.
 *
 * The page still moves — a gesture that does nothing at all reads as a dead
 * screen rather than as an edge — but a third as far, and it never commits,
 * which is the language the platform's own scroll views use at the end of a
 * list.
 */
const RUBBER_BAND = 0.32;

/**
 * How a page settles: Compose's pager default, which SimpMusic's now playing
 * artwork pager uses as it is (`HorizontalPager`, `PagerDefaults.flingBehavior`
 * — `spring(stiffness = StiffnessMediumLow)`, no bounce). 400 and the damping
 * that makes it critical at a mass of one: it arrives without overshooting,
 * carrying the finger's speed in.
 */
export const PAGER_SPRING: WithSpringConfig = { stiffness: 400, damping: 40, mass: 1 };

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
  /** The finger's travel in dp — what the edge lights and the room read. */
  dealX: SharedValue<number>;
  bloom: SharedValue<number>;
  /** Where the deck stands, in dp: the card at index n is centred at n × `pageWidth`. */
  pageX: SharedValue<number>;
  /** The card in front's place in the deck — every batch's cards counted. */
  page: number;
  /** One page: the display's width. */
  pageWidth: number;
  /** Travel in dp at which releasing deals. */
  commitAt: number;
  /** False at the start of the deck: the back swipe rubber-bands instead. */
  canGoBack: boolean;
  /** The page has been let go towards the next card; the deck moves on now. */
  onDeal: (direction: DealDirection) => void;
  /** A finger is on the deck, or has let go — prefetching and animation wait. */
  onDragChange: (dragging: boolean) => void;
};

/**
 * The deal, as a pager. **One per zone — never share the instance.**
 *
 * The owner's direction (2026-10-21): "Remove the way the artwork moves as a
 * card out of the screen, just make it a simple slide like SimpMusic when
 * sliding to the next song inside the now playing screen." SimpMusic's is a
 * `HorizontalPager` round the artwork: the page under the finger moves with
 * it one for one, the next one is already beside it, and on release the pager
 * springs to the nearer page — or to the next, past a third of a card or on a
 * flick. No lift, no lean, no turn, no fling off the screen. That is all this
 * does now.
 *
 * - **The deck is one strip** and `pageX` is where it stands: each card is
 *   laid out at its own index times the display's width, and the strip is
 *   moved by `-pageX` on the UI thread. Nothing is reset when a card changes:
 *   the card that slid in is already where the strip stopped.
 * - **A grab mid-slide continues from where the strip is** (`origin`), so a
 *   second swipe on the heels of the first never jumps.
 * - **The deck moves on at the release**, not when the slide ends: the spring
 *   finishes on the UI thread while the title and the cards under it change.
 * - **Under Reduce Motion** the drag still follows the finger — it is an
 *   input — and the release lands at once.
 *
 * An RNGH gesture carries recogniser state, so attaching a single one to two
 * `<GestureDetector>`s gives one recogniser, not two: each zone builds its own.
 */
export function useDealGesture({
  direction,
  dealX,
  bloom,
  pageX,
  page,
  pageWidth,
  commitAt,
  canGoBack,
  onDeal,
  onDragChange,
}: UseDealGestureOptions): DealGesture {
  const reduceMotion = useReducedMotion();

  /** Latches so the threshold tick fires once per crossing, not once per frame. */
  const armed = useSharedValue(false);
  /** Where the strip stood when the finger took it. */
  const origin = useSharedValue(0);

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

  /* Nothing behind you: the back zone still moves the page, but never commits. */
  const blocked = direction === -1 && !canGoBack;
  /* The strip travels away from the finger's start, so forward is negative. */
  const sign = direction === 1 ? -1 : 1;
  const home = page * pageWidth;

  return (
    Gesture.Pan()
      /*
       * One-sided, and that is the whole point of a directional zone: one
       * number rather than a pair arms this zone for its own direction only.
       * Deliberately **no `failOffsetY`**: nothing on this screen scrolls.
       */
      .activeOffsetX(sign * ACTIVATE_AT)
      .onStart(() => {
        'worklet';
        origin.set(pageX.get());
        runOnJS(onDragChange)(true);
      })
      .onUpdate((event) => {
        'worklet';
        /* Clamped to this zone's own direction: dragging back past the start
           must not carry the page the other way. */
        const travel =
          sign === -1 ? Math.min(0, event.translationX) : Math.max(0, event.translationX);
        const next = blocked ? travel * RUBBER_BAND : travel;
        dealX.set(next);
        pageX.set(origin.get() - next);

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
        dealX.set(withSpring(0, ARRIVAL_CONTROL));

        if (blocked || !(travelled || flicked)) {
          pageX.set(withSpring(home, { ...PAGER_SPRING, velocity: -event.velocityX }));
          return;
        }

        const target = home + direction * pageWidth;
        pageX.set(
          reduceMotion
            ? target
            : withSpring(target, { ...PAGER_SPRING, velocity: -event.velocityX })
        );
        runOnJS(commit)(direction);
      })
      .onFinalize(() => {
        'worklet';
        runOnJS(onDragChange)(false);
      })
  );
}
