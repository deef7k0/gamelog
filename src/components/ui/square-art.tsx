import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Elevation } from '@/constants/theme';
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
 * the two draw the identical object.
 */
export function SquareArt({
  uri,
  size,
  title,
}: {
  uri: string;
  size: number;
  title: string | null;
}) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.frame,
        { width: size, height: size, backgroundColor: theme.surfaceElevated },
        Elevation.raised,
      ]}>
      <View style={styles.clip}>
        <Image
          source={{ uri, cacheKey: `square-${uri}` }}
          style={styles.image}
          cachePolicy="memory-disk"
          contentFit="cover"
          transition={220}
          accessibilityIgnoresInvertColors
          accessibilityLabel={title ? `Cover art for ${title}` : undefined}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /* Fill and shadow out here, clip on the child — Android drops `elevation`
     under `overflow: 'hidden'`. Same split `<Poster>` documents. */
  frame: { borderRadius: SQUARE_RADIUS },
  clip: { width: '100%', height: '100%', borderRadius: SQUARE_RADIUS, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
});
