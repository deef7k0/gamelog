import { Link } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';

import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
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

export type GameCardRailProps = {
  games: readonly GameSearchResult[];
  loading?: boolean;
  /** Placeholder cards while loading. Matches what the band usually returns. */
  skeletonCount?: number;
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
export function GameCardRail({ games, loading = false, skeletonCount = 5 }: GameCardRailProps) {
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
    <FlatList
      data={games as GameSearchResult[]}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(game) => game.id}
      contentContainerStyle={styles.rail}
      renderItem={({ item }) => (
        <Link href={{ pathname: '/game/[id]', params: { id: item.id } }} asChild>
          <PressableScale
            accessibilityRole="button"
            /* The visible caption is two separate Texts, which a screen reader
               would otherwise read as two unrelated fragments after the title. */
            accessibilityLabel={item.developer ? `${item.title}, by ${item.developer}` : item.title}
            scaleTo={0.96}
            style={styles.card}>
            <Poster
              coverUrl={item.coverUrl}
              heroUrl={item.heroUrl}
              title={item.title}
              width={COVER_WIDTH}
              rounded="image"
            />

            <View style={styles.caption}>
              <Text variant="h5" numberOfLines={1} ellipsizeMode="tail">
                {item.title}
              </Text>
              {/* The studio is the second fact, so it is the quiet one: same
                  size, regular weight, muted. Falling back to the year rather
                  than leaving a hole keeps every card the same height, which is
                  what lets the row share a baseline. */}
              <Text variant="bodySmall" color="textMuted" numberOfLines={1} ellipsizeMode="tail">
                {item.developer ?? (item.releaseYear ? String(item.releaseYear) : '—')}
              </Text>
            </View>
          </PressableScale>
        </Link>
      )}
    />
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
