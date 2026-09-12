import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { PlatformMarks } from '@/components/ui/platform-chip';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { platformFamilies } from '@/constants/platform-family';
import { Spacing } from '@/constants/theme';
import { useRailDrift, type RailGeometry } from '@/hooks/use-rail-drift';
import type { GameSearchResult } from '@/lib/games';

/**
 * Cover width for a captioned rail.
 *
 * Much larger than `<GamePosterRail>`'s 92 — this is the band Home leads with,
 * and a rail of thumbnails does not lead anything. At 132 two and a bit covers
 * are visible on a 390pt phone, which is the proportion that says "this scrolls"
 * without the third one being a sliver.
 *
 * A fixed dp value, deliberately, like every other artwork size in the app: the
 * spacing ladder can be retuned without the art moving. See CLAUDE.md.
 */
const COVER_WIDTH = 132;

/**
 * Gap between cards.
 *
 * Deliberately wider than the 12 the app's other rails use. Each card here is
 * three stacked elements rather than one, so the gap has to beat the internal
 * spacing or the caption of one card reads as belonging to the cover beside it.
 */
const CARD_GAP = 16;

/**
 * Where each card sits, without measuring one.
 *
 * `leading` is `styles.rail`'s own `paddingHorizontal`; if that padding or the
 * two constants above change, this follows them automatically, which is the
 * reason it is derived here rather than typed as three numbers.
 */
const CARD_GEOMETRY: RailGeometry = {
  pitch: COVER_WIDTH + CARD_GAP,
  leading: Spacing.x16,
  itemWidth: COVER_WIDTH,
};

export type GameCardRailProps = {
  games: readonly GameSearchResult[];
  loading?: boolean;
  /** Placeholder cards while loading. Matches what the band usually returns. */
  skeletonCount?: number;
  /**
   * Let the artwork sit behind its frame and slide as the rail moves.
   *
   * Opt-in per call site rather than always on, because this rail is not only
   * Home's — turning it on everywhere would change screens nobody asked about.
   * Ignored when the OS reports a reduced-motion preference, in which case the
   * rail renders exactly as it does without this prop.
   */
  parallax?: boolean;
};

/**
 * A horizontal rail of games, each captioned with its title and studio.
 *
 * The difference from `<GamePosterRail>` is the caption, and it is the reason
 * this exists separately rather than as a prop: the moment artwork carries two
 * lines of text under it, the cover has to grow to keep the block from reading
 * as a caption with a picture attached, and the gap has to grow to keep two
 * cards apart. Those three numbers only work together, so they live together.
 *
 * **The title never wraps.** A two-line title pushes the studio down and the
 * cards in a row stop sharing a baseline, which is far more visible than a
 * truncated name — so it truncates, and the studio under it does too.
 */
export function GameCardRail({
  games,
  loading = false,
  skeletonCount = 5,
  parallax = false,
}: GameCardRailProps) {
  const reduceMotion = useReducedMotion();
  const scrollX = useSharedValue(0);

  /* Written on the UI thread, read on the UI thread. A drag never enters JS,
     so this rail keeps its parallax while the page above it is still rendering
     news cards — which is exactly when a scroll handler in JS would stutter. */
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.set(event.contentOffset.x);
  });

  const driver = parallax && !reduceMotion ? scrollX : null;

  if (loading) {
    return (
      <View style={styles.rail}>
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <View key={index} style={styles.card}>
            <Skeleton width={COVER_WIDTH} height={COVER_WIDTH / (2 / 3)} />
            <View style={styles.captionSkeleton}>
              <Skeleton width={COVER_WIDTH - 20} height={12} />
              <Skeleton width={COVER_WIDTH - 56} height={10} />
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <Animated.FlatList
      data={games as GameSearchResult[]}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(game) => game.id}
      contentContainerStyle={styles.rail}
      onScroll={driver ? onScroll : undefined}
      scrollEventThrottle={16}
      renderItem={({ item, index }) => <GameCard game={item} index={index} scrollX={driver} />}
    />
  );
}

/**
 * One card, as its own component so it may hold a hook.
 *
 * `renderItem` returning inline JSX cannot call `useRailDrift` — a hook inside
 * a render callback is a hook inside a loop. Lifting the row out is the whole
 * reason this exists; nothing about the markup changed.
 */
function GameCard({
  game,
  index,
  scrollX,
}: {
  game: GameSearchResult;
  index: number;
  scrollX: SharedValue<number> | null;
}) {
  const drift = useRailDrift(scrollX, index, CARD_GEOMETRY);

  return (
    <Link href={{ pathname: '/game/[id]', params: { id: game.id } }} asChild>
      <PressableScale
        accessibilityRole="button"
        /* The visible caption is two separate Texts, which a screen reader
           would otherwise read as two unrelated fragments after the title. */
        accessibilityLabel={game.developer ? `${game.title}, by ${game.developer}` : game.title}
        scaleTo={0.96}
        style={styles.card}>
        <Poster
          coverUrl={game.coverUrl}
          heroUrl={game.heroUrl}
          title={game.title}
          edition={game.edition}
          steamAppId={game.steamAppId}
          width={COVER_WIDTH}
          rounded="image"
          parallax={drift}
        />

        <View style={styles.caption}>
          <Text variant="h5" numberOfLines={1} ellipsizeMode="tail">
            {game.title}
          </Text>
          {/* The studio is the second fact, so it is the quiet one: same
              size, regular weight, muted. Falling back to the year rather
              than leaving a hole keeps every card the same height, which is
              what lets the row share a baseline. */}
          <Text variant="bodySmall" color="textMuted" numberOfLines={1} ellipsizeMode="tail">
            {game.developer ?? (game.releaseYear ? String(game.releaseYear) : '—')}
          </Text>

          {/* Third line, and every card gets one so the row keeps its shared
              baseline — a card with no known platforms renders nothing here and
              is the same height, exactly as the studio line falls back rather
              than collapsing. Marks only: a 132dp card cannot hold capsules. */}
          <PlatformMarks families={platformFamilies(game.platforms)} />
        </View>
      </PressableScale>
    </Link>
  );
}

const styles = StyleSheet.create({
  rail: { gap: CARD_GAP, paddingHorizontal: Spacing.x16 },
  card: { width: COVER_WIDTH, gap: Spacing.x8 },
  /* 2px, not a ladder step. The title and the studio are one caption block, and
     any real gap between them makes them read as two separate facts. */
  caption: { gap: 2 },
  captionSkeleton: { gap: Spacing.x4 },
});
