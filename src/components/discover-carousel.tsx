import { Link } from 'expo-router';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { MaxContentWidth, PosterAspectRatio, Radius, Spacing } from '@/constants/theme';
import type { ChartEntry } from '@/lib/news';

/** The focused cover, as a fraction of the window. Leaves the next one peeking. */
const CARD_WIDTH_RATIO = 0.52;
const CARD_MAX_WIDTH = 300;

/** How far an unfocused cover shrinks. */
const MIN_SCALE = 0.78;
/** And how far it fades, so depth is not carried by size alone. */
const MIN_OPACITY = 0.55;

export type DiscoverCarouselProps = {
  entries: ChartEntry[];
  loading?: boolean;
};

/**
 * The Discover rail: covers scrolling horizontally, the leftmost one at full
 * size and everything to its right smaller.
 *
 * The focal point is the *left* edge rather than the centre. A centred carousel
 * spends half the screen on the item you have already passed; anchoring left
 * means the focused cover starts at the page margin, where the eye already is,
 * and the row reads as "this one, then what's next" rather than as a wheel.
 *
 * Scale is driven by scroll position rather than by a selected index, so the
 * growth is continuous under the finger instead of snapping when a threshold is
 * crossed. Each card interpolates its own scale from one shared scroll value —
 * the work happens on the UI thread, so a fast flick does not drop the effect.
 */
export function DiscoverCarousel({ entries, loading = false }: DiscoverCarouselProps) {
  const { width } = useWindowDimensions();
  const scrollX = useSharedValue(0);

  const cardWidth = Math.min(
    CARD_MAX_WIDTH,
    Math.round(Math.min(width, MaxContentWidth) * CARD_WIDTH_RATIO)
  );
  const stride = cardWidth + Spacing.x12;
  // The tallest a card ever gets: art plus its caption, unscaled.
  const artHeight = Math.round(cardWidth / PosterAspectRatio);

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.set(event.contentOffset.x);
  });

  if (loading) {
    return (
      <View style={[styles.rail, { paddingLeft: Spacing.x16 }]}>
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} width={cardWidth} height={artHeight} radius={Radius.image} />
        ))}
      </View>
    );
  }

  if (entries.length === 0) return null;

  return (
    <Animated.ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={16}
      // Snapping to the stride is what makes "leftmost" a real position rather
      // than wherever the flick happened to stop.
      snapToInterval={stride}
      decelerationRate="fast"
      contentContainerStyle={styles.content}>
      {entries.map((entry, index) => (
        <CarouselCard
          key={entry.gameId}
          entry={entry}
          index={index}
          stride={stride}
          width={cardWidth}
          scrollX={scrollX}
        />
      ))}
    </Animated.ScrollView>
  );
}

function CarouselCard({
  entry,
  index,
  stride,
  width,
  scrollX,
}: {
  entry: ChartEntry;
  index: number;
  stride: number;
  width: number;
  scrollX: ReturnType<typeof useSharedValue<number>>;
}) {
  /*
   * Two input points, not three.
   *
   * At `index * stride` this card is the leftmost one — full size. One stride
   * earlier it is the card *beside* the focused one — small. Past its own
   * offset it has scrolled off the left edge, so the range clamps and it simply
   * stays large rather than shrinking again on the way out, which a symmetric
   * three-point range would do visibly at the screen edge.
   */
  const animated = useAnimatedStyle(() => {
    const range = [(index - 1) * stride, index * stride];
    return {
      transform: [
        {
          scale: interpolate(scrollX.get(), range, [MIN_SCALE, 1], Extrapolation.CLAMP),
        },
      ],
      opacity: interpolate(scrollX.get(), range, [MIN_OPACITY, 1], Extrapolation.CLAMP),
    };
  });

  return (
    <Animated.View style={[{ width }, animated]}>
      <Link href={{ pathname: '/game/[id]', params: { id: entry.gameId } }} asChild>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`${entry.title}${entry.releaseYear ? `, ${entry.releaseYear}` : ''}`}
          scaleTo={0.97}
          style={styles.card}>
          <Poster
            coverUrl={entry.coverUrl}
            heroUrl={entry.heroUrl}
            title={entry.title}
            width={width}
            rounded="image"
          />

          <View style={styles.caption}>
            <Text variant="h5" numberOfLines={1}>
              {entry.title}
            </Text>
            {entry.releaseYear !== null && (
              <Text variant="caption" color="textMuted">
                {entry.releaseYear}
              </Text>
            )}
          </View>
        </PressableScale>
      </Link>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /*
   * The trailing padding is a whole screen wide so the *last* cover can still
   * reach the left focal point. Without it the rail runs out of scroll while
   * the final card is still parked on the right at reduced size, permanently
   * unfocusable.
   */
  content: { paddingLeft: Spacing.x16, paddingRight: '100%', gap: Spacing.x12 },
  rail: { flexDirection: 'row', gap: Spacing.x12 },
  card: { gap: Spacing.x8 },
  caption: { gap: 1 },
});
