import { Image } from 'expo-image';
import { useState } from 'react';
import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { PostMedia } from '@/lib/api';

export type MediaCarouselProps = {
  media: PostMedia[];
  /** Horizontal space the carousel sits inside, so pages snap correctly. */
  width: number;
  /**
   * Corner rounding. Feed posts render the image edge-to-edge inside an already
   * rounded card, so they pass `false` — rounding it twice leaves visible
   * slivers of card background in the corners.
   */
  rounded?: boolean;
};

/**
 * Swipeable image carousel with a page counter and dots.
 *
 * Paging is done with `pagingEnabled` on a horizontal FlatList rather than a
 * gesture handler — it snaps natively and costs nothing on the JS thread while
 * a feed is scrolling.
 */
export function MediaCarousel({ media, width, rounded = true }: MediaCarouselProps) {
  const theme = useTheme();
  const { height: screenHeight } = useWindowDimensions();
  const [page, setPage] = useState(0);

  if (media.length === 0) return null;

  // Cap tall images so one portrait screenshot cannot eat the whole viewport.
  const height = Math.min(width, screenHeight * 0.5);

  return (
    <View
      style={[
        styles.wrapper,
        {
          width,
          height,
          backgroundColor: theme.surfaceElevated,
          borderRadius: rounded ? Radius.medium : 0,
        },
      ]}>
      <FlatList
        data={media}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          setPage(Math.round(event.nativeEvent.contentOffset.x / width));
        }}
        renderItem={({ item }) => (
          <Image
            source={{ uri: item.url }}
            style={{ width, height }}
            contentFit="cover"
            transition={200}
            accessibilityIgnoresInvertColors
          />
        )}
      />

      {media.length > 1 && (
        <>
          <View style={[styles.counter, { backgroundColor: theme.scrim }]}>
            <Text variant="micro" style={styles.counterText}>
              {page + 1}/{media.length}
            </Text>
          </View>

          <View style={styles.dots}>
            {media.map((item, index) => (
              <View
                key={item.id}
                style={[
                  styles.dot,
                  { backgroundColor: index === page ? '#FFFFFF' : 'rgba(255,255,255,0.45)' },
                ]}
              />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative', overflow: 'hidden' },
  counter: {
    position: 'absolute',
    top: Spacing.three,
    right: Spacing.three,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  counterText: { color: '#FFFFFF' },
  dots: {
    position: 'absolute',
    bottom: Spacing.three,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.one + 2,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
