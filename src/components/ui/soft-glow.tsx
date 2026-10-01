import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Palette, withAlpha } from '@/constants/theme';

export type SoftGlowProps = {
  /**
   * Peak opacity at the glow's centre, 0–1. Safe to animate: it is the view's
   * opacity and does not redraw the gradient.
   *
   * @default 0.5
   */
  opacity?: number;
  /**
   * Colour at the centre of the glow.
   *
   * @default Palette.glowCore ('#6B4C9A')
   */
  color?: string;
  /**
   * Colour at the shoulder, where the glow is already thinning.
   *
   * @default Palette.glowEdge ('#3A2050')
   */
  secondaryColor?: string;
  /**
   * Diameter of the glow's body in dp, before its soft edge widens it.
   *
   * @default 560
   */
  size?: number;
  /**
   * How far the soft edge reaches past `size / 2`, in dp — so the visible glow
   * is `size + blurRadius * 2` across. The name is the Gaussian sigma the Skia
   * version took (see below); keep it small, as that one had to be.
   *
   * @default 24
   */
  blurRadius?: number;
  /**
   * Centre X in dp, in the parent's coordinates.
   *
   * **Keep the centre on or near the screen.** The ramp fades to nothing at its
   * rim, so there is no silhouette to hide by pushing it off-corner — all that
   * does is throw the bright part away. At (-60, -110) only 6.4% of an early
   * version's disc was on screen and every visible pixel came from the outer,
   * nearly-transparent half of the ramp.
   *
   * @default 60
   */
  offsetX?: number;
  /**
   * Centre Y in dp. See `offsetX`.
   *
   * @default 0
   */
  offsetY?: number;
};

/**
 * A soft, diffuse radial glow: one view filled with a CSS radial gradient.
 *
 * Surprise Me's bloom behind the dealt card and its swipe edges. Purely
 * decorative and inert (`pointerEvents="none"`).
 *
 * ## No Skia
 *
 * This was a Skia `<Canvas>`: a circle filled with a three-stop radial
 * gradient, under a Gaussian `<Blur>` that guarded the falloff against banding.
 * That was most of what Skia did in this app, and Skia's native library is
 * 8–15 MB per CPU architecture in every APK — and each `<Canvas>` is a GPU
 * surface of its own. React Native draws radial gradients itself now
 * (`experimental_backgroundImage`, New Architecture, iOS and Android), so the
 * glow is an ordinary view, composited like any other.
 *
 * What a gradient cannot do is blur. A blurred radial gradient is, to the eye,
 * a radial gradient with a gentler shoulder, so the shoulder is drawn directly:
 * six stops bunched where the curve bends, over a disc widened by the blur's
 * reach. Three evenly spaced stops band visibly on a dark page — the eye reads
 * a gradient's second derivative long before its value — which is why there
 * are six. This is the implementation the web build always used.
 *
 * Two details carried over from the Skia version, and still load-bearing:
 *
 *  - **The centre stays on screen** (see `offsetX`).
 *  - **The last stop is the shoulder colour at zero alpha**, as every gradient
 *    in the app ends (`withAlpha(colour, 0)`, CLAUDE.md). Android interpolates
 *    a gradient unpremultiplied, so ending on transparent *black* drags the
 *    tail's colour toward black on its way out; ending on the same hue fades
 *    only the alpha, and is equally right where interpolation is premultiplied.
 *
 * Do not animate `size` or `blurRadius` — either one rebuilds the gradient.
 * `opacity` and transforms on a parent are free.
 */
export const SoftGlow = memo(function SoftGlow({
  opacity = 0.5,
  color = Palette.glowCore,
  secondaryColor = Palette.glowEdge,
  size = 560,
  blurRadius = 24,
  offsetX = 60,
  offsetY = 0,
}: SoftGlowProps) {
  /* The blur widened the native glow past its circle; widening the disc by the
     same reach is what keeps the glow the size it was. */
  const diameter = size + blurRadius * 2;

  const backgroundImage = useMemo(() => {
    /*
     * Six stops approximating a Gaussian shoulder: full, then a slow release
     * through the mid colour, then a long tail.
     */
    const stops = [
      `${withAlpha(color, 1)} 0%`,
      `${withAlpha(color, 0.82)} 18%`,
      `${withAlpha(secondaryColor, 0.6)} 40%`,
      `${withAlpha(secondaryColor, 0.28)} 62%`,
      `${withAlpha(secondaryColor, 0.08)} 82%`,
      `${withAlpha(secondaryColor, 0)} 100%`,
    ].join(', ');

    return `radial-gradient(circle at center, ${stops})`;
  }, [color, secondaryColor]);

  return (
    <View
      pointerEvents="none"
      style={[
        styles.glow,
        {
          width: diameter,
          height: diameter,
          left: offsetX - diameter / 2,
          top: offsetY - diameter / 2,
          opacity,
          experimental_backgroundImage: backgroundImage,
        },
      ]}
    />
  );
});

const styles = StyleSheet.create({
  glow: { position: 'absolute' },
});
