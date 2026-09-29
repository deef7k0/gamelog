import { Link, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ArtRail } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useRailDrift, type RailGeometry } from '@/hooks/use-rail-drift';
import type { GameSearchResult } from '@/lib/games';

const RAIL_POSTER = 92;

/**
 * Posters rendered before the rail is scrolled: the four a phone shows, and two
 * more. After that the rail keeps one screen either side (`windowSize` 3). The
 * list defaults rendered — and downloaded — every poster however far off the
 * right edge; a publisher's remasters rail on the studio page holds dozens.
 */
const RAIL_FIRST = 6;

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
      initialNumToRender={RAIL_FIRST}
      windowSize={3}
      renderItem={({ item, index }) => <RailPoster game={item} index={index} scrollX={driver} />}
    />
  );
}

/** What a cover rail needs of a game — a search result or a full record. */
export type CoverRailGame = Pick<
  GameSearchResult,
  'id' | 'title' | 'coverUrl' | 'heroUrl' | 'edition' | 'releaseYear'
>;

/**
 * Games as a game page's section draws them: SimpMusic's "Singles" and
 * "Albums" rails with box art in place of album squares — each cover at the
 * albums' height (`<ArtRail>`, shape `cover`), its title under it and one quiet
 * line under that, the release year unless the caller says otherwise.
 *
 * The rail for the sections of a game's own page. Home, the studio page and
 * the other bands keep `<GamePosterRail>`: they are lists of many games, where
 * art this size would show two at a time.
 */
export function GameCoverRail({
  games,
  subtitleOf = (game) => (game.releaseYear === null ? null : String(game.releaseYear)),
  labelOf,
}: {
  games: readonly CoverRailGame[];
  subtitleOf?: (game: CoverRailGame) => string | null;
  /** What a screen reader says for a cover, when its title alone is not enough. */
  labelOf?: (game: CoverRailGame) => string;
}) {
  const router = useRouter();

  return (
    <ArtRail
      data={games}
      keyOf={(game) => game.id}
      shape="cover"
      renderArt={(game, size) => (
        <Poster
          coverUrl={game.coverUrl}
          heroUrl={game.heroUrl}
          title={game.title}
          edition={game.edition}
          width={size.width}
          rounded="image"
        />
      )}
      titleOf={(game) => game.title}
      subtitleOf={subtitleOf}
      labelOf={labelOf}
      onPressItem={(game) => router.push({ pathname: '/game/[id]', params: { id: game.id } })}
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

const styles = StyleSheet.create({
  rail: { gap: Spacing.x12, paddingRight: Spacing.x16 },
  railItem: { width: RAIL_POSTER, gap: 2 },
});
