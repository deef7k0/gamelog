import { Image, type ImageContentPosition } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { BLUR_RADIUS } from '@/components/ui/hero-art';
import { DISSOLVE_STOPS } from '@/constants/game-masthead';
import { Palette, withAlpha } from '@/constants/theme';
import { TOP_BAR_ROW, revealOffset } from '@/constants/top-bar';
import { usePulse } from '@/hooks/use-pulse';
import { useTopBarInset } from '@/hooks/use-header-height';
import { useScreenChrome } from '@/hooks/use-screen-chrome';
import { useSteamArtwork } from '@/hooks/use-steam-artwork';
import { smoothScrimStops } from '@/lib/immersive-color';
import {
  HERO_MOTION,
  blurAmount,
  heroProgress,
  parallaxShift,
  stretchOf,
  zoomOf,
} from '@/lib/scroll-motion';

/**
 * How the foot of the art gives way to the page: the page colour's alpha down
 * the frame, top to bottom. Only the alpha is read; the colour is the page's.
 */
export type FootFade = { locations: readonly number[]; alphas: readonly number[] };

/**
 * A smoothstep from nothing to the page over the bottom `share` of the frame —
 * SimpMusic's `artworkScrimBrush`, which a collection and a studio laid over
 * their bottom 70%.
 */
export function footFade(share: number): FootFade {
  const stops = smoothScrimStops();
  const start = 1 - share;
  return {
    locations: [0, ...stops.locations.map((at) => start + at * share)],
    alphas: [0, ...stops.alphas],
  };
}

/**
 * The game page's own fade: the owner's soft dissolve (`dissolveAt`, measured
 * off their reference), turned round — what was the art's alpha going is the
 * page's alpha coming. Over a flat page the two are the same picture; as a fade
 * *to a colour* it needs no mask, which a video cannot be drawn inside.
 */
export const MASTHEAD_FADE: FootFade = {
  locations: DISSOLVE_STOPS.map((stop) => stop.at),
  alphas: DISSOLVE_STOPS.map((stop) => 1 - stop.alpha),
};

/** A gradient's colours, which its type insists are at least two. */
type Colours = readonly [string, string, ...string[]];

const colours = (list: string[]) => list as unknown as Colours;
const locations = (list: readonly number[]) =>
  list as unknown as readonly [number, number, ...number[]];

export type KeyColorHeroProps = {
  /** The art. IGDB's, unless a Steam hero takes its place (`steamAppId`). */
  uri?: string | null;
  /** A legacy row's Steam appid: its `library_hero` is drawn when it has one. */
  steamAppId?: string | null;
  /** The frame's height. Full width, always. */
  height: number;
  /** How the art's foot gives way to the page. */
  fade: FootFade;
  /** Where the image sits in the frame: `contentPosition`. */
  contentPosition?: ImageContentPosition;
  /**
   * How much of the frame, from the top, is darkened for the status bar and
   * the glass discs: a game's and a studio's 40%, a collection's 22%.
   */
  scrim?: number;
  /** Black over the art, 0–1: a studio's 5%, so a bright banner sits back behind the name. */
  veil?: number;
  /** The loaded image's size, for a caller that has to reject art it cannot use. */
  onLoad?: (size: { width: number; height: number }) => void;
  /**
   * Wraps the art before the fades are laid over it — a trailer under it
   * (`<TrailerBackdrop>`), which takes the art as its children. It travels with
   * the art, and softens with it.
   */
  media?: (art: ReactNode) => ReactNode;
  /** Laid over the hero, and left where it is: a name and a line under it. */
  children?: ReactNode;
};

/**
 * A page's hero as Apple Music's artist page draws it — the game page, a
 * studio, a collection.
 *
 * **The page's colour is the page's, not this component's.** `<Screen tone>`
 * fills the whole page with the artwork's key colour and darkens it as the page
 * is read; this draws the art on top of that and fades its foot into it. So the
 * colour under the masthead and the colour at the foot of the page are the same
 * colour, always, and there is no gradient anywhere on the page. The tone is
 * read from the screen's chrome, which is where every layer that paints the
 * page's colour reads it.
 *
 * ## The layers, back to front
 *
 * ```
 *   the page     — `<Screen tone>`, behind all of this
 *   media          the picture, and on a game or a studio the trailer under
 *                  it, which takes over at its first frame; both travel
 *                  together, slower than the page
 *   blurred        the same picture, blurred, fading in near the end
 *   veil           a studio's 5% black
 *   foot fade      the art giving way to the page's colour at its foot
 *   scrim          the top darkened, for the status bar and the discs
 *   children       the name and its line — not moved, not softened
 * ```
 *
 * ## What the scroll does
 *
 * One distance runs it: rest to the hero's foot reaching the bar's.
 * `lib/scroll-motion` holds the curves and says why each is shaped as it is.
 * The picture travels at 60% of the page's speed, and in the last 45% it
 * softens and grows a little. Every moving part is an opacity or a transform,
 * read off the page's scroll on the UI thread, so a scroll renders nothing and
 * the JS thread can be busy without the hero missing a frame.
 *
 * **Nothing the lag uncovers is ever on screen.** The picture is translated
 * down inside a frame that is itself scrolling up, and what that exposes at the
 * frame's top is always above the display — see the test.
 *
 * ## Blur
 *
 * The blur's radius does not move — every radius would be a new bitmap; it is
 * an opacity that moves, which is the cheap half of the reference's own
 * description of itself ("or the sharp layer's opacity decreases"). The blurred
 * copy lies **over** the picture rather than under it: for a still the two are
 * the same blend, and over a **trailer** — an animated banner, which the art
 * steps aside for at its first frame — only this way round softens anything.
 *
 * The blurred copy is mounted once the sharp one has loaded, so on Android
 * (where a blur is a Glide transformation, a second request) it decodes from
 * the disk cache that load filled, and the file is downloaded once. At rest
 * nothing is blurred: the owner had the studio banner's resting blur removed
 * (2026-10-15), and this keeps that — the blur is what scrolling does.
 *
 * ## The re-render that resets a view
 *
 * Every scroll-driven style reads `pulse` and carries a transform, so a render
 * re-applies them all — without it, a render more than two seconds after the
 * page stopped would put the hero back to its first frame while the page is
 * still scrolled (`usePulse`, CLAUDE.md § Gotchas).
 */
export const KeyColorHero = memo(function KeyColorHero({
  uri,
  steamAppId = null,
  height,
  fade,
  contentPosition,
  scrim = 0,
  veil = 0,
  onLoad,
  media,
  children,
}: KeyColorHeroProps) {
  const chrome = useScreenChrome();
  const still = useSharedValue(0);
  const scrollY = chrome?.scrollY ?? still;
  const darkening = chrome?.tone?.darkening ?? still;
  const inset = useTopBarInset();
  const pulse = usePulse();

  /* The hero is done when its foot reaches the bar's — where the bar comes in.
     The page darkens over exactly this distance (`<Screen tone>`). */
  const distance = revealOffset(height, inset + TOP_BAR_ROW);

  /* Steam's hero, then IGDB's — `<HeroArt>`'s ladder. */
  const steam = useSteamArtwork(steamAppId);
  const [steamFailed, setSteamFailed] = useState(false);
  const steamSource = steam && !steamFailed ? steam.hero : null;
  const source = steamSource ?? uri ?? null;
  /* The art whose sharp copy has loaded: the blurred copy waits for it, and is
     the same file, so the crossfade is one picture softening. */
  const [loaded, setLoaded] = useState<string | null>(null);
  const blurReady = !!source && loaded === source;

  /* The page's dark ground tone: the foot fade melts the artwork directly into it. */
  const base = chrome?.tone?.dark ?? chrome?.background ?? Palette.shadowInk;

  const footColours = useMemo(
    () => colours(fade.alphas.map((alpha) => withAlpha(base, alpha))),
    [fade, base]
  );

  const frameStyle = useAnimatedStyle(() => {
    pulse.get();
    const stretch = stretchOf(scrollY.get(), height);
    return { transform: [{ translateY: stretch.translateY }, { scale: stretch.scale }] };
  });
  /* The picture: behind the page, and growing a little as it softens. */
  const pictureStyle = useAnimatedStyle(() => {
    pulse.get();
    const offset = scrollY.get();
    const progress = heroProgress(offset, distance);
    return {
      transform: [
        { translateY: parallaxShift(offset, HERO_MOTION.parallax, height) },
        { scale: zoomOf(progress, HERO_MOTION.blurFrom, HERO_MOTION.zoom) },
      ],
    };
  });
  const blurStyle = useAnimatedStyle(() => {
    pulse.get();
    return {
      opacity: blurAmount(
        heroProgress(scrollY.get(), distance),
        HERO_MOTION.blurFrom,
        HERO_MOTION.blurTo
      ),
      /* Past its frame, as the reference's `scale(1.1)` is: a blur pulls in
         nothing from beyond an image's edge, and that edge darkens. */
      transform: [{ scale: HERO_MOTION.blurScale }],
    };
  });


  const art = source ? (
    <Image
      source={{ uri: source }}
      recyclingKey={steamAppId ?? uri ?? undefined}
      style={styles.fill}
      cachePolicy="memory-disk"
      contentFit="cover"
      contentPosition={contentPosition}
      transition={280}
      /* The largest thing on the screen: ahead of every cover beside it. */
      priority="high"
      onLoad={(event) => {
        setLoaded(source);
        onLoad?.({ width: event.source.width, height: event.source.height });
      }}
      onError={() => {
        if (!steamSource) return;
        steam?.onFailed();
        setSteamFailed(true);
      }}
      accessibilityIgnoresInvertColors
    />
  ) : null;

  return (
    <View style={{ height }}>
      {/* The frame: everything that is the picture, clipped to it, and the one
          thing that stretches on an overscroll. Hidden from a screen reader —
          the page's name is the page's heading, and this is its backdrop. */}
      <Animated.View
        style={[styles.frame, frameStyle]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        {/* The picture, travelling with the page and falling behind it. The
            trailer rides inside this, so it lags and softens with the art. */}
        <Animated.View style={[styles.fill, pictureStyle]}>
          {media ? media(art) : art}

          {/* The picture softening: over the art, or over the trailer that has
              taken the art's place — never under either. */}
          {blurReady && (
            <Animated.View pointerEvents="none" style={[styles.fill, blurStyle]}>
              <Image
                source={{ uri: source }}
                style={styles.fill}
                contentFit="cover"
                contentPosition={contentPosition}
                blurRadius={BLUR_RADIUS}
                cachePolicy="memory-disk"
                accessibilityIgnoresInvertColors
              />
            </Animated.View>
          )}
        </Animated.View>

        {veil > 0 && (
          <View
            style={[styles.fill, { backgroundColor: withAlpha(Palette.shadowInk, veil) }]}
            pointerEvents="none"
          />
        )}

        {/*
          The art's foot giving way directly to the always-dark page ground.
        */}
        <View pointerEvents="none" style={styles.fill}>
          <LinearGradient
            colors={footColours}
            locations={locations(fade.locations)}
            style={styles.fill}
          />
        </View>

        {scrim > 0 && (
          <LinearGradient
            colors={[withAlpha(Palette.shadowInk, 0.5), withAlpha(Palette.shadowInk, 0)]}
            style={[styles.scrim, { height: `${scrim * 100}%` }]}
            pointerEvents="none"
          />
        )}
      </Animated.View>

      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  frame: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  scrim: { position: 'absolute', left: 0, right: 0, top: 0 },
});
