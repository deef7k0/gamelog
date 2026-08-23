import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type PressableProps, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Motion } from '@/constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  /** How far to shrink while held. Lower = more pronounced. */
  scaleTo?: number;
};

/**
 * How far the control dims while held, when it may not move.
 *
 * The reduced-motion substitute for the sink. Deep enough to be unmistakable on
 * a near-black page, shallow enough that a held button still reads as a button
 * rather than as a disabled one — `Button` already uses 0.45 for disabled, so
 * this deliberately stops short of it.
 */
const PRESSED_OPACITY = 0.62;

/**
 * A Pressable that gently sinks while held.
 *
 * Runs on the UI thread via Reanimated, so the animation stays smooth even
 * while the JS thread is busy rendering a list — which is exactly when a feed
 * would otherwise feel janky.
 *
 * ## Under Reduce Motion it dims instead of sinking
 *
 * This is the most-used animation in the app — every button, tab, chip, poster
 * and row goes through it — and it was the largest single gap in a claim
 * PRODUCT.md makes: *"motion respects the reduced-motion setting."*
 *
 * **It is not switched off, and that distinction is the whole point.** A scale
 * is spatial movement, which is what the setting asks to be spared; but the
 * press feedback it carries is the only confirmation that a tap registered at
 * all, and removing it would answer an accessibility preference by deleting an
 * accessibility affordance. So the *material* changes and the *meaning* stays:
 * opacity instead of translation, which is exactly the crossfade substitution
 * both platform references prescribe.
 */
export function PressableScale({
  children,
  style,
  scaleTo = Motion.pressScale,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const reduceMotion = useReducedMotion();

  /* One value, two materials. `progress` is 0 at rest and 1 while held, so the
     press timing is identical whichever property expresses it — and switching
     between them cannot desynchronise, because there is only one thing moving. */
  const progress = useSharedValue(0);

  /*
   * The caller's own opacity, composed rather than overwritten.
   *
   * `opacity` is not a free channel on this component: `<Button>` and
   * `<IconButton>` both express *disabled* by flattening `{ opacity: 0.45 }`
   * into the style they hand down, and the game page's action row dims the same
   * way while a write is in flight. An animated `opacity` on the root wins over
   * every one of them, so writing a bare `1` here at rest would have made every
   * disabled control in the app look enabled — but only for the people who
   * asked for reduced motion, which is the worst possible audience for it.
   *
   * Flattened in JS, where the style prop actually is, and multiplied in the
   * worklet. A disabled control therefore rests at the caller's value and still
   * dims further if it is somehow pressed.
   */
  const baseOpacity = StyleSheet.flatten(style)?.opacity ?? 1;

  // `.get()`/`.set()` rather than `.value` — the React Compiler lint rules treat
  // assigning to `.value` as mutating a captured binding. Reanimated added these
  // accessors for exactly this reason; they behave identically.
  const animatedStyle = useAnimatedStyle(() => {
    const held = progress.get();
    return reduceMotion
      ? { opacity: Number(baseOpacity) * (1 - held * (1 - PRESSED_OPACITY)) }
      : { transform: [{ scale: 1 - held * (1 - scaleTo) }] };
  });

  return (
    <AnimatedPressable
      style={[style, animatedStyle]}
      onPressIn={(event) => {
        progress.set(withTiming(1, { duration: Motion.fast }));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        progress.set(withTiming(0, { duration: Motion.normal }));
        onPressOut?.(event);
      }}
      {...rest}>
      {children}
    </AnimatedPressable>
  );
}
