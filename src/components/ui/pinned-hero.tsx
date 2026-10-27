import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { BLUR_RADIUS } from '@/components/ui/hero-art';
import { footFade, type FootFade } from '@/components/ui/key-color-hero';
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

/**
 * The blurred copy's own foot: the page's colour over its bottom 40% only,
 * where the sharp art's dissolve starts a sixth of the way down. A blur has no
 * detail to lose at its foot, so it can run further into the page.
 */
const BLUR_FOOT = footFade(0.4);

export type PinnedHeroProps = {
  /** The art. IGDB's, unless a Steam hero takes its place (`steamAppId`). */
  uri?: string | null;
  /** A legacy row's Steam appid: its `library_hero` is drawn when it has one. */
  steamAppId?: string | null;
  /** How tall the art is at rest. Full width, always, from the top of the display. */
  height: number;
  /** The page's colour: what the art's foot fades into, and what it drains into. */
  page: string;
  /** How the art's foot gives way to the page. */
  fade: FootFade;
  /** How far the page has scrolled when the title reaches the top: the blur is whole. */
  blurAt: number;
  /** How far it has scrolled when the page's solid part has covered the art. */
  coverAt: number;
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
 * be a new bitmap a frame — mounted once the sharp copy has loaded, so on
 * Android it decodes from the disk cache that load filled (`<HeroArt>`'s
 * order; CLAUDE.md § Gotchas). It lies over the art, so it softens a trailer
 * too. Whole when the title reaches the top (`blurAt`); from there the art
 * drains into the page's colour (`coverAt`), "transitioning into solid".
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
  blurAt,
  coverAt,
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
  const blurFootColours = useMemo(() => colours(BLUR_FOOT, page), [page]);

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
      opacity: pinnedBlur(scrollY.get(), blurAt, PINNED_HERO.blurFrom),
      transform: [{ scale: PINNED_HERO.blurScale }],
    };
  });
  const drainStyle = useAnimatedStyle(() => {
    pulse.get();
    return {
      opacity: pinnedDrain(scrollY.get(), blurAt, coverAt),
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
        <Animated.View style={[styles.fill, driftStyle]}>
          {media ? media(art) : art}

          {/* The art's foot giving way to the page — on the art, so it drifts
              with it and the art never shows an edge of its own. */}
          <LinearGradient colors={footColours} locations={locations(fade)} style={styles.fill} />

          {/* The art softening, over the art (and over a trailer) and over its
              fade: it brings its own, shorter one, so as the blur comes in the
              art reaches further down — behind the cover and the synopsis,
              which float on it — and at rest, with no blur showing, nothing
              about the hero has changed. */}
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
              <LinearGradient
                colors={blurFootColours}
                locations={locations(BLUR_FOOT)}
                style={styles.fill}
              />
            </Animated.View>
          )}
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
