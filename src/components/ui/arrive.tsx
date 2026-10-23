import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

/**
 * A band that has just loaded, arriving — SimpMusic's
 * `AnimatedVisibility(visible = …, enter = fadeIn() + expandVertically())`,
 * which is how every part of its Home and its lists appears once its data is
 * in (`HomeScreen.kt`). The owner's direction (2026-10-22): "animations of
 * things arriving on screen too. The smoothness of it."
 *
 * Compose's `AnimationConstants.DefaultDurationMillis` is 300, which is what
 * both its `fadeIn()` and the `Crossfade` round its shimmer run at.
 *
 * ## Why this is a fade in and not the reference's cross-dissolve
 *
 * SimpMusic swaps its whole page under a `Crossfade`, where both states are
 * full-page and overlapping them costs nothing. A band here is one item in a
 * column, and Reanimated keeps an *exiting* view mounted until its animation
 * ends — so cross-dissolving a skeleton with the content that replaces it
 * would hold both in the column for 300ms and shove everything below down a
 * band's height and back. The content takes the skeleton's place in the same
 * frame instead and rises into it, which is the same picture without the
 * jump. It costs nothing to get wrong, either: there is no resting pose to
 * lose (§ Gotchas), because the pose React holds is the plain one.
 *
 * It also only works because of a rule this app already keeps — a skeleton is
 * the shape and height of what is coming. Where that is true the swap is
 * invisible and this is the only motion in it.
 *
 * Still under Reduce Motion, where the content is simply there.
 */

/** `AnimationConstants.DefaultDurationMillis`. */
export const ARRIVE_MS = 300;

export type ArriveProps = {
  children: ReactNode;
  /**
   * What this is the arrival *of*. Changing it plays the fade again — pass the
   * thing whose identity makes the content new (a feed's id, a period), and
   * leave it out for something that arrives once.
   */
  of?: string | number;
  /** Held back by this much, for a stack of bands that should not all land together. */
  delay?: number;
  style?: StyleProp<ViewStyle>;
};

export function Arrive({ children, of, delay = 0, style }: ArriveProps) {
  const reduceMotion = useReducedMotion();

  return (
    <Animated.View
      key={of}
      entering={reduceMotion ? undefined : FadeIn.duration(ARRIVE_MS).delay(delay)}
      style={style}>
      {children}
    </Animated.View>
  );
}

/**
 * How long each of a run of bands waits before it arrives, so a page fills
 * from the top rather than all at once.
 *
 * A third of the fade, the reference's own feel for a list whose items arrive
 * together: short enough that nothing reads as late, long enough to be a
 * sequence. Capped, so the tenth band is not held back by a second.
 */
export const STAGGER_MS = 100;
export const STAGGER_CAP = 4;

export function stagger(index: number): number {
  return Math.min(index, STAGGER_CAP) * STAGGER_MS;
}
