import {
  Canvas,
  LinearGradient,
  Rect,
  interpolateColors,
  vec,
  type Color,
} from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { Palette } from '@/constants/theme';

/**
 * The page background, as a diagonal gradient that darkens as you scroll.
 *
 * Replaces the flat `#121212` on a game's own screen. Three stops run from the
 * top-left corner to the bottom-right, in the colour read out of that game's box
 * art, and the whole ramp descends toward the page colour as the scroll position
 * advances — so the top of the page is lit and the bottom of a long page is the
 * ordinary dark room. Scrolling back up reverses it exactly, because the
 * gradient is a pure function of scroll offset and nothing is animating on its
 * own.
 *
 * ## Where the colours come from
 *
 * From `lib/artwork-color.ts`, which decodes the cover's 90×90 thumbnail in pure
 * JavaScript and returns one dominant hue at three depths.
 *
 * **Not `react-native-image-colors`.** That is the usual answer and it is a
 * native module, so it needs a development build — this project runs in Expo Go
 * (PRODUCT.md records that as a hard constraint), where installing it would stop
 * the app launching at all. The pure-JS path costs one 3 KB fetch and a decode
 * of ~8,100 pixels, is cached in `AsyncStorage` per cover, and works unchanged
 * on iOS, Android and the web.
 *
 * ## Performance
 *
 * **All animation state stays on the UI thread — no `setState` per frame.**
 * `scrollY` and `distance` arrive as `SharedValue`s and are read with `.get()`
 * inside a worklet; the derived colour array is handed to Skia as a
 * `SharedValue`, so scrolling never crosses back into JS and never re-renders
 * this component. React sees one render when the extracted palette arrives, and
 * that is all.
 *
 * `distance` is a `SharedValue` rather than the `contentHeight` / `viewportHeight`
 * numbers it is computed from, for the same reason: those are measured with
 * `onContentSizeChange` and `onLayout`, and holding them in React state would
 * re-render the whole game page every time the content grew.
 *
 * ## Troubleshooting
 *
 * - **Background stays the fallback purple.** The extraction returned null.
 *   Expected for a game whose art has no dominant hue, and for legacy `steam:`
 *   rows whose cover URL may 404 — both fall back by design.
 *   `extractArtworkColor` swallows its errors, so check the network, not a
 *   thrown exception.
 * - **Nothing darkens on scroll.** `distance` is 0 or negative, which happens
 *   when the content is shorter than the viewport. The worklet clamps to 0
 *   progress in that case and the page simply stays lit — correct, not a bug.
 * - **Colours never load on the web.** The thumbnail fetch is cross-origin.
 *   IGDB serves permissive CORS headers, but a proxy or a strict CSP in front of
 *   the app will block it; the fallback covers it.
 */
export type ScrollAmbienceProps = {
  /** Live scroll offset in dp, from `useAnimatedScrollHandler`. */
  scrollY: SharedValue<number>;
  /**
   * Scroll distance over which the gradient completes its descent, in dp.
   *
   * Usually `contentHeight - viewportHeight`. A `SharedValue` so measuring it
   * costs no re-render — see the performance note above.
   */
  distance: SharedValue<number>;
  /**
   * The game's three-depth palette, brightest first, from `ArtworkColor`.
   *
   * Omit while the extraction is in flight; the fallback purple stands in and
   * the swap is a single re-render, not a per-frame cost.
   */
  palette?: readonly [string, string, string] | null;
  /** @default 1 */
  opacity?: number;
};

/**
 * Shown until the artwork's colours arrive, and whenever they cannot be read.
 *
 * The house glow colours rather than an arbitrary purple, so a page that never
 * resolves a palette still looks like this app rather than like a placeholder.
 */
const FALLBACK: readonly [string, string, string] = [
  Palette.glowEdge,
  '#231733',
  Palette.background,
];

/** Where the ramp ends up once you have scrolled to the bottom. */
const FLOOR: readonly [string, string, string] = [
  Palette.background,
  Palette.background,
  Palette.background,
];

export const ScrollAmbience = memo(function ScrollAmbience({
  scrollY,
  distance,
  palette,
  opacity = 1,
}: ScrollAmbienceProps) {
  const { width, height } = useWindowDimensions();

  /*
   * Pre-built, outside the worklet.
   *
   * Each of the three gradient stops travels from its lit colour to the page
   * colour, so each needs its own two-entry output range. Building these per
   * frame would allocate nine strings on the UI thread sixty times a second;
   * built here they are captured once and the worklet only reads them.
   */
  const ramps = useMemo<[Color[], Color[], Color[]]>(() => {
    const lit = palette ?? FALLBACK;
    // Mutable arrays: `interpolateColors` takes `Color[]`, and a `readonly`
    // tuple is not assignable to it.
    return [
      [lit[0], FLOOR[0]],
      [lit[1], FLOOR[1]],
      [lit[2], FLOOR[2]],
    ];
  }, [palette]);

  /* Diagonal: top-left to bottom-right. The direction is the whole character of
     the effect — a vertical ramp reads as a header fading out, where the
     diagonal reads as light falling across the page from one corner. */
  const start = useMemo(() => vec(0, 0), []);
  const end = useMemo(() => vec(width, height), [width, height]);

  /* `interpolateColors` returns one colour as an RGBA `number[]`, which is a
     valid member of Skia's `Color` union — so the whole thing is `Color[]`, an
     array of three colours, exactly what `<LinearGradient colors>` wants. */
  const colors = useDerivedValue<Color[]>(() => {
    'worklet';
    const span = distance.get();
    // A page shorter than the viewport has nowhere to descend to; hold at lit.
    const progress = span > 0 ? Math.min(1, Math.max(0, scrollY.get() / span)) : 0;

    return [
      interpolateColors(progress, PROGRESS_RANGE, ramps[0]),
      interpolateColors(progress, PROGRESS_RANGE, ramps[1]),
      interpolateColors(progress, PROGRESS_RANGE, ramps[2]),
    ];
  });

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Rect x={0} y={0} width={width} height={height} opacity={opacity}>
        <LinearGradient start={start} end={end} colors={colors} positions={STOP_POSITIONS} />
      </Rect>
    </Canvas>
  );
});

/** Module scope so the worklet captures one stable array, not a new one a frame. */
const PROGRESS_RANGE = [0, 1];

/**
 * Where the three stops sit along the diagonal.
 *
 * Not evenly spaced. Skia's default puts the middle stop at 0.5, which spends
 * the top half of the screen already descending toward the dark end — the ramp
 * reads as thin rather than as a colour. Pushing it to 0.55 holds the lit colour
 * across more of the visible area, which is most of what "make it more solid"
 * means once the hue itself is saturated.
 *
 * This is the dial to reach for before touching the luminances in
 * `artwork-color.ts`: moving a stop changes how much of the screen is bright,
 * where changing a luminance changes how bright it is — and the luminances are
 * already at the ceiling their contrast budget allows.
 */
const STOP_POSITIONS = [0, 0.55, 1];
