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
}: PosterProps) {
  const theme = useTheme();
  const source = coverUrl ?? heroUrl ?? null;
  const height = width / PosterAspectRatio;
  const radius = Radius[rounded];

  return (
    <View
      style={[
        styles.frame,
        { width, height, borderRadius: radius, backgroundColor: theme.surfaceElevated },
        elevated && Elevation.card,
      ]}>
      {source ? (
        <Image
          source={{ uri: source }}
          style={[styles.image, { borderRadius: radius }]}
          contentFit="cover"
          transition={220}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={styles.placeholder}>
          <Text variant="title" color="textMuted">
            {(title ?? '?').trim().charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
