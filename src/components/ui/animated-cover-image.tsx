import { useIsFocused } from 'expo-router';
import { Image, type ImageContentFit } from 'expo-image';
import { Suspense, lazy, useEffect, useRef, useState, type ComponentType } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { Palette, PosterAspectRatio, Radius, Spacing, withAlpha } from '@/constants/theme';
import { useCoverPlayback } from '@/hooks/use-animated-cover';
import { useTheme } from '@/hooks/use-theme';
import {
  animatedFormatOf,
  type AnimatedFormat,
  type CoverAspect,
  type CoverStatus,
} from '@/lib/animated-cover';

/** The crossfade from the still cover to the animated one: the request's 200ms. */
const FADE_MS = 200;

/** What a layer that plays the animated file is handed. */
export type AnimatedLayerProps = {
  url: string;
  /** In front, focused, and the one cover playing: animate. Otherwise hold. */
  playing: boolean;
  /** Behind the animation, so a transparent frame never shows the still cover. */
  backdrop: string;
  /** How strongly the animation is drawn over `backdrop`. */
  mediaOpacity: number;
  fadeMs: number;
  /** The file would not load or play. */
  onFailed: (error?: unknown) => void;
  /** Its first frame is on screen. */
  onShown?: () => void;
};

/**
 * The video layer, loaded only when there is a video to play — see
 * `<AnimatedCoverVideo>`. A build without expo-video's native module gets
 * nothing in its place and keeps the still cover.
 */
const AnimatedCoverVideo = lazy<ComponentType<AnimatedLayerProps>>(() =>
  import('@/components/ui/animated-cover-video').catch(() => ({ default: NoVideo }))
);

function NoVideo(_: AnimatedLayerProps) {
  return null;
}

export type AnimatedCoverImageProps = {
  /** The still cover: on screen from the first frame, and whenever nothing moves. */
  staticUrl: string | null;
  /** A smaller copy of the still, drawn while it loads — a 1080p cover's `t_cover_big`. */
  placeholderUrl?: string | null;
  /** The animated file, from `useAnimatedCover`. */
  animatedUrl: string | null;
  /** How to draw it; read off its address when absent (`animatedFormatOf`). */
  format?: AnimatedFormat | null;
  status: CoverStatus;
  /** The shape: the box's proportions when `style` does not give both sides. */
  aspect: CoverAspect;
  /** The box: its size, and anything else a frame needs. The cover fills it. */
  style?: StyleProp<ViewStyle>;
  contentFit?: ImageContentFit;
  /**
   * Behind the animation — the slot's own fill, or the page under it — so a
   * frame with transparency in it never shows the still cover through.
   */
  backdrop?: string;
  /**
   * How strongly the animation is drawn, 0–1. A review's page draws it at a
   * little over half, so it moves behind the words without competing.
   */
  animatedOpacity?: number;
  /** "No animated cover found", over the cover, once that is the answer. */
  showNotFound?: boolean;
  /** From `useAnimatedCover`: a file that will not play. */
  onFailed?: (error?: unknown) => void;
  /**
   * Whether the animated file may be fetched and drawn now. Surprise Me holds
   * it until its card has been in front for a moment, so a card swiped past
   * never starts its download — and drops it when the card leaves, which
   * cancels one that had. True by default.
   */
  load?: boolean;
  /**
   * Hold the animation on its frame without letting go of it — while a finger
   * is dragging the page it is on, where decoding frames is the jank.
   */
  paused?: boolean;
  /** The animation's first frame is on screen: the download is over. */
  onAnimationShown?: () => void;
  /** The still's cache key and its own fade-in, as the slot had them. */
  staticCacheKey?: string;
  staticTransition?: number;
  accessibilityLabel?: string;
};

/**
 * A cover that moves when it can: the still image, and over it — once
 * `useAnimatedCover` has found one — the animated version, crossfading in
 * over `FADE_MS` when its first frame is ready.
 *
 * The owner's request (2026-10-20). What it draws, by format:
 *
 * - **An animated image** — WebP, APNG or GIF: SteamGridDB's animated grid on
 *   iOS, and IGDB's animated cover — by **expo-image**, which decodes all
 *   three on both platforms (Glide's APNG plugin on Android, SDWebImage's
 *   animated view on iOS). No `react-native-apng`, `react-native-fast-image`
 *   or WebView: each would be a native module's weight for what is already
 *   linked (CLAUDE.md, APK size).
 * - **A video** — WebM or MP4: SteamGridDB's WebM of an animated grid, where
 *   it can play — by **expo-video**, already in the app for trailers, rather
 *   than `react-native-video`; looping, muted, never in the background.
 *
 * Rules it keeps, every one from the request:
 *
 * - **The still is there from the first frame** and never waits on the
 *   animation; nothing swaps until the animated file has a frame to show
 *   (`onLoad`, `onFirstFrameRender`), so a slow file never blanks the slot.
 * - **It plays only while it can be seen**: the screen is focused, the app is
 *   in front (a video does not play in the background; an image is not drawn
 *   there), it may load (`load`), and it is the one animated cover playing
 *   (`useCoverPlayback`). Either kind is unmounted while it is not the one,
 *   releasing its decoder and cancelling a download still under way; `paused`
 *   holds it on its frame without letting go.
 * - **Never under Reduce Motion**, where the hook does not even look.
 * - **A file that fails** goes back to the still, and is reported
 *   (`onFailed`), which makes it "none" for the session and logs it.
 *
 * The animation is drawn over an opaque `backdrop` at `animatedOpacity`,
 * inside a layer that fades in — so a reduced opacity dims the animation
 * into the slot's colour rather than ghosting the still underneath it.
 */
export function AnimatedCoverImage({
  staticUrl,
  placeholderUrl,
  animatedUrl,
  format,
  status,
  aspect,
  style,
  contentFit = 'cover',
  backdrop,
  animatedOpacity = 1,
  showNotFound = false,
  onFailed,
  load = true,
  paused = false,
  onAnimationShown,
  staticCacheKey,
  staticTransition = 220,
  accessibilityLabel,
}: AnimatedCoverImageProps) {
  const theme = useTheme();
  const focused = useIsFocused();
  const reduceMotion = useReducedMotion();

  const kind = animatedUrl ? (format ?? animatedFormatOf(animatedUrl)) : null;
  const found = status === 'found' && !!animatedUrl && !!kind && !reduceMotion;
  const owner = useCoverPlayback(found && focused && load);
  const playing = owner && !paused;

  const layer: AnimatedLayerProps | null =
    owner && animatedUrl
      ? {
          url: animatedUrl,
          playing,
          backdrop: backdrop ?? theme.surfaceElevated,
          mediaOpacity: animatedOpacity,
          fadeMs: FADE_MS,
          onFailed: (error) => onFailed?.(error),
          onShown: onAnimationShown,
        }
      : null;

  return (
    <View
      /* The shape's own proportions, unless the caller sizes both sides. */
      style={[styles.box, { aspectRatio: aspect === 'square' ? 1 : PosterAspectRatio }, style]}
      accessible={!!accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}>
      {staticUrl && (
        <Image
          source={{ uri: staticUrl, ...(staticCacheKey ? { cacheKey: staticCacheKey } : {}) }}
          placeholder={placeholderUrl ? { uri: placeholderUrl } : undefined}
          placeholderContentFit={contentFit}
          style={StyleSheet.absoluteFill}
          contentFit={contentFit}
          cachePolicy="memory-disk"
          transition={staticTransition}
          accessibilityIgnoresInvertColors
        />
      )}

      {/* Mounted only while this is the cover playing: one that is not holds
          no decoder and downloads nothing. */}
      {layer &&
        (kind === 'video' ? (
          <Suspense fallback={null}>
            <AnimatedCoverVideo key={layer.url} {...layer} />
          </Suspense>
        ) : (
          <AnimatedImageLayer key={layer.url} {...layer} />
        ))}

      {showNotFound && status === 'not_found' && (
        <View style={styles.badge} pointerEvents="none">
          <Text variant="caption" color="white">
            No animated cover found
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * An animated image — WebP, APNG, GIF — by expo-image, faded in once it has
 * decoded, and held on its frame while it may not play.
 */
function AnimatedImageLayer({
  url,
  playing,
  backdrop,
  mediaOpacity,
  fadeMs,
  onFailed,
  onShown,
}: AnimatedLayerProps) {
  const ref = useRef<Image>(null);
  const [loaded, setLoaded] = useState(false);

  /* A command to the native view, not React state. */
  useEffect(() => {
    if (!loaded) return;
    if (playing) void ref.current?.startAnimating();
    else void ref.current?.stopAnimating();
  }, [loaded, playing]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: backdrop,
          opacity: loaded ? 1 : 0,
          transitionProperty: 'opacity',
          transitionDuration: fadeMs,
        },
      ]}>
      <Image
        ref={ref}
        source={{ uri: url }}
        style={[StyleSheet.absoluteFill, { opacity: mediaOpacity }]}
        contentFit="cover"
        cachePolicy="disk"
        autoplay={playing}
        onLoad={() => {
          setLoaded(true);
          onShown?.();
        }}
        onError={(event) => onFailed(event.error)}
        accessible={false}
        accessibilityIgnoresInvertColors
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /* The cover fills the box; the box clips the layers to the slot's corner. */
  box: { overflow: 'hidden' },
  badge: {
    position: 'absolute',
    left: Spacing.x8,
    right: Spacing.x8,
    bottom: Spacing.x8,
    alignItems: 'center',
    paddingVertical: Spacing.x4,
    paddingHorizontal: Spacing.x8,
    borderRadius: Radius.pill,
    backgroundColor: withAlpha(Palette.shadowInk, 0.72),
  },
});
