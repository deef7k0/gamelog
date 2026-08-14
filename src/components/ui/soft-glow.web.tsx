import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Palette, withAlpha } from '@/constants/theme';

import type { SoftGlowProps } from './soft-glow';

/**
 * `<SoftGlow>` for the web, without Skia.
 *
 * Metro resolves `.web.tsx` ahead of `.tsx`, so importing `./soft-glow` gets
 * the Skia implementation on iOS and Android and gets this one in the browser.
 * Nothing at the call site changes and the prop contract is identical.
 *
 * ## Why not just run the Skia version here
 *
 * It would work, but only after `LoadSkiaWeb()` has fetched and instantiated the
 * CanvasKit WASM binary — several megabytes downloaded before first paint, and a
 * root-level async boundary in `app/_layout.tsx` that every route would then
 * wait behind. That is a serious cost to the web build, and this is a decorative
 * glow. The project ships a real web target (`app.json` sets
 * `web.output: 'static'`, and there is a Netlify redirect in the repo), so that
 * cost would be paid by actual visitors.
 *
 * ## What is lost
 *
 * The true Gaussian blur. A blurred radial gradient is, to the eye, a radial
 * gradient with a gentler falloff — so this reproduces the falloff directly with
 * extra colour stops rather than blurring two. The visible result is the same
 * atmospheric wash; what you do not get is Skia's exact kernel, which matters
 * for a photograph and does not for a corner glow on black.
 *
 * The one thing that must not be lost is the smoothness. Three stops band
 * visibly across a 460px area on a dark background, which is why there are six.
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
  /*
   * The blur widens the glow on native, so the web circle has to be widened by
   * hand to cover the same ground — otherwise the effect is visibly smaller in
   * a browser than on a phone. One blur radius each side is the match.
   */
  const diameter = size + blurRadius * 2;

  const backgroundImage = useMemo(() => {
    /*
     * Six stops approximating a Gaussian shoulder: full, then a slow release
     * through the mid colour, then a long tail. An even three-stop ramp puts a
     * visible ring at the halfway mark on a dark page — the eye is far more
     * sensitive to a gradient's second derivative than to its value, so the
     * stops are bunched where the curve bends.
     */
    const stops = [
      `${withAlpha(color, 1)} 0%`,
      `${withAlpha(color, 0.82)} 18%`,
      `${withAlpha(secondaryColor, 0.6)} 40%`,
      `${withAlpha(secondaryColor, 0.28)} 62%`,
      `${withAlpha(secondaryColor, 0.08)} 82%`,
      // Transparent *black*, matching the native gradient's last stop: browsers
      // interpolate premultiplied too, and a transparent purple tints the tail.
      'rgba(0, 0, 0, 0) 100%',
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
          // Centred on the same point the Skia circle uses.
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

/* Re-exported so `import type { SoftGlowProps } from './soft-glow'` resolves
   identically whichever platform picked the implementation. */
export type { SoftGlowProps };
