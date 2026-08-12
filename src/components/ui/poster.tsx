import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { Elevation, PosterAspectRatio, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type PosterProps = {
  /** Portrait box art. Falls back to `heroUrl`, then to a lettered placeholder. */
  coverUrl?: string | null;
  /** Landscape art, used when there is no portrait cover (Steam, RAWG, itch). */
  heroUrl?: string | null;
  title?: string | null;
  width: number;
  /** Posters in a scrolling row do not need shadows; detail heroes do. */
  elevated?: boolean;
  rounded?: keyof typeof Radius;
  /**
   * Fill the parent's height instead of deriving it from `width`.
   *
   * For a poster set beside a column of text that has to line up with it top
   * and bottom — the review card. A fixed 2:3 height cannot do that: the text
   * is however tall the text is, and the two only agree by accident. Filling
   * lets the *text* set the height and crops the artwork to suit, which is what
   * `contentFit="cover"` already does everywhere else in the app.
   *
   * The parent must give this a height to fill — a flex row leaves
   * `alignItems` at `stretch` by default, which is exactly that.
   */
  fillHeight?: boolean;
};

/**
 * Portrait game artwork at a fixed 2:3 ratio.
 *
 * Providers are inconsistent about what art they have — IGDB and Steam publish
 * true box art, RAWG and itch.io only landscape key art. Rather than stretching
 * a landscape image into a portrait slot, we crop it with `contentFit="cover"`,
 * which reads acceptably, and fall back to an initial when there is no art at
 * all.
 */
export function Poster({
  coverUrl,
  heroUrl,
  title,
  width,
  elevated = false,
  rounded = 'image',
  fillHeight = false,
}: PosterProps) {
  const theme = useTheme();
  const source = coverUrl ?? heroUrl ?? null;
  const height = width / PosterAspectRatio;
  const radius = Radius[rounded];

  /*
   * Outer view carries the fill and the shadow; inner view does the clipping.
   * Android's `elevation` is clipped away by `overflow: 'hidden'`, so the two
   * cannot live on the same view — artwork always needs the clip to round its
   * corners, which is why every poster in the app was shadowless on Android
   * before. See DESIGN.md § 6.3.
   *
   * Every poster now sits on `Elevation.card`; `elevated` promotes it to
   * `raised` for a detail hero, where the artwork is the subject rather than
   * one tile in a rail.
   */
  return (
    <View
      style={[
        { width, borderRadius: radius, backgroundColor: theme.surfaceElevated },
        // `flex: 1` rather than a computed height — the parent row's stretch
        // supplies it. See `fillHeight`.
        fillHeight ? styles.fill : { height },
        elevated ? Elevation.raised : Elevation.card,
      ]}>
      <View style={[styles.clip, { borderRadius: radius }]}>
        {source ? (
          <Image
            source={{ uri: source }}
            style={styles.image}
            contentFit="cover"
            transition={220}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={styles.placeholder}>
            <Text variant="h1" color="textMuted">
              {(title ?? '?').trim().charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  clip: { width: '100%', height: '100%', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
