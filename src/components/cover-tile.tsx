import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';

export type CoverTileGame = {
  /** App-wide `${source}:${sourceId}` id. */
  id: string;
  title: string;
  coverUrl: string | null;
  heroUrl: string | null;
  releaseYear: number | null;
};

export type CoverTileProps = {
  game: CoverTileGame;
  /** Full width of the column this tile occupies, art and caption together. */
  width: number;
  /** Position in an ordered chart. Omitted for unordered lists. */
  rank?: number;
};

/**
 * Box art, then the title and the year. Nothing else.
 *
 * The unit a chart or a curated shelf is built from: no card, no surface, no
 * pill — the artwork is the object, and wrapping it in one of the app's rounded
 * containers turns a wall of covers into a list of buttons that happen to have
 * pictures on them. Where a row needs a background (a feed item, a search
 * result) that is `<GameListItem>`; this is for grids where the art carries the
 * screen.
 *
 * A rank, when there is one, is set in muted micro type beside the cover rather
 * than as a numbered badge. The order is already legible from the layout; the
 * numeral is a confirmation, not the headline.
 */
export function CoverTile({ game, width, rank }: CoverTileProps) {
  // Art takes a bit over a third of the column. Wide enough to read as a cover
  // at a glance, narrow enough to leave two lines of title beside it on a phone.
  const artWidth = Math.min(84, Math.max(52, Math.round(width * 0.38)));

  return (
    <Link href={{ pathname: '/game/[id]', params: { id: game.id } }} asChild>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={rank ? `Number ${rank}, ${game.title}` : game.title}
        scaleTo={0.96}
        style={StyleSheet.flatten([styles.tile, { width }])}>
        {rank !== undefined && (
          <Text variant="micro" color="textMuted" style={styles.rank}>
            {rank}
          </Text>
        )}

        <Poster
          coverUrl={game.coverUrl}
          heroUrl={game.heroUrl}
          title={game.title}
          width={artWidth}
          rounded="image"
        />

        <View style={styles.caption}>
          <Text variant="bodyStrong" numberOfLines={2}>
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
  tile: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  /* Fixed width so titles line up down the column whatever the rank's digits. */
  rank: { width: 14, textAlign: 'right' },
  caption: { flex: 1, gap: 2 },
});
