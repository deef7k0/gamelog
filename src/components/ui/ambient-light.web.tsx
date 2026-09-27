import { memo, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { Palette, withAlpha } from '@/constants/theme';

/*
 * The browser's copy of `ambient-light.tsx`, as a CSS radial gradient — Skia on
 * the web needs CanvasKit, a multi-megabyte download, for one background (see
 * CLAUDE.md, and `soft-glow.web.tsx`, which does the same). Same centre, same
 * radii, same eleven-stop falloff, so the two platforms light the page alike.
 *
 * The constants are restated rather than imported: importing the native file
 * would pull Skia into the web bundle, which is the whole thing this avoids.
 */
const CENTER_X = 0.5;
const CENTER_Y = 0.18;
const RADIUS_X = 0.9;
const RADIUS_Y = 0.55;
const PEAK = 0.16;

const STOPS = Array.from({ length: 11 }, (_, index) => index / 10);

export const AmbientLight = memo(function AmbientLight() {
  const { width, height } = useWindowDimensions();

  const backgroundImage = useMemo(() => {
    const stops = STOPS.map((t) => {
      const strength = PEAK * (1 - t * t) ** 3;
      return `${withAlpha(Palette.glowCore, strength)} ${t * 100}%`;
    }).join(', ');
    return `radial-gradient(${width * RADIUS_X}px ${height * RADIUS_Y}px at ${width * CENTER_X}px ${height * CENTER_Y}px, ${stops})`;
  }, [width, height]);

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { experimental_backgroundImage: backgroundImage }]}
    />
  );
});
