import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import {
  DISCOVER,
  discoverGeometry,
  discoverKeyline,
  discoverScrim,
  type DiscoverGeometry,
} from '@/constants/discover-carousel';
import { MaxContentWidth, Palette, withAlpha } from '@/constants/theme';
import { useSquareCover } from '@/hooks/use-square-cover';
import { useTheme } from '@/hooks/use-theme';
import type { GameSearchResult } from '@/lib/games/types';

const SCRIM = discoverScrim();
const SCRIM_COLOURS = SCRIM.alphas.map((alpha) => withAlpha(Palette.shadowInk, alpha)) as [
  string,
  string,
  ...string[],
];
const SCRIM_LOCATIONS = SCRIM.locations as [number, number, ...number[]];

/**
 * Home's "Games for you" as SimpMusic's "Your daily discover" (the owner's,
 * 2026-10-22) — Material 3's centered hero carousel, read from
 * `HomeSectionStyles.kt`: a large card in the middle, a narrow neighbour each
 * side, every card's mask growing or shrinking as the row moves while its art
 * stays full size under it (`maskClip`), so a neighbour shows the middle of
 * its picture. The game's name and why it is here sit on the art over a
 * scrim. A swipe moves one card; tapping a neighbour brings it to the middle,
 * and tapping the middle card opens the game.
 *
 * The geometry is `constants/discover-carousel` (pure, tested). The row is a
 * scroller whose cards are drawn at the keylines on the UI thread: each card
 * is placed in the scrolled content at the scroll offset plus its keyline, so
 * it stands where Material would put it.
 *
 * The art is the game's square (SteamGridDB) where there is one, as
 * SimpMusic's are square song thumbnails, else its box art, cropped.
 */
export function DiscoverCarousel({
  games,
  because,
}: {
  games: readonly GameSearchResult[];
  because?: Record<string, string>;
}) {
  const router = useRouter();
  const { width: screen } = useWindowDimensions();
  const geometry = useMemo(() => discoverGeometry(Math.min(screen, MaxContentWidth)), [screen]);

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.set(event.contentOffset.x);
  });

  /*
   * Every render nudges the cards, so a style the native side dropped while
   * the JS thread was busy is put back the frame after — the lost-end-value
   * gotcha (CLAUDE.md), answered as the top bar answers it.
   */
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.set((value) => value + 1);
  });

  const open = (index: number) => {
    const middle = Math.round(scrollX.get() / geometry.step);
    if (middle === index) {
      router.push({ pathname: '/game/[id]', params: { id: games[index].id } });
    } else {
      scrollRef.current?.scrollTo({ x: index * geometry.step, animated: true });
    }
  };

  const contentWidth = geometry.step * Math.max(0, games.length - 1) + geometry.width;

  return (
    <Animated.ScrollView
      ref={scrollRef}
      horizontal
      onScroll={onScroll}
      scrollEventThrottle={16}
      showsHorizontalScrollIndicator={false}
      snapToInterval={geometry.step}
      disableIntervalMomentum
      decelerationRate="fast"
      style={styles.scroller}
      contentContainerStyle={{ width: contentWidth, height: DISCOVER.height }}>
      {games.map((game, index) => (
        <DiscoverCard
          key={game.id}
          game={game}
          line={lineFor(game, because)}
          index={index}
          geometry={geometry}
          scrollX={scrollX}
          pulse={pulse}
          onPress={() => open(index)}
        />
      ))}
    </Animated.ScrollView>
  );
}

/** The row while the games are on their way: the middle card and its neighbours. */
export function DiscoverCarouselSkeleton() {
  const { width: screen } = useWindowDimensions();
  const g = discoverGeometry(Math.min(screen, MaxContentWidth));
  return (
    <View style={[styles.skeleton, { width: g.width }]}>
      <Skeleton width={g.hero} height={DISCOVER.height} radius={DISCOVER.radius} />
      <View style={[styles.skeletonSide, { left: DISCOVER.padding }]}>
        <Skeleton width={g.small} height={DISCOVER.height} radius={DISCOVER.radius} />
      </View>
      <View style={[styles.skeletonSide, { right: DISCOVER.padding }]}>
        <Skeleton width={g.small} height={DISCOVER.height} radius={DISCOVER.radius} />
      </View>
    </View>
  );
}

function lineFor(game: GameSearchResult, because?: Record<string, string>): string | null {
  const seed = because?.[game.id];
  return seed ? `Similar to ${seed}` : (game.developer ?? null);
}

function DiscoverCard({
  game,
  line,
  index,
  geometry,
  scrollX,
  pulse,
  onPress,
}: {
  game: GameSearchResult;
  line: string | null;
  index: number;
  geometry: DiscoverGeometry;
  scrollX: SharedValue<number>;
  pulse: SharedValue<number>;
  onPress: () => void;
}) {
  const theme = useTheme();
  const square = useSquareCover({ gameId: game.id, title: game.title });
  const art = square.resolved ? (square.uri ?? game.coverUrl ?? game.heroUrl) : null;

  /* The mask: at the card's keyline, as wide as the keyline says. */
  const maskStyle = useAnimatedStyle(() => {
    const p = index - scrollX.get() / geometry.step;
    const { left, width } = discoverKeyline(p, geometry);
    /* A hundredth on alternate renders: a width that settled is otherwise
       never re-sent (see `pulse`). */
    const nudge = (pulse.get() % 2) * 0.01;
    return {
      width: width + nudge,
      transform: [{ translateX: scrollX.get() + left }],
    };
  });

  /* The art stays the middle card's size, centred in whatever the mask shows. */
  const contentStyle = useAnimatedStyle(() => {
    const p = index - scrollX.get() / geometry.step;
    const { width } = discoverKeyline(p, geometry);
    return { transform: [{ translateX: (width - geometry.hero) / 2 }] };
  });

  return (
    <Animated.View style={[styles.mask, { backgroundColor: theme.surfaceElevated }, maskStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={line ? `${game.title}. ${line}.` : game.title}
        accessibilityHint="Opens the game, or brings it to the middle"
        onPress={onPress}
        style={styles.fill}>
        <Animated.View style={[styles.content, { width: geometry.hero }, contentStyle]}>
          {art && (
            <Image
              source={{ uri: art }}
              style={styles.fill}
              contentFit="cover"
              transition={550}
              cachePolicy="memory-disk"
              recyclingKey={art}
              accessibilityIgnoresInvertColors
            />
          )}
          <LinearGradient
            colors={SCRIM_COLOURS}
            locations={SCRIM_LOCATIONS}
            style={styles.fill}
            pointerEvents="none"
          />
          <View style={styles.words} pointerEvents="none">
            <Text variant="h2" numberOfLines={2} style={{ color: theme.white }}>
              {game.title}
            </Text>
            {line && (
              <Text variant="body" numberOfLines={1} style={{ color: withAlpha(theme.white, 0.8) }}>
                {line}
              </Text>
            )}
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /* A horizontal scroller grows unless told not to (CLAUDE.md, gotchas). */
  scroller: { flexGrow: 0, marginTop: DISCOVER.top },
  mask: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: DISCOVER.height,
    borderRadius: DISCOVER.radius,
    overflow: 'hidden',
  },
  content: { position: 'absolute', top: 0, left: 0, bottom: 0 },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  words: {
    position: 'absolute',
    left: DISCOVER.textStart,
    right: DISCOVER.textEnd,
    bottom: DISCOVER.textBottom,
  },
  skeleton: {
    height: DISCOVER.height,
    marginTop: DISCOVER.top,
    alignItems: 'center',
  },
  skeletonSide: { position: 'absolute', top: 0 },
});
