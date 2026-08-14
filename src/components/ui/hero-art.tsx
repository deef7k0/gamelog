import MaskedView from '@react-native-masked-view/masked-view';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { HeroAspectRatio, HeroHeightRatio, Palette, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Blur strength at the bottom of the hero, in points.
 *
 * Read against the ramp, not on its own: the mask blends this copy *into* the
 * sharp one, so the middle of the ramp shows a half-strength ghost rather than
 * a half-radius blur. That blend is why a single radius covers the whole
 * distance from "slightly soft" to "gone".
 *
 * Deliberately extreme. The hero is a backdrop for the case and the title that
 * sit on top of it, not a picture to read — at a gentler radius the key art
 * competed with the type in front of it and won.
 */
const BLUR_RADIUS = 72;

/**
 * The blur ramp, as mask alpha down the hero.
 *
 * The blur starts almost immediately and is most of the way in by the middle,
 * so the art is legible only at the very top and is a wash of colour by the
 * time the case sits over it. The stops approximate a smoothstep — a straight
 * line has a visible corner at each end, which on artwork reads as a crease.
 *
 * This replaced three clipped copies at increasing blur radius. That version
 * left a hard step at each band boundary: rendered at the real 390×321 against
 * high-contrast art the seams were plainly visible rectangles, and adding bands
 * did not converge — twelve looked worse than three, because every extra band
 * is another edge rather than a smaller one. A mask has no bands to seam.
 */
const RAMP_STOPS: readonly [number, number, ...number[]] = [0, 0.28, 0.5, 0.72, 1];
const RAMP_COLORS: readonly [string, string, ...string[]] = [
  withAlpha(Palette.shadowInk, 0),
  withAlpha(Palette.shadowInk, 0.1),
  withAlpha(Palette.shadowInk, 0.45),
  withAlpha(Palette.shadowInk, 0.85),
  Palette.shadowInk,
];

/** Where the colour fade starts, as a fraction of the hero measured from the bottom. */
const FADE_HEIGHT = 0.62;

/**
 * How tall a full-bleed hero should be on this display.
 *
 * Never shorter than the art's own 16:9 height: on a wide screen the
 * proportional height would crop a frame that already fits.
 */
export function heroHeightFor(width: number, height: number): number {
  return Math.round(Math.max(width / HeroAspectRatio, height * HeroHeightRatio));
}

export type HeroArtProps = {
  uri?: string | null;
  /** Darkens the top of the art so the floating back arrow and title stay legible. */
  scrim?: boolean;
  /** Overrides the computed height. Rarely needed. */
  height?: number;
  /**
   * Draw the ramp that dissolves the art into the page.
   *
   * On by default, and off on any screen that runs `<Ambience>`: that component
   * closes its own ramp exactly on this art's bottom edge, and two ramps ending
   * on two slightly different darks is precisely what put a visible band across
   * the middle of the game page. One screen, one gradient.
   */
  fade?: boolean;
};

/**
 * Full-bleed key art that dissolves into the page.
 *
 * Every screen that opens on artwork uses this — game, collection, review, the
 * Top 10 — so they open the same way. The caller supplies the bleed: cancel any
 * horizontal padding on the container around it.
 *
 * A missing image is a flat block of the same height rather than nothing, so
 * the layout below does not jump when art arrives.
 */
export function HeroArt({ uri, scrim = false, height, fade = true }: HeroArtProps) {
  const theme = useTheme();
  const window = useWindowDimensions();

  const heroHeight = height ?? heroHeightFor(window.width, window.height);

  return (
    <View style={[styles.hero, { height: heroHeight }]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={280}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.surfaceElevated }]} />
      )}

      {/* One blurred copy of the same art, revealed through a gradient. The
          mask reads the alpha of `maskElement`, so a transparent-to-opaque ramp
          dissolves the blurred copy into the sharp one underneath with nothing
          to seam. No transition: it is the same cached image, and fading it in
          separately would animate the ramp across the art. */}
      {uri && (
        <MaskedView
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          maskElement={
            <LinearGradient colors={RAMP_COLORS} locations={RAMP_STOPS} style={styles.fill} />
          }>
          <Image
            source={{ uri }}
            style={styles.fill}
            contentFit="cover"
            blurRadius={BLUR_RADIUS}
            accessibilityIgnoresInvertColors
          />
        </MaskedView>
      )}

      {/* Three stops, not two, and weighted dark in the middle: a straight ramp
          spends its first half barely tinting anything and then has to close the
          whole distance in the second, which reads as the art dropping off a
          shelf. This holds the art longer and closes faster. */}
      {fade && (
        <LinearGradient
          colors={[
            withAlpha(theme.background, 0),
            withAlpha(theme.background, 0.72),
            theme.background,
          ]}
          locations={[0, 0.55, 1]}
          style={[styles.fade, { height: `${FADE_HEIGHT * 100}%` }]}
          pointerEvents="none"
        />
      )}

      {scrim && (
        <LinearGradient
          colors={[withAlpha(Palette.shadowInk, 0.5), withAlpha(Palette.shadowInk, 0)]}
          style={styles.scrim}
          pointerEvents="none"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', overflow: 'hidden' },
  fill: { flex: 1 },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  scrim: { position: 'absolute', left: 0, right: 0, top: 0, height: '40%' },
});
