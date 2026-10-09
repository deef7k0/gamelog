import MaskedView from '@react-native-masked-view/masked-view';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { DISSOLVE_STOPS } from '@/constants/game-masthead';
import { HeroAspectRatio, HeroHeightRatio, Palette, withAlpha } from '@/constants/theme';
import { useSteamArtwork } from '@/hooks/use-steam-artwork';
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
export const BLUR_RADIUS = 72;

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
 *
 * **Exported for a masthead that cannot call `<HeroArt>` itself.** The
 * collection's was one, while its artwork was a 2×2 mosaic rather than a single
 * image: a second technique tuned by eye would have drifted from this one on the
 * first retune. That masthead is one cover under a plain scrim now, and nothing
 * outside this file reads these.
 */
export const RAMP_STOPS: readonly [number, number, ...number[]] = [0, 0.28, 0.5, 0.72, 1];
export const RAMP_COLORS: readonly [string, string, ...string[]] = [
  withAlpha(Palette.shadowInk, 0),
  withAlpha(Palette.shadowInk, 0.1),
  withAlpha(Palette.shadowInk, 0.45),
  withAlpha(Palette.shadowInk, 0.85),
  Palette.shadowInk,
];

/** Where the colour fade starts, as a fraction of the hero measured from the bottom. */
export const FADE_HEIGHT = 0.62;

/**
 * The `mask` fade, as the mask's alpha down the hero.
 *
 * The game page is its one caller, and the curve is that page's: it starts a
 * sixth of the way down, eases at both ends and trails off for a long way, so
 * the picture has no edge where it begins to go or where it has gone — and the
 * page's cover and title are set into its last tenth. The numbers, and what each
 * was measured against, are in `constants/game-masthead` and under `npm test`.
 *
 * It was `[0, 1 − FADE_HEIGHT, 1]`: full strength, then a straight line. Only
 * the alpha is read, so every stop is the same ink.
 */
const DISSOLVE_LOCATIONS = DISSOLVE_STOPS.map((stop) => stop.at) as [number, number, ...number[]];
const DISSOLVE_COLORS = DISSOLVE_STOPS.map((stop) => withAlpha(Palette.shadowInk, stop.alpha)) as [
  string,
  string,
  ...string[],
];

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
  /**
   * Steam appid, when the game has a Steam listing.
   *
   * Given one, the backdrop uses Steam's `library_hero` — 1920×620 key art the
   * publisher cut for exactly this job — instead of `uri`. **`uri` remains the
   * fallback**: no appid, or an appid with no hero, falls straight back to
   * whatever IGDB gave us. See `lib/games/steam-artwork.ts`.
   */
  steamAppId?: string | null;
  /** Darkens the top of the art so the floating back arrow and title stay legible. */
  scrim?: boolean;
  /** Overrides the computed height. Rarely needed. */
  height?: number;
  /**
   * How the art stops.
   *
   *  - `'color'` (default) — ramp to the page colour. Correct when what is
   *    behind the art *is* the page colour.
   *  - `'mask'` — dissolve the art's own alpha to nothing, revealing whatever is
   *    behind it. The only option that works over a **coloured or animated**
   *    backdrop: a ramp to `background` painted over a lit gradient is a dark
   *    band across the middle of the screen, which is exactly the seam this
   *    replaced. Use it over any backdrop that is not the flat page colour. Its
   *    curve is longer and softer than the colour fade's — see
   *    `DISSOLVE_LOCATIONS` — because the game page sets content into its tail.
   *  - `false` — no fade at all. The caller is covering the edge some other way.
   */
  fade?: 'color' | 'mask' | false;
  /**
   * The size of the image that actually loaded, once it has. For a caller that
   * has to reject art it cannot use — the studio banner skips a game whose
   * first IGDB "artwork" is a 6:1 wordmark strip, which no crop can show.
   */
  onLoad?: (size: { width: number; height: number }) => void;
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
export function HeroArt({
  uri,
  steamAppId = null,
  scrim = false,
  height,
  fade = 'color',
  onLoad,
}: HeroArtProps) {
  const theme = useTheme();
  const window = useWindowDimensions();
  const steam = useSteamArtwork(steamAppId);
  const [steamFailed, setSteamFailed] = useState(false);
  /* The art whose sharp copy has finished loading — see the blurred copy below. */
  const [loaded, setLoaded] = useState<string | null>(null);

  const heroHeight = height ?? heroHeightFor(window.width, window.height);

  /* Steam's hero, then IGDB's, then nothing. Same ladder as `<Poster>`. */
  const steamSource = steam && !steamFailed ? steam.hero : null;
  const source = steamSource ?? uri ?? null;

  /*
   * The blurred copy waits for the sharp one when both are the same file.
   *
   * On Android a blur is a Glide transformation, so the two copies are two
   * requests for one URL, and started together neither finds the other in the
   * cache: a cold hero downloaded its 1080p file twice. Mounted once the sharp
   * copy has loaded, the blurred one decodes from the disk cache that load just
   * filled. iOS coalesced the two downloads already and loses nothing. A Steam
   * hero is a different file from `uri`, so its blurred copy never waited.
   */
  const blurReady = source !== uri || loaded === uri;

  const content = (
    <View style={[styles.hero, { height: heroHeight }]}>
      {source ? (
        <Image
          source={{ uri: source, cacheKey: `hero-${steamAppId ?? source}` }}
          recyclingKey={steamAppId ?? uri ?? undefined}
          style={StyleSheet.absoluteFill}
          cachePolicy="memory-disk"
          contentFit="cover"
          transition={280}
          /* The largest thing on every screen that opens on art: ahead of the
             posters and rails that mount beside it. */
          priority="high"
          onLoad={(event) => {
            setLoaded(source);
            onLoad?.({ width: event.source.width, height: event.source.height });
          }}
          onError={() => {
            if (!steamSource) return;
            if (steam) steam.onFailed();
            setSteamFailed(true);
          }}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.surfaceElevated }]} />
      )}

      {/* One blurred copy of the same art, revealed through a gradient. The
          mask reads the alpha of `maskElement`, so a transparent-to-opaque ramp
          dissolves the blurred copy into the sharp one underneath with nothing
          to seam. No transition: it is the same cached image, and fading it in
          separately would animate the ramp across the art.

          Skipped in `mask` mode: that mode already wraps this whole view in a
          MaskedView, and nesting one inside another is unreliable on Android.
          The art is dissolving to transparent there anyway, which does the same
          job of getting it out of the way of the case and the title. */}
      {uri && blurReady && fade !== 'mask' && (
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
      {fade === 'color' && (
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

  if (fade !== 'mask') return content;

  /* The mask reads its element's *alpha*, so an opaque-to-transparent ramp
     erases the bottom of the art and lets the backdrop through untouched. The
     colours are irrelevant — only the alpha channel is sampled — which is why
     this can sit over a gradient that is changing colour as you scroll without
     either of them needing to know about the other. */
  return (
    <MaskedView
      style={{ height: heroHeight }}
      pointerEvents="none"
      maskElement={
        <LinearGradient
          colors={DISSOLVE_COLORS}
          locations={DISSOLVE_LOCATIONS}
          style={styles.fill}
        />
      }>
      {content}
    </MaskedView>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', overflow: 'hidden' },
  fill: { flex: 1 },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  scrim: { position: 'absolute', left: 0, right: 0, top: 0, height: '40%' },
});
