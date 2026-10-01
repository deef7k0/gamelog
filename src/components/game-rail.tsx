import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import { Poster } from '@/components/ui/poster';
import { ArtRail, useSectionInset, useSectionMetrics } from '@/components/ui/section';
import { Skeleton } from '@/components/ui/surface';
import { Radius, Type } from '@/constants/theme';
import { useRailDrift } from '@/hooks/use-rail-drift';
import type { GameSearchResult } from '@/lib/games';

/** What a cover rail needs of a game — a search result, a full record, a chart row. */
export type CoverRailGame = Pick<
  GameSearchResult,
  'id' | 'title' | 'coverUrl' | 'heroUrl' | 'edition' | 'releaseYear'
> & {
  /** Steam's own capsule, where there is one; IGDB's cover otherwise. */
  steamAppId?: string | null;
};

/**
 * Games in a row, the one way the app draws one: the game page's franchise and
 * editions, taken everywhere a row of games appears — Home, Search, a studio.
 *
 * SimpMusic's "Singles" and "Albums" rails with box art in place of album
 * squares (`<ArtRail>`, shape `cover`): each cover at the albums' height, its
 * title under it in two lines always held open, and one quiet line under that —
 * the release year unless the caller says otherwise (a studio, a rank).
 *
 * This replaced three rails that each had their own sizes: the 92dp poster
 * rail, Home's captioned card rail and Search's chart carousel. A cover is now
 * one size and one shape on every screen that shows a row of them. These are
 * browsing surfaces, so they use `<Poster />`; `<GameCase />` is reserved for a
 * game's own page — see the rule in CLAUDE.md.
 */
export function GameCoverRail<T extends CoverRailGame>({
  games,
  subtitleOf = (game) => (game.releaseYear === null ? null : String(game.releaseYear)),
  labelOf,
  inset,
  parallax = false,
}: {
  games: readonly T[];
  subtitleOf?: (game: T) => string | null;
  /** What a screen reader says for a cover, when its title alone is not enough. */
  labelOf?: (game: T) => string;
  /** Where the first cover starts, when it is not the section inset in force. */
  inset?: number;
  /**
   * The art slides behind its frame as the rail moves — Home's rails, which
   * always have. Off elsewhere, and under a reduced-motion preference.
   */
  parallax?: boolean;
}) {
  const router = useRouter();

  return (
    <ArtRail
      data={games}
      keyOf={(game) => game.id}
      shape="cover"
      inset={inset}
      parallax={parallax}
      renderArt={(game, size, context) => (
        <RailCover
          game={game}
          width={size.width}
          index={context.index}
          scrollX={context.scrollX}
          leading={context.inset}
          gap={context.itemGap}
        />
      )}
      titleOf={(game) => game.title}
      subtitleOf={subtitleOf}
      labelOf={labelOf}
      onPressItem={(game) => router.push({ pathname: '/game/[id]', params: { id: game.id } })}
    />
  );
}

/** One cover, lifted out of the rail's render so it can hold `useRailDrift`. */
function RailCover({
  game,
  width,
  index,
  scrollX,
  leading,
  gap,
}: {
  game: CoverRailGame;
  width: number;
  index: number;
  scrollX: SharedValue<number> | null;
  leading: number;
  gap: number;
}) {
  const drift = useRailDrift(scrollX, index, { pitch: width + gap, leading, itemWidth: width });

  return (
    <Poster
      coverUrl={game.coverUrl}
      heroUrl={game.heroUrl}
      title={game.title}
      edition={game.edition}
      steamAppId={game.steamAppId}
      width={width}
      rounded="image"
      parallax={drift}
    />
  );
}

/**
 * The rail's shape while its games load: the same covers and the same two
 * held lines, so nothing moves when the real ones arrive.
 */
export function CoverRailSkeleton({ count = 4, inset }: { count?: number; inset?: number }) {
  const metrics = useSectionMetrics();
  const contextInset = useSectionInset();
  const { width, height } = metrics.cover;

  return (
    <View
      style={[
        styles.skeleton,
        {
          paddingLeft: inset ?? contextInset,
          paddingTop: metrics.artTop,
          gap: metrics.itemGap,
        },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={{ width, gap: metrics.titleTop }}>
          <Skeleton width={width} height={height} radius={Radius.image} />
          <Skeleton width={width * 0.8} height={Type.itemTitle.lineHeight - 6} />
          <Skeleton width={width * 0.4} height={Type.bodySmall.lineHeight - 5} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  /* Clipped rather than scrolled: four covers run off the right edge as the
     real rail's do. */
  skeleton: { flexDirection: 'row', overflow: 'hidden' },
});
