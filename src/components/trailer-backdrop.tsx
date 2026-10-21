import { useIsFocused } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Suspense, lazy, useState, type ComponentType, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';

import type { TrailerVideoProps } from '@/components/trailer-video';
import { DISSOLVE_STOPS } from '@/constants/game-masthead';
import { withAlpha } from '@/constants/theme';
import { useScreenChrome } from '@/hooks/use-screen-chrome';

/** How long the artwork takes to fade off the trailer: the reference's `tween(500)`. */
const ART_FADE_MS = 500;

/**
 * The player, loaded only when there is a trailer to play — see
 * `<TrailerVideo>` for why it is never imported directly. A build without the
 * native module gets nothing in its place, and keeps the still artwork.
 */
const TrailerVideo = lazy<ComponentType<TrailerVideoProps>>(() =>
  import('@/components/trailer-video')
    .then((module) => ({ default: module.TrailerVideo }))
    .catch(() => ({ default: NoTrailer }))
);

function NoTrailer(_: TrailerVideoProps) {
  return null;
}

export type TrailerBackdropProps = {
  /** The trailer to play, or null for the artwork alone (none, or switched off). */
  url: string | null;
  /** The artwork's height: once the page has scrolled this far, the video pauses. */
  height: number;
  /**
   * The page colour behind the artwork, when the artwork dissolves into it by
   * its own alpha (the game page's hero, `fade="mask"`): the video under it
   * fades into the same colour along the same curve, so it ends where the art
   * does. Without it the caller covers the video's foot itself (the studio
   * page's scrim).
   */
  dissolveInto?: string;
  /** The artwork, drawn over the video until the video's first frame. */
  children: ReactNode;
};

/**
 * Artwork with its game's trailer under it — SimpMusic's artist header
 * (`ArtistScreen.kt`): the media layer is the video with the artwork on top,
 * and the artwork fades out over `ART_FADE_MS` once the video has drawn its
 * first frame. Until then — and for good, if the stream never starts — the
 * picture is what is seen; the video is never a black square. The game page's
 * hero and the studio page's banner.
 *
 * The artwork stays mounted under the faded layer: a page colour may be read
 * from it, and switching the trailer off brings it straight back.
 *
 * **The player exists only while this page is in front.** A covered page
 * unmounts it, which releases the decoder and the buffer; coming back mounts
 * a fresh one behind the picture, which fades again at its first frame. A
 * pause would keep the decoder, and a stack of game pages — each opened from
 * the last — would hold one each until playback failed on the next.
 *
 * **It plays only while it can be seen**: once the page has scrolled the
 * artwork away (read off the page's own scroll position on the UI thread,
 * crossing to React only when it changes) it pauses where it is. Under Reduce
 * Motion it is never mounted.
 *
 * The video is not inside the artwork's alpha mask: a mask is drawn through
 * an offscreen bitmap on Android, which a video surface does not render into.
 * Over a flat page a gradient into the page's colour on the mask's own curve
 * looks the same.
 */
export function TrailerBackdrop({ url, height, dissolveInto, children }: TrailerBackdropProps) {
  const chrome = useScreenChrome();
  const resting = useSharedValue(0);
  const scrollY = chrome?.scrollY ?? resting;
  const focused = useIsFocused();
  const reduceMotion = useReducedMotion();

  const [inView, setInView] = useState(true);
  /* The url whose first frame is up — so a new trailer, or the same one
     mounted again on return, starts behind the picture. */
  const [drawn, setDrawn] = useState<string | null>(null);

  useAnimatedReaction(
    () => scrollY.get() < height,
    (now, was) => {
      if (now !== was) runOnJS(setInView)(now);
    }
  );

  const playable = url && !reduceMotion && focused ? url : null;
  const shown = playable !== null && drawn === playable;

  return (
    <View style={{ height }}>
      {playable && (
        <Suspense fallback={null}>
          <TrailerVideo url={playable} playing={inView} onFirstFrame={() => setDrawn(playable)} />
        </Suspense>
      )}
      {playable && dissolveInto && (
        <LinearGradient
          colors={dissolveColors(dissolveInto)}
          locations={DISSOLVE_LOCATIONS}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}
      {/* A CSS transition on a React prop: the fade cannot lose its end
          value to a dropped frame (CLAUDE.md, the lost end value). */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: shown ? 0 : 1,
            transitionProperty: 'opacity',
            transitionDuration: ART_FADE_MS,
          },
        ]}>
        {children}
      </Animated.View>
    </View>
  );
}

const DISSOLVE_LOCATIONS = DISSOLVE_STOPS.map((stop) => stop.at) as [number, number, ...number[]];

/** The artwork mask's curve, turned round: the page's colour where the art has gone. */
function dissolveColors(page: string) {
  return DISSOLVE_STOPS.map((stop) => withAlpha(page, 1 - stop.alpha)) as [
    string,
    string,
    ...string[],
  ];
}
