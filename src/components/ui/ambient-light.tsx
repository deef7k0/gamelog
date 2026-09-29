import { Canvas, RadialGradient, Rect, vec } from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';

import { Palette } from '@/constants/theme';

/**
 * The light's centre and reach, as fractions of the viewport.
 *
 * **In the top-left corner, where Home's corner glow used to be** — a fifth of
 * the way across and 5% down, about (78, 42) on a 390 × 844 phone, against that
 * glow's (80, 20). The owner's brief: the left of the screen lit, the right not
 * reached. It was centred at half the width for one pass, and lit both sides
 * evenly.
 *
 * A horizontal reach of 78% of the width is what keeps the right side dark: at
 * the centre's own height the light reaches zero just short of the right edge,
 * and with the falloff below it is under a quarter strength past two thirds of
 * the way across — the right quarter of the screen is effectively unlit. Half
 * the height downward, so it pools down the left side and is gone by about
 * 40% of the display. Fractions rather than dp, so a 360dp phone and a wide one
 * are lit the same way.
 */
const AMBIENT_LIGHT = {
  centerX: 0.2,
  centerY: 0.05,
  radiusX: 0.78,
  radiusY: 0.5,
} as const;

/**
 * Brightest point, as an alpha of `Palette.glowCore` over the page.
 *
 * 0.42, raised from 0.18 at the owner's request: the corner should read as lit,
 * not merely warmer. It lands close to the brightness of the reference's own
 * top light (SimpMusic's Listen Together, #3D384C at its brightest) —
 * composited over Home's `#14171c` floor this peaks at #392D51, 1.43:1 against
 * the page, and over black at #2D2041.
 *
 * **What this costs, stated plainly:** `textMuted` falls to 3.89:1 on the very
 * brightest pixel, under AA. The one muted line that sits there — Home's
 * greeting — was stepped up to `textSecondary` for it (5.29:1); `text` holds at
 * 11.55:1. Anything muted placed in Home's top-left corner later needs the
 * same step.
 */
const PEAK = 0.42;

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
 * A very large, very soft light in the top-left corner of a screen — felt
 * before it is seen. Home's background, and nothing else.
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
