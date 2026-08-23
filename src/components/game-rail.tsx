import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useRailDrift, type RailGeometry } from '@/hooks/use-rail-drift';
import { useTheme } from '@/hooks/use-theme';
import type { GameCharacter } from '@/lib/games/igdb';
import type { GameSearchResult } from '@/lib/games';

const RAIL_POSTER = 92;
const CAST_AVATAR = 56;

/**
 * Where each poster sits. `leading` is 0 because `styles.rail` pads only its
 * right edge — this rail bleeds off the left of the display by design.
 */
const RAIL_GEOMETRY: RailGeometry = {
  pitch: RAIL_POSTER + Spacing.x12,
  leading: 0,
  itemWidth: RAIL_POSTER,
};

/**
 * Horizontal rails shared by the game Overview tab, the studio catalogue and the
 * franchise section.
 *
 * These are browsing surfaces, so they use `<Poster />`. `<GameCase />` is
 * reserved for dedicated game pages — see the rule in CLAUDE.md.
 */

export function GamePosterRail({
  games,
  emptyLabel,
  parallax = false,
}: {
  games: GameSearchResult[];
  emptyLabel?: string;
  /**
   * Let the artwork sit behind its frame and slide as the rail moves. Off by
   * default: this rail also serves the game page's franchise and studio bands,
   * and Home is the only screen that asked for the effect. Ignored under a
   * reduced-motion preference.
   */
  parallax?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const scrollX = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.set(event.contentOffset.x);
  });

  const driver = parallax && !reduceMotion ? scrollX : null;

  if (games.length === 0) {
    return emptyLabel ? (
      <Text variant="bodySmall" color="textMuted">
        {emptyLabel}
      </Text>
    ) : null;
  }

  return (
    <Animated.FlatList
      data={games}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(game) => game.id}
      contentContainerStyle={styles.rail}
      onScroll={driver ? onScroll : undefined}
      scrollEventThrottle={16}
      renderItem={({ item, index }) => <RailPoster game={item} index={index} scrollX={driver} />}
    />
  );
}

/** One poster, lifted out of `renderItem` so it can hold `useRailDrift`. */
function RailPoster({
  game,
  index,
  scrollX,
}: {
  game: GameSearchResult;
  index: number;
  scrollX: SharedValue<number> | null;
}) {
  const drift = useRailDrift(scrollX, index, RAIL_GEOMETRY);

  return (
    <Link href={{ pathname: '/game/[id]', params: { id: game.id } }} asChild>
      <PressableScale accessibilityRole="button" accessibilityLabel={game.title} scaleTo={0.95}>
        <View style={styles.railItem}>
          <Poster
            coverUrl={game.coverUrl}
            heroUrl={game.heroUrl}
            title={game.title}
            edition={game.edition}
            steamAppId={game.steamAppId}
            width={RAIL_POSTER}
            rounded="image"
            parallax={drift}
          />
          <Text variant="caption" numberOfLines={2}>
            {game.title}
          </Text>
          {game.releaseYear !== null && (
            <Text variant="caption" color="textMuted">
              {game.releaseYear}
            </Text>
          )}
        </View>
      </PressableScale>
    </Link>
  );
}

/**
 * Cast rail — circular portraits with the character name underneath.
 *
 * `actor` is rendered when a provider supplies it and quietly omitted when not.
 * IGDB never does: its v4 API dropped the `credits` endpoint and exposes no
 * actor data, so on IGDB-sourced games this shows characters only. That is a
 * data limitation, not a layout decision, which is why the row is built to take
 * a second line rather than assuming one.
 */
export function CastRail({ cast }: { cast: GameCharacter[] }) {
  const theme = useTheme();
  if (cast.length === 0) return null;

  return (
    <FlatList
      data={cast}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(person) => String(person.id)}
      contentContainerStyle={styles.rail}
      renderItem={({ item }) => (
        <View style={styles.castItem}>
          <View style={[styles.castAvatar, { backgroundColor: theme.surfaceElevated }]}>
            {item.portraitUrl ? (
              <Image
                source={{ uri: item.portraitUrl }}
                recyclingKey={String(item.id)}
                cachePolicy="memory-disk"
                style={styles.fill}
                contentFit="cover"
                transition={180}
                accessibilityIgnoresInvertColors
              />
            ) : (
              <Text variant="h3" color="textMuted">
                {item.name.trim().charAt(0).toUpperCase()}
              </Text>
            )}
          </View>

          <Text variant="caption" numberOfLines={2} style={styles.castName}>
            {item.name}
          </Text>

          {item.actor && (
            <Text variant="caption" color="textMuted" numberOfLines={1} style={styles.castName}>
              {item.actor}
            </Text>
          )}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  rail: { gap: Spacing.x12, paddingRight: Spacing.x16 },
  railItem: { width: RAIL_POSTER, gap: 2 },
  castItem: { width: CAST_AVATAR + 12, alignItems: 'center', gap: Spacing.x4 },
  castAvatar: {
    width: CAST_AVATAR,
    height: CAST_AVATAR,
    borderRadius: Radius.pill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: { width: '100%', height: '100%' },
  castName: { textAlign: 'center' },
});
