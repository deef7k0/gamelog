import { StyleSheet, View } from 'react-native';

import { AnimatedCoverImage } from '@/components/ui/animated-cover-image';
import { Elevation } from '@/constants/theme';
import type { AnimatedCover } from '@/hooks/use-animated-cover';
import { useTheme } from '@/hooks/use-theme';

/**
 * The square's share of the content width, on the screens that show one game's
 * square art as their subject — Surprise Me and a review.
 *
 * It ran flush to the gutter on both sides — genuinely edge to edge — and that
 * was too much. A cover with nothing either side of it stops reading as an
 * object on a page and starts reading as the page, which is why the reference
 * leaves a margin: the art is unmistakably the subject *and* unmistakably a
 * thing sitting in a room. 0.84 is that margin — about 31dp a side on a 390dp
 * phone — and the space it buys back goes to the block underneath, which is the
 * part you act on.
 */
export const SQUARE_RATIO = 0.84;

/**
 * The square's corner.
 *
 * A step above `Radius.caseImage` (12), which is the game case's own token and
 * not this component's to move. At 328dp a 12 reads as very nearly square; 18 is
 * where the softening is visible as an intention without the art starting to
 * look like a chip.
 */
export const SQUARE_RADIUS = 18;

/**
 * A square cover, framed like the poster it replaces.
 *
 * Not a `<Poster>` with a different aspect ratio. `<Poster>` is the app's
 * portrait primitive — 2:3 is in its name, its docblock and its `PosterProps` —
 * and it carries a Steam-capsule preference and an edition badge that both
 * assume that shape. Teaching it a second ratio would put a branch in the one
 * component that is on nearly every screen, to serve two.
 *
 * What it does borrow is the frame: the same outer-view-fill / inner-view-clip
 * split that `<Poster>` documents (Android clips `elevation` away under
 * `overflow: 'hidden'`, so the shadow and the clip cannot share a view), and
 * `Elevation.raised`, which is the tier `<Poster elevated>` uses for a detail
 * hero. The artwork changes shape; the object it is mounted in does not.
 *
 * No edition badge. At this size the art is the screen, and the one game on it
 * is named directly underneath.
 *
 * Moved out of Surprise Me when the review page took the same composition;
 * the two draw the identical object. The review page now draws it small, at
 * its reference's barely-rounded corner (`radius`).
 *
 * **It can move** (2026-10-20): handed `animation` — `useAnimatedCover` for the
 * square — it crossfades to the game's animated square once one is found
 * (`<AnimatedCoverImage>`), and stays still otherwise. Surprise Me does.
 */
export function SquareArt({
  uri,
  size,
  title,
  radius = SQUARE_RADIUS,
  animation,
  load = true,
  paused = false,
}: {
  uri: string;
  size: number;
  title: string | null;
  /** The corner, when it is not `SQUARE_RADIUS`. */
  radius?: number;
  /** The game's animated square, to crossfade to once found. */
  animation?: AnimatedCover;
  /** Whether the animation may be fetched and drawn now (`<AnimatedCoverImage load>`). */
  load?: boolean;
  /** Hold the animation on its frame (`<AnimatedCoverImage paused>`). */
  paused?: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      style={[
        { width: size, height: size, borderRadius: radius, backgroundColor: theme.surfaceElevated },
        Elevation.raised,
      ]}>
      <View style={[styles.clip, { borderRadius: radius }]}>
        <AnimatedCoverImage
          /* Cached under its own address, no key of its own: Surprise Me
             prefetches the next cards' squares by address
             (`lib/surprise-prefetch.ts`), and a prefetch can only land where
             the slot will look. */
          staticUrl={uri}
          animatedUrl={animation?.animatedUrl ?? null}
          format={animation?.format}
          status={animation?.status ?? 'idle'}
          onFailed={animation?.reportFailure}
          load={load}
          paused={paused}
          aspect="square"
          style={styles.image}
          backdrop={theme.surfaceElevated}
          accessibilityLabel={title ? `Cover art for ${title}` : undefined}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /* Fill and shadow on the frame, clip on the child — Android drops
     `elevation` under `overflow: 'hidden'`. Same split `<Poster>` documents. */
  clip: { width: '100%', height: '100%', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
});
