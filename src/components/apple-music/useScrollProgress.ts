/**
 * useScrollProgress.ts
 *
 * Custom hook providing UI-thread scroll synchronization and normalized scroll progress.
 * Runs 100% on Reanimated worklets — zero JS thread traffic during scrolling.
 */

import {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import type { NativeScrollEvent } from 'react-native';

export type ScrollProgressResult = {
  /** Raw vertical scroll offset in dp */
  scrollY: SharedValue<number>;
  /** Normalized scroll progress from 0 (top) to 1 (when scrolled past heroHeight) */
  scrollProgress: SharedValue<number>;
  /** Sticky frosted nav bar opacity from 0 (heroHeight * 0.5) to 1 (heroHeight) */
  navBarOpacity: SharedValue<number>;
  /** Whether the user has scrolled beyond the hero section */
  isScrolledPastHero: SharedValue<boolean>;
  /** Worklet scroll handler to pass directly to Animated.ScrollView's onScroll */
  onScroll: ReturnType<typeof useAnimatedScrollHandler>;
};

export type UseScrollProgressOptions = {
  /** Optional custom scroll threshold for the sticky nav bar appearance (default: heroHeight * 0.5) */
  navBarThreshold?: number;
  /** Optional callback invoked on the UI thread when scrolling */
  onScrollWorklet?: (event: NativeScrollEvent) => void;
};

/**
 * Returns animated scroll values for Apple Music hero transitions.
 *
 * @param heroHeight - The pixel/dp height of the top hero section
 * @param options - Additional thresholds or worklet hooks
 */
export function useScrollProgress(
  heroHeight: number,
  options?: UseScrollProgressOptions
): ScrollProgressResult {
  const scrollY = useSharedValue(0);
  const navThreshold = options?.navBarThreshold ?? heroHeight * 0.5;

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet';
      scrollY.value = event.contentOffset.y;
      if (options?.onScrollWorklet) {
        options.onScrollWorklet(event);
      }
    },
  });

  const scrollProgress = useDerivedValue(() => {
    'worklet';
    return interpolate(scrollY.value, [0, heroHeight], [0, 1], Extrapolation.CLAMP);
  });

  const navBarOpacity = useDerivedValue(() => {
    'worklet';
    return interpolate(scrollY.value, [navThreshold, heroHeight], [0, 1], Extrapolation.CLAMP);
  });

  const isScrolledPastHero = useDerivedValue(() => {
    'worklet';
    return scrollY.value >= heroHeight;
  });

  return {
    scrollY,
    scrollProgress,
    navBarOpacity,
    isScrolledPastHero,
    onScroll,
  };
}
