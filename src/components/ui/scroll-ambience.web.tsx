import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { Palette } from '@/constants/theme';

import type { ScrollAmbienceProps } from './scroll-ambience';

/**
 * `<ScrollAmbience>` for the web, without Skia.
 *
 * Metro resolves `.web.tsx` first, so the browser never imports Skia and the web
 * bundle never pulls in CanvasKit — the same split `soft-glow.web.tsx` makes,
 * and for the same reason: a multi-megabyte WASM download before first paint is
 * not a price a background gradient gets to charge.
 *
 * ## Different technique, same result
 *
 * The native version interpolates the gradient's colour *stops* as you scroll.
 * That needs a renderer that can rebuild a shader per frame, which CSS cannot do.
 *
 * So this stacks two fixed layers instead — the lit gradient over the page
 * colour — and animates the top one's **opacity** from 1 to 0 across the same
 * scroll distance. Cross-fading between the two end states produces very nearly
 * the same path through colour space as interpolating the stops, and opacity is
 * the one property react-native-web animates entirely on the compositor. The
 * effect reads identically; only the maths differs.
 */
export const ScrollAmbience = memo(function ScrollAmbience({
  scrollY,
  distance,
  palette,
  opacity = 1,
}: ScrollAmbienceProps) {
  const lit = palette ?? FALLBACK;

  const backgroundImage = useMemo(
    // Stop positions match the native `STOP_POSITIONS`; 135deg is CSS for
    // top-left → bottom-right, matching `vec(0,0)` → `vec(width,height)`.
    () => `linear-gradient(135deg, ${lit[0]} 0%, ${lit[1]} 55%, ${lit[2]} 100%)`,
    [lit]
  );

  const fade = useAnimatedStyle(() => {
    'worklet';
    const span = distance.get();
    const progress = span > 0 ? Math.min(1, Math.max(0, scrollY.get() / span)) : 0;
    return { opacity: (1 - progress) * opacity };
  });

  return (
    <View pointerEvents="none" style={styles.base}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundImage }, fade]} />
    </View>
  );
});

const FALLBACK: readonly [string, string, string] = [
  Palette.glowEdge,
  '#231733',
  Palette.background,
];

const styles = StyleSheet.create({
  /* The floor the lit layer fades away to reveal — the ordinary page colour, so
     a fully scrolled page on the web is identical to one on a device.
     Offsets written out: `absoluteFillObject` is gone from the RN 0.86 types. */
  base: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Palette.background,
  },
});
