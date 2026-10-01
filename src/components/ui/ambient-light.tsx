import { memo, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { Palette, withAlpha } from '@/constants/theme';

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
const CENTER_X = 0.2;
const CENTER_Y = 0.05;
const RADIUS_X = 0.78;
const RADIUS_Y = 0.5;

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
 * The last stop is `glowCore` at zero alpha, never transparent black — Android
 * interpolates gradients unpremultiplied (CLAUDE.md).
 */
const STOPS = Array.from({ length: 11 }, (_, index) => index / 10)
  .map((t) => `${withAlpha(Palette.glowCore, PEAK * (1 - t * t) ** 3)} ${t * 100}%`)
  .join(', ');

/** One decimal is a tenth of a dp — finer than any pixel this lands on. */
const px = (value: number) => `${Math.round(value * 10) / 10}px`;

/**
 * A very large, very soft light in the top-left corner of a screen — felt
 * before it is seen. Home's background, and nothing else.
 *
 * One view the size of the viewport, filled with an elliptical radial gradient
 * (`experimental_backgroundImage`, which React Native draws natively on the New
 * Architecture). It is not a shape with a gradient in it, so there is no
 * outline anywhere for the eye to find — only the falloff, which reaches zero
 * with no slope.
 *
 * ## No Skia
 *
 * This was a Skia `<Canvas>` — a full-screen GPU surface of its own, behind
 * Home's scroll, for one gradient — and Skia's native library is 8–15 MB per
 * CPU architecture in every APK. A view's background is drawn into the view's
 * own display list once and composited with everything else.
 *
 * What it gave up is Skia's `dither`. The ramp spans a few dozen steps of 8-bit
 * colour across a third of the screen, and undithered it can show faint rings
 * on some panels; the eleven-stop falloff keeps each step's band narrow and
 * soft-edged, which is most of what dithering bought. If rings ever show, the
 * fix is a dithered bitmap of this light, not Skia back.
 *
 * Fixed to the viewport, behind everything, inert: it belongs in
 * `<Screen backdrop>`, where it neither scrolls with the content nor takes
 * touches.
 */
export const AmbientLight = memo(function AmbientLight() {
  const { width, height } = useWindowDimensions();

  const backgroundImage = useMemo(
    () =>
      `radial-gradient(${px(width * RADIUS_X)} ${px(height * RADIUS_Y)} at ${px(width * CENTER_X)} ${px(height * CENTER_Y)}, ${STOPS})`,
    [width, height]
  );

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { experimental_backgroundImage: backgroundImage }]}
    />
  );
});
