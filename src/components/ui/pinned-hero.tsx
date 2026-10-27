import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { BLUR_RADIUS } from '@/components/ui/hero-art';
import type { FootFade } from '@/components/ui/key-color-hero';
import { Palette, withAlpha } from '@/constants/theme';
import { usePulse } from '@/hooks/use-pulse';
import { useScreenChrome } from '@/hooks/use-screen-chrome';
import { useSteamArtwork } from '@/hooks/use-steam-artwork';
import {
  PINNED_HERO,
  pinnedBlur,
  pinnedDrain,
  pinnedDrift,
  pinnedStretch,
} from '@/lib/scroll-motion';

/** A gradient's colours and stops, which its types insist are at least two. */
type Colours = readonly [string, string, ...string[]];
type Stops = readonly [number, number, ...number[]];

const colours = (fade: FootFade, page: string) =>
  fade.alphas.map((alpha) => withAlpha(page, alpha)) as unknown as Colours;
const locations = (fade: FootFade) => fade.locations as unknown as Stops;

export type PinnedHeroProps = {
  /** The art. IGDB's, unless a Steam hero takes its place (`steamAppId`). */
  uri?: string | null;
  /** A legacy row's Steam appid: its `library_hero` is drawn when it has one. */
  steamAppId?: string | null;
  /** How tall the art is at rest. Full width, always, from the top of the display. */
  height: number;
  /** The page's colour: what the art's foot fades into, and what it drains into. */
  page: string;
  /** How the art's foot gives way to the page — the sharp copy's and the blurred one's alike. */
  fade: FootFade;
  /**
   * How far the page has scrolled when the art is solid page colour: where
   * the top bar comes in. The blur and the drain are both shares of it.
   */
  solidAt: number;

  /** How much of the frame, from the top, is darkened for the status bar and the discs. */
  scrim?: number;
  /**
   * Whether the page's colour is known. Until it is the art waits, unseen, and
   * comes in over `PINNED_HERO.arriveMs` as the page takes its colour — so the
   * art's foot never fades into one colour over a page of another.
   */
  ready?: boolean;
  /** Wraps the art — the trailer under it (`<TrailerBackdrop>`), which drifts and blurs with it. */
  media?: (art: ReactNode) => ReactNode;
};

/**
 * The game page's hero, pinned behind the page — the owner's brief of
 * 2026-10-27, after Apple Music's artist page (`lib/scroll-motion`,
 * `PINNED_HERO`, says it in numbers).
 *
 * **It is the page's backdrop, not part of the page** (`<Screen backdrop>`):
 * the art stays at the top of the display, drifting up only a fifth as fast as
 * the page, and the page slides over it — the masthead first, which is
 * transparent so the title, the cover and the synopsis float on the art, then
 * the page's solid part, which rises and swallows it. So nothing here clips to
 * the page, and the screen's own fill under it is the page's colour.
 *
 * ```
 *   the page's fill   — `<Screen>`'s, behind all of this
 *   drift             the art, the trailer, the blurred copy and the foot
 *                     fade, moving up together, slowly
 *   scrim             the top darkened for the status bar and the discs
 *   drain             the page's colour over all of it, once it is blurred
 * ```
 *
 * The blur is a blurred copy whose opacity moves — a radius that moved would
 * be a new bitmap a frame. It is the full-size file, mounted once the sharp
 * copy has loaded so Android decodes it from the cache that load filled. **Not
 * a small copy**: expo-image's Android blur shrinks the bitmap to a quarter
 * before blurring it (`BlurTransformation(min(radius, 25), 4)`), so a 180-wide
 * copy became a 45-pixel smear — a flat grey, "no blur at all" on the owner's
 * phone (2026-10-27). It lies over the art, so it softens a trailer too. It
 * comes in after a little scroll, gently, over most of the way; the art then
 * drains into the page's colour over the last quarter, solid at `solidAt` —
 * where the top bar comes in.
 *
 * **One foot fade, over both copies.** The sharp art and the blurred one
 * dissolve into the page by exactly the same curve, so the art is seamless
 * with the page at every point of the crossfade. For one build the blurred
 * copy carried a shorter fade of its own, and as it came in the art stopped
 * dissolving and read "as if it was pasted onto the page raw" (the owner,
 * 2026-10-27). The drifting box clips, so the blurred copy's 10% overscale
 * never shows below the foot — the frame cannot, since the art moves inside
 * it.
 *
 * Every scroll-driven style reads `pulse` and carries a transform: a render
 * re-applies them all (`usePulse`, CLAUDE.md § Gotchas, the lost end value).
 */
export const PinnedHero = memo(function PinnedHero({
  uri,
  steamAppId = null,
  height,
  page,
  fade,
  solidAt,
  scrim = 0,
  ready = true,
  media,
}: PinnedHeroProps) {
  const chrome = useScreenChrome();
  const still = useSharedValue(0);
  const scrollY = chrome?.scrollY ?? still;
  const pulse = usePulse();

  /* Steam's hero, then IGDB's — `<HeroArt>`'s ladder. */
  const steam = useSteamArtwork(steamAppId);
  const [steamFailed, setSteamFailed] = useState(false);
  const steamSource = steam && !steamFailed ? steam.hero : null;
  const source = steamSource ?? uri ?? null;
  const [loaded, setLoaded] = useState<string | null>(null);
  const blurReady = !!source && loaded === source;

  const footColours = useMemo(() => colours(fade, page), [fade, page]);

  const frameStyle = useAnimatedStyle(() => {
    pulse.get();
    const stretch = pinnedStretch(scrollY.get(), height);
    return { transform: [{ translateY: stretch.translateY }, { scale: stretch.scale }] };
  });
  const driftStyle = useAnimatedStyle(() => {
    pulse.get();
    return { transform: [{ translateY: pinnedDrift(scrollY.get(), PINNED_HERO.drift, height) }] };
  });
  const blurStyle = useAnimatedStyle(() => {
    pulse.get();
    return {
      opacity: pinnedBlur(scrollY.get(), solidAt, PINNED_HERO.blurFrom, PINNED_HERO.blurUntil),
      transform: [{ scale: PINNED_HERO.blurScale }],
    };
  });
  const drainStyle = useAnimatedStyle(() => {
    pulse.get();
    return {
      opacity: pinnedDrain(scrollY.get(), solidAt, PINNED_HERO.drainFrom),
      transform: [{ translateY: 0 }],
    };
  });

  const art = source ? (
    <Image
      source={{ uri: source }}
      recyclingKey={steamAppId ?? uri ?? undefined}
      style={styles.fill}
      cachePolicy="memory-disk"
      contentFit="cover"
      transition={280}
      /* The largest thing on the screen: ahead of every cover beside it. */
      priority="high"
      onLoad={() => setLoaded(source)}
      onError={() => {
        if (!steamSource) return;
        steam?.onFailed();
        setSteamFailed(true);
      }}
      accessibilityIgnoresInvertColors
    />
  ) : null;

  return (
    /* The arrival: a CSS transition on a React prop, which cannot lose its
       end value (CLAUDE.md, the lost end value). Hidden from a screen reader —
       the page's name is its heading, and this is its backdrop. */
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.layer,
        {
          height,
          opacity: ready ? 1 : 0,
          transitionProperty: 'opacity',
          transitionDuration: PINNED_HERO.arriveMs,
        },
      ]}>
      <Animated.View style={[styles.fill, frameStyle]}>
        {/* Clipped here, on the box that drifts — not on the frame: the art
            moves up inside the frame, and a clip that stayed put would let
            the blurred copy's overhang show under the art's foot once it had
            drifted past it. */}
        <Animated.View style={[styles.fill, styles.clip, driftStyle]}>
          {media ? media(art) : art}

          {/* The art softening: over the art, and over a trailer. */}
          {blurReady && (
            <Animated.View style={[styles.fill, blurStyle]}>
              <Image
                source={{ uri: source }}
                style={styles.fill}
                contentFit="cover"
                blurRadius={BLUR_RADIUS}
                cachePolicy="memory-disk"
                accessibilityIgnoresInvertColors
              />
            </Animated.View>
          )}

          {/* The art's foot giving way to the page — over both copies, so the
              art dissolves by the same curve sharp or blurred, and on the art,
              so it drifts with it and the art never shows an edge of its own. */}
          <LinearGradient colors={footColours} locations={locations(fade)} style={styles.fill} />
        </Animated.View>

        {scrim > 0 && (
          <LinearGradient
            colors={[withAlpha(Palette.shadowInk, 0.5), withAlpha(Palette.shadowInk, 0)]}
            style={[styles.scrim, { height: `${scrim * 100}%` }]}
          />
        )}

        <Animated.View style={[styles.fill, { backgroundColor: page }, drainStyle]} />
      </Animated.View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0, right: 0 },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  /* The blurred copy is drawn 10% past its box; it must never show below the
     art's foot, where the fade has already given way to the page. */
  clip: { overflow: 'hidden' },
  scrim: { position: 'absolute', left: 0, right: 0, top: 0 },
});

/**
 * The page's own colour under everything — `<Screen backdrop>`'s first layer
 * on the game page — taken over `PINNED_HERO.arriveMs` when it is first
 * known, as a CSS transition on a React prop. `<Screen>`'s fill is under this
 * and changes at once; this is what is seen.
 */
export function PageFill({ color }: { color: string }) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.fill,
        {
          backgroundColor: color,
          transitionProperty: 'backgroundColor',
          transitionDuration: PINNED_HERO.arriveMs,
        },
      ]}
    />
  );
}
