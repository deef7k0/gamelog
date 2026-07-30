import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Motion } from '@/constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  /** How far to shrink while held. Lower = more pronounced. */
  scaleTo?: number;
};

/**
 * A Pressable that gently sinks while held.
 *
 * Runs on the UI thread via Reanimated, so the animation stays smooth even
 * while the JS thread is busy rendering a list — which is exactly when a feed
 * would otherwise feel janky.
 */
export function PressableScale({
  children,
  style,
  scaleTo = Motion.pressScale,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);

  // `.get()`/`.set()` rather than `.value` — the React Compiler lint rules treat
  // assigning to `.value` as mutating a captured binding. Reanimated added these
  // accessors for exactly this reason; they behave identically.
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  return (
    <AnimatedPressable
      style={[style, animatedStyle]}
      onPressIn={(event) => {
        scale.set(withTiming(scaleTo, { duration: Motion.fast }));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.set(withTiming(1, { duration: Motion.normal }));
        onPressOut?.(event);
      }}
      {...rest}>
      {children}
    </AnimatedPressable>
  );
}
