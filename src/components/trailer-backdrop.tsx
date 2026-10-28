import { useIsFocused } from 'expo-router';
import { decode } from 'jpeg-js';
import {
  Suspense,
  lazy,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';

import type { TrailerVideoProps } from '@/components/trailer-video';
import { useScreenChrome } from '@/hooks/use-screen-chrome';
import { FIELD, base64ToBytes } from '@/lib/artwork-field';

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

/** A frame of the playing trailer: RGBA, row by row. */
export type TrailerFrame = { data: Uint8Array; width: number; height: number };

/**
 * Whether frames can be read at all on this build. Latched off the first time
 * the capture module will not load — a build made before
 * `react-native-view-shot` was linked — so nothing asks again.
 */
let captureAvailable = true;

/** How long after the first frame the first read waits: the decoder settling. */
const FIRST_READ_MS = 700;

/**
 * One small frame of the video view, or null when there is none to give.
 *
 * `react-native-view-shot` draws a TextureView's own bitmap into the capture
 * on Android (ViewShot.java reads `TextureView.getBitmap`), which is why the
 * player is a TextureView here; a SurfaceView would come back as a hole. On
 * iOS the video layer may come back black, which the caller rejects as a
 * frame not yet decoded. It is read at `FIELD.capture`'s size, as a JPEG, and
 * decoded in JavaScript — a few thousand pixels.
 */
async function readFrame(view: View | null, aspect: number): Promise<TrailerFrame | null> {
  if (!view || !captureAvailable) return null;
  let captureRef: typeof import('react-native-view-shot').captureRef;
  try {
    ({ captureRef } = await import('react-native-view-shot'));
  } catch {
    captureAvailable = false;
    return null;
  }
  try {
    const width = FIELD.capture.width;
    const height = Math.max(1, Math.round(width / Math.max(0.1, aspect)));
    const text = await captureRef(view, {
      format: 'jpg',
      quality: 0.8,
      width,
      height,
      result: 'base64',
    });
    const image = decode(base64ToBytes(text), {
      useTArray: true,
      maxMemoryUsageInMB: 4,
      maxResolutionInMP: 0.02,
    });
    return { data: image.data, width: image.width, height: image.height };
  } catch {
    return null;
  }
}

export type TrailerBackdropProps = {
  /** The trailer to play, or null for the artwork alone (none, or switched off). */
  url: string | null;
  /** The artwork's height: once the page has scrolled this far, the video pauses. */
  height: number;
  /**
   * How far the page scrolls before the artwork is out of sight, when that is
   * not its height — the game page's hero is pinned behind the page and seen
   * until the page has covered it (`<PinnedHero coverAt>`).
   */
  until?: number;
  /** The artwork, drawn over the video until the video's first frame. */
  children: ReactNode;
  /**
   * Called with a frame of the trailer every `FIELD.refreshMs` while it is on
   * screen and playing — the page's colour field follows the clip, as
   * BitChord's backdrop follows a canvas. Never called for the artwork, and
   * not at all on a build that cannot capture.
   */
  onFrame?: (frame: TrailerFrame) => void;
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
 * **The caller covers the video's foot.** A video surface does not render
 * inside a mask on Android, so it cannot dissolve by its own alpha; both
 * pages that use this lay their hero's foot fade over it, into the key colour
 * (`<KeyColorHero>`), and the blur and the drain go over it too.
 */
export function TrailerBackdrop({ url, height, until, children, onFrame }: TrailerBackdropProps) {
  const chrome = useScreenChrome();
  const resting = useSharedValue(0);
  const scrollY = chrome?.scrollY ?? resting;
  const focused = useIsFocused();
  const reduceMotion = useReducedMotion();

  const [inView, setInView] = useState(true);
  /* The url whose first frame is up — so a new trailer, or the same one
     mounted again on return, starts behind the picture. */
  const [drawn, setDrawn] = useState<string | null>(null);

  const visibleFor = until ?? height;
  useAnimatedReaction(
    () => scrollY.get() < visibleFor,
    (now, was) => {
      if (now !== was) runOnJS(setInView)(now);
    }
  );

  const playable = url && !reduceMotion && focused ? url : null;
  const shown = playable !== null && drawn === playable;

  /* The frames: only of the video, only while it plays where it can be seen,
     one at a time — the next read is scheduled when the last has finished. */
  const { width } = useWindowDimensions();
  const video = useRef<View>(null);
  const emit = useEffectEvent((frame: TrailerFrame) => onFrame?.(frame));
  const reading = !!onFrame && shown && inView;
  const aspect = height > 0 ? width / height : 1;
  useEffect(() => {
    if (!reading) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const read = async () => {
      const frame = await readFrame(video.current, aspect);
      if (cancelled) return;
      if (frame) emit(frame);
      if (captureAvailable) timer = setTimeout(read, FIELD.refreshMs);
    };
    timer = setTimeout(read, FIRST_READ_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [reading, aspect]);

  return (
    <View style={{ height }}>
      {playable && (
        /* Its own view, so a capture of it holds the video and nothing drawn
           over it — expo-image's art is a hardware bitmap a capture cannot
           draw. `collapsable={false}`, or Android flattens it away. */
        <View ref={video} collapsable={false} style={StyleSheet.absoluteFill}>
          <Suspense fallback={null}>
            <TrailerVideo url={playable} playing={inView} onFirstFrame={() => setDrawn(playable)} />
          </Suspense>
        </View>
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
