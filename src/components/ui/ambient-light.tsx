import { Canvas, RadialGradient, Rect, vec } from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';

import { Palette } from '@/constants/theme';

/**
 * The light's centre and reach, as fractions of the viewport.
 *
 * Centre at half the width and 18% of the height — near the top, never the
 * middle. Radii of 90% of the width and 55% of the height, so the field is
 * wider than it is tall (about 180% × 110% of the screen) and runs out a little
 * past the middle of the display. Fractions rather than dp, so a 360dp phone and
 * a tall 20:9 one are lit the same way.
 */
const AMBIENT_LIGHT = {
  centerX: 0.5,
  centerY: 0.18,
  radiusX: 0.9,
  radiusY: 0.55,
} as const;

/**
 * Brightest point, as an alpha of `Palette.glowCore` over the page.
 *
 * Composited over `background` (#14171b) this peaks at about #22202F — 1.12:1
 * against the page, which is "the top feels lit" rather than "there is a
 * gradient". `textMuted` still clears 4.9:1 on the brightest pixel.
 */
const PEAK = 0.16;

/**
 * The falloff: `(1 - t²)³`, sampled at eleven stops.
 *
 * A curve whose slope reaches zero at the rim, which is what makes the edge
 * unfindable — a linear or two-stop ramp ends on a corner, and a dark page shows
 * the second derivative of a gradient long before it shows the gradient. At 20%
 * of the radius it is still 88% strength, at 40% 59%, at 60% 26%, at 80% 5%.
 *
 * Module scope so Skia never sees a changed array.
 */
const AMBIENT_STOPS = Array.from({ length: 11 }, (_, index) => index / 10);
const AMBIENT_FALLOFF = AMBIENT_STOPS.map((t) => (1 - t * t) ** 3);

const COLORS = AMBIENT_FALLOFF.map((strength, index) =>
  index === AMBIENT_FALLOFF.length - 1 ? '#00000000' : hexAlpha(Palette.glowCore, strength)
);

/**
 * A very large, very soft light above the top of a screen — felt before it is
 * seen. Home's background, and nothing else.
 *
 * One rect the size of the viewport, filled with an elliptical radial gradient:
 * a circle of radius `radiusX`, squashed vertically by the gradient's own
 * transform to `radiusY`. It is not a shape with a gradient in it, so there is
 * no outline anywhere for the eye to find — only the falloff, which reaches zero
 * with no slope (`AMBIENT_FALLOFF`).
 *
 * `dither` is load-bearing: the whole ramp spans a few steps of 8-bit colour on
 * a near-black page, and undithered it bands into visible rings.
 *
 * Fixed to the viewport, behind everything, inert: it belongs in
 * `<Screen backdrop>`, where it neither scrolls with the content nor takes
 * touches.
 */
export const AmbientLight = memo(function AmbientLight() {
  const { width, height } = useWindowDimensions();

  const cx = width * AMBIENT_LIGHT.centerX;
  const cy = height * AMBIENT_LIGHT.centerY;
  const rx = width * AMBIENT_LIGHT.radiusX;
  const ry = height * AMBIENT_LIGHT.radiusY;

  const center = useMemo(() => vec(cx, cy), [cx, cy]);
  const squash = useMemo(() => [{ scaleY: ry / rx }], [rx, ry]);

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Rect x={0} y={0} width={width} height={height} opacity={PEAK} dither>
        <RadialGradient
          c={center}
          r={rx}
          colors={COLORS}
          positions={AMBIENT_STOPS}
          origin={center}
          transform={squash}
        />
      </Rect>
    </Canvas>
  );
});

/** `'#6B4C9A'` + 0.5 → `'#6B4C9A80'`. */
function hexAlpha(color: string, alpha: number): string {
  const channel = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${color}${channel}`;
}
