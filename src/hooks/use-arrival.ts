import { useEffect, useState } from 'react';
import {
  runOnJS,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  type SharedValue,
  type WithSpringConfig,
} from 'react-native-reanimated';

/**
 * One thing landing into place, once, on arrival.
 *
 * Returns 0 on mount and springs to 1. What that drives is the caller's
 * business — the case falls and over-turns, a button drops and settles — but the
 * *timing* comes from here so a screen's separate pieces read as one arrival
 * instead of several unrelated entrances.
 *
 * That distinction is the whole reason this is a hook rather than a few lines
 * inlined twice. The craft floor allows a page one authored focal moment and
 * forbids the same entrance replayed on every section; a shared clock with a
 * stagger is the first of those, and two components each animating themselves on
 * their own schedule is the second.
 *
 * **Reduce Motion starts landed.** The value is seeded at 1 and the effect never
 * runs, so the interface is simply present. Arrival is pure spatial movement
 * with nothing to communicate once it is over — unlike press feedback, which
 * `<PressableScale>` keeps as opacity precisely because removing it would cost
 * an affordance.
 */

/**
 * A physical object settling — the game case.
 *
 * Damped just under critical for a single shallow overshoot. Heavier and looser
 * than `ARRIVAL_CONTROL`, which is the point: the case is the one depicted
 * object on the page and it should land harder than the interface around it.
 */
export const ARRIVAL_OBJECT: WithSpringConfig = { damping: 14, stiffness: 110, mass: 0.9 };

/**
 * A control clicking into place — the action row, the primary button.
 *
 * Lighter and stiffer, so it arrives after the case and settles before it. A
 * button that wallowed like the case would claim to weigh as much as it.
 */
export const ARRIVAL_CONTROL: WithSpringConfig = { damping: 15, stiffness: 130, mass: 0.7 };

/**
 * @param delay Milliseconds before this piece starts, for staggering a group.
 * @param spring Must be a stable reference — a module constant, not an inline
 *   object literal, which would re-run the effect on every render.
 */
export function useArrival(
  delay = 0,
  spring: WithSpringConfig = ARRIVAL_OBJECT
): SharedValue<number> {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) return;
    progress.set(withDelay(delay, withSpring(1, spring)));
  }, [delay, progress, reduceMotion, spring]);

  return progress;
}

/**
 * `useArrival`, plus whether it has finished — as React state.
 *
 * ## Why a caller needs to know, and what goes wrong without it
 *
 * Reanimated holds an animated style's *first-render* value as the view's
 * React props, forever: `PropsFilter` snapshots it once, on the component's
 * first render. Everything after that lives in Reanimated's props registry and
 * is applied over React's props on each commit. In 4.x a settled animation's
 * values are meant to be handed back to React (`FORCE_REACT_RENDER_FOR_SETTLED_
 * ANIMATIONS`) — but the hand-back is a JS `setInterval`, and the native side
 * deletes registry entries more than two seconds old *before* it returns those
 * more than one second old. So if the JS thread stalls for over a second while
 * an arrival settles — the game page does exactly that, landing a dozen queries
 * and decoding a cover's colour on the JS thread — the final value is dropped
 * without ever reaching React, and the next re-render puts the view back at its
 * first frame: a button at opacity 0, a case still tilted mid-fall.
 *
 * `landed` flips when the spring finishes, so the caller can add the landed
 * pose as a plain style after the animated one. React then holds the end state
 * itself, and losing the registry entry costs nothing. Callers that never
 * re-render after arriving can keep using `useArrival`.
 */
export function useLandingArrival(
  delay = 0,
  spring: WithSpringConfig = ARRIVAL_OBJECT
): { progress: SharedValue<number>; landed: boolean } {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  const [landed, setLanded] = useState(reduceMotion);

  useEffect(() => {
    if (reduceMotion) return;
    progress.set(
      withDelay(
        delay,
        withSpring(1, spring, (finished) => {
          if (finished) runOnJS(setLanded)(true);
        })
      )
    );
  }, [delay, progress, reduceMotion, spring]);

  return { progress, landed };
}
