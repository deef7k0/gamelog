import { LinearGradient } from 'expo-linear-gradient';
import { memo, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { SmoothScrim } from '@/components/ui/smooth-scrim';
import { useTheme } from '@/hooks/use-theme';
import { GLOW_FADE_MS, GLOW_SCRIM_SHARE, angledGradient, easedStops } from '@/lib/home-glow';

/**
 * Home's glow — SimpMusic's, measured from its source (`lib/home-glow` has the
 * numbers and where each was read).
 *
 * Drawn as the background of the page's first block — the bar's room and the
 * first section under it — and `height` is that block plus the reference's
 * 140dp. So it **scrolls with the page**, as the reference's does: it is its
 * first list item's background, not a layer fixed to the screen. The caller
 * puts it first inside the block, so everything after paints over it.
 *
 * Two layers, as the reference's `Box` has: the tone running at 25° into the
 * page, and over its bottom 60% the page's own colour rising from nothing
 * (`artworkScrimBrush`, here `<SmoothScrim>`) — so wherever the glow stops,
 * it stops on exactly the page.
 *
 * **A new tone breathes in.** The reference animates the colour over 500ms
 * (`animateColorAsState`); a gradient's colours cannot be animated here, so
 * the tone's layer is keyed by its colour and cross-dissolved — the new one in
 * over 500ms, the old one out over the same time a quarter of a second later,
 * so the two never thin to the page between them. Under Reduce Motion it
 * changes at once. With no tone there is no layer: the page is plain until
 * one arrives, "deliberately not a theme-colour fallback".
 */
export const HomeGlow = memo(function HomeGlow({
  tone,
  height,
}: {
  tone: string | null;
  height: number;
}) {
  const theme = useTheme();
  const page = theme.homeBackground;

  if (height <= 0) return null;

  return (
    <View pointerEvents="none" style={[styles.glow, { height }]}>
      {tone && <ToneLayer key={tone} tone={tone} page={page} height={height} />}
      <SmoothScrim color={page} style={[styles.scrim, { height: height * GLOW_SCRIM_SHARE }]} />
    </View>
  );
});

function ToneLayer({ tone, page, height }: { tone: string; page: string; height: number }) {
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const gradient = useMemo(() => {
    const ends = angledGradient(width, height);
    if (!ends) return null;
    const { colors, locations } = easedStops(tone, page);
    return {
      ...ends,
      colors: colors as unknown as readonly [string, string, ...string[]],
      locations: locations as unknown as readonly [number, number, ...number[]],
    };
  }, [height, page, tone, width]);

  if (!gradient) return null;

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(GLOW_FADE_MS)}
      exiting={reduceMotion ? undefined : FadeOut.delay(GLOW_FADE_MS / 2).duration(GLOW_FADE_MS)}
      style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={gradient.colors}
        locations={gradient.locations}
        start={gradient.start}
        end={gradient.end}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', top: 0, left: 0, right: 0 },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
