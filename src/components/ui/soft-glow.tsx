import { Blur, Canvas, Circle, RadialGradient, vec } from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { Palette } from '@/constants/theme';

/*
 * Skia is already a dependency and needs no setup here: `@shopify/react-native-skia`
 * 2.6.2 is the exact version Expo Go for SDK 57 bundles, so this renders in Expo
 * Go, in a native build, and on the web through CanvasKit without a config
 * plugin. If it is ever missing, `npx expo install @shopify/react-native-skia`
 * installs the version matched to the SDK — never a bare `npm install`, which
 * will fetch a newer one that Expo Go cannot load.
 */

export type SoftGlowProps = {
  /**
   * Peak opacity at the glow's centre, 0–1.
   *
   * Applied by Skia on the GPU as a paint alpha, so it costs nothing beyond the
   * draw that was happening anyway.
   *
   * @default 0.5
   */
  opacity?: number;
  /**
   * Colour at the centre of the glow.
   *
   * @default Palette.glowCore ('#3A2050')
   */
  color?: string;
  /**
   * Colour at the halfway stop, where the glow is already thinning.
   *
   * @default Palette.glowEdge ('#2D1B3D')
   */
  secondaryColor?: string;
  /**
   * Diameter of the source circle in dp, before the blur widens it.
   *
   * The visible glow is meaningfully larger than this — reckon on
   * `size + blurRadius * 2` when deciding how far it will reach.
   *
   * @default 400
   */
  size?: number;
  /**
   * Gaussian blur radius in dp.
   *
   * This is a real `<Blur>` image filter, not a stack of translucent rings, so
   * the falloff is a true Gaussian with no banding at any radius.
   *
   * @default 80
   */
  blurRadius?: number;
  /**
   * Centre X in dp. Negative pushes the circle off the left edge, which is what
   * removes the last trace of a circular silhouette.
   *
   * @default -100
   */
  offsetX?: number;
  /**
   * Centre Y in dp. Negative pushes the circle above the top edge.
   *
   * @default -100
   */
  offsetY?: number;
};

/**
 * A soft, diffuse radial glow for the corner of a dark screen.
 *
 * Draws one circle filled with a radial gradient and puts a true Gaussian blur
 * over it, positioned so its centre sits *outside* the viewport. Only the outer
 * shoulder of the falloff is ever on screen, which is what makes it read as
 * ambient light rather than as a blurred circle: there is no point on screen
 * where the gradient is at full strength, so there is no shape to find.
 *
 * Three details do the work, and all three matter:
 *
 *  - **`mode="decal"` on the blur.** The tile mode decides what the blur samples
 *    beyond the layer's bounds. `clamp` — the default — repeats the edge pixels
 *    outward and leaves a faint rectangular plateau where the layer ended.
 *    `decal` samples transparent instead, so the falloff genuinely reaches zero.
 *  - **The gradient's last stop is `#00000000`.** Fully transparent *black*, not
 *    a transparent purple: Skia interpolates premultiplied, and ending on a
 *    transparent chromatic colour tints the tail.
 *  - **The centre is off-screen.** See `offsetX` / `offsetY`.
 *
 * Purely decorative and inert — the canvas takes `pointerEvents="none"`, so
 * everything underneath stays tappable.
 *
 * @example
 * ```tsx
 * // The glow goes first so it renders beneath; content follows and sits on top.
 * <View style={{ flex: 1, backgroundColor: theme.background }}>
 *   <SoftGlow size={520} blurRadius={90} offsetX={-40} offsetY={-120} />
 *   <Text variant="display">GameLog</Text>
 * </View>
 * ```
 *
 * ## Performance
 *
 * One circle, one blur, drawn once. After the first render nothing touches the
 * JS thread — there is no animation loop, no shared value and no per-frame
 * allocation. The gradient's vector and colour array are memoised, so a parent
 * re-render reuses them rather than rebuilding Skia objects.
 *
 * **Do not animate `size` or `blurRadius`.** Either one changes the filter's
 * bounds, which forces Skia to re-rasterise the blurred layer every frame — the
 * single most expensive thing this component can be asked to do. `opacity` is
 * safe to animate; it is a paint alpha and does not touch the filter.
 *
 * Wrapped in `React.memo`: with default props it never re-renders at all.
 */
export const SoftGlow = memo(function SoftGlow({
  opacity = 0.5,
  color = Palette.glowCore,
  secondaryColor = Palette.glowEdge,
  size = 400,
  blurRadius = 80,
  offsetX = -100,
  offsetY = -100,
}: SoftGlowProps) {
  const radius = size / 2;

  /* Skia parses CSS colour strings, and `#RRGGBBAA` is the one form with no
     ambiguity about channel order — `rgba()` would work too but reads as a
     web idiom in a file that has no DOM anywhere near it. */
  const colors = useMemo(
    () => [withHexAlpha(color, 1), withHexAlpha(secondaryColor, 0.6), TRANSPARENT],
    [color, secondaryColor]
  );

  /* The gradient is centred on the circle, so both move together when a caller
     repositions the glow. Memoised because `vec` allocates a new object every
     call and this one is passed straight into the Skia scene graph. */
  const center = useMemo(() => vec(offsetX, offsetY), [offsetX, offsetY]);

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Circle cx={offsetX} cy={offsetY} r={radius} opacity={opacity}>
        <RadialGradient c={center} r={radius} colors={colors} positions={STOPS} />
        <Blur blur={blurRadius} mode="decal" />
      </Circle>
    </Canvas>
  );
});

/**
 * Full strength, half strength, gone.
 *
 * Module scope rather than inline so the array identity is stable for the
 * lifetime of the app and Skia never sees a "changed" prop.
 */
const STOPS = [0, 0.5, 1];

/** Transparent black. See the note on the last gradient stop. */
const TRANSPARENT = '#00000000';

/**
 * `'#3A2050'` + 0.6 → `'#3A205099'`.
 *
 * Returns anything that is not a plain `#RRGGBB` untouched. A caller passing
 * `rgba(…)` or a named colour would otherwise get `rgba(0,0,0,1)99`, which Skia
 * parses as transparent black — a glow that silently does not render is far
 * harder to diagnose than one that ignores an opacity stop.
 */
function withHexAlpha(color: string, alpha: number): string {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return color;
  const channel = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${color}${channel}`;
}
