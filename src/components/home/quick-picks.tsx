import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { memo, useMemo } from 'react';
import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Game } from '@/lib/games';

/** `GridCells.Fixed(4)` over `height(256.dp)`: four rows of 64. */
const ROWS = 4;
const ROW_HEIGHT = 64;
/** The square of art at the head of a row, `size(44.dp)`, its corner `RoundedCornerShape(10)` — a tenth of it. */
const THUMB = 44;

/**
 * The column's width: the page less its two margins, less 30 — `widthDp - 30.dp`
 * — so the next column shows at the edge and says the grid goes on.
 */
function columnWidth(display: number): number {
  return display - Spacing.x16 * 2 - 30;
}

/**
 * Quick picks — SimpMusic's (`HomeScreen.kt`'s `QuickPicks`, `QuickPicksItem`):
 * not covers in a row but a grid of **rows**, four to a column, the columns
 * sliding sideways and snapping to their starts, each column a little narrower
 * than the page so the next one shows.
 *
 * A row is the reference's: a 44 square of the art, sixteen to the words, the
 * name on one line and under it — where a song has its artist — the game's
 * developer and year. The square is the box art's middle: IGDB publishes no
 * square, and asking SteamGridDB for twenty of them to fill a 44dp thumbnail
 * is twenty lookups for a picture the size of a fingertip. A tap opens the
 * game.
 *
 * The heading is the section's (`<HomeSection>`), as the reference's is its
 * own two lines: a small one over "Quick picks".
 */
export function QuickPicks({ games }: { games: readonly Game[] }) {
  const { width: display } = useWindowDimensions();
  const width = columnWidth(display);
  const columns = useMemo(() => {
    const out: Game[][] = [];
    for (let index = 0; index < games.length; index += ROWS)
      out.push(games.slice(index, index + ROWS));
    return out;
  }, [games]);

  return (
    <FlatList
      horizontal
      data={columns}
      keyExtractor={(column) => column[0].id}
      renderItem={({ item }) => <Column games={item} width={width} />}
      showsHorizontalScrollIndicator={false}
      snapToInterval={width}
      snapToAlignment="start"
      decelerationRate="fast"
      disableIntervalMomentum
      style={styles.list}
      contentContainerStyle={styles.content}
    />
  );
}

const Column = memo(function Column({ games, width }: { games: readonly Game[]; width: number }) {
  return (
    <View style={{ width }}>
      {games.map((game) => (
        <PickRow key={game.id} game={game} />
      ))}
    </View>
  );
});

function PickRow({ game }: { game: Game }) {
  const theme = useTheme();
  const router = useRouter();
  const line = [game.developer, game.releaseYear].filter(Boolean).join(' · ');

  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={line ? `${game.title}, ${line}` : game.title}
      onPress={() => router.push({ pathname: '/game/[id]', params: { id: game.id } })}
      scaleTo={0.98}
      pressedColor={theme.controlPressed}
      style={styles.row}>
      <Image
        source={game.coverUrl ? { uri: game.coverUrl } : undefined}
        recyclingKey={game.coverUrl ?? game.id}
        cachePolicy="memory-disk"
        contentFit="cover"
        transition={220}
        style={[styles.thumb, { backgroundColor: theme.skeleton }]}
        accessibilityIgnoresInvertColors
      />
      <View style={styles.words}>
        <Text variant="itemTitle" numberOfLines={1}>
          {game.title}
        </Text>
        {!!line && (
          /* `textSecondary`: the grid can stand in the glow. */
          <Text variant="bodySmall" color="textSecondary" numberOfLines={1}>
            {line}
          </Text>
        )}
      </View>
    </PressableScale>
  );
}

/** Quick picks while they load: the first column's four rows, in their shape. */
export function QuickPicksSkeleton() {
  const { width: display } = useWindowDimensions();
  return (
    <View style={[styles.content, { width: columnWidth(display) + Spacing.x16 }]}>
      {Array.from({ length: ROWS }).map((_, index) => (
        <View key={index} style={styles.row}>
          <Skeleton width={THUMB} height={THUMB} />
          <View style={styles.words}>
            <Skeleton width="70%" height={13} />
            <Skeleton width="45%" height={11} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 0 },
  content: { paddingHorizontal: Spacing.x16 },
  /* `padding(10.dp)` round a 44 square: a row of 64. The row's own padding puts
     the art 10 in from the column's edge, as the reference's does. */
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 10,
    borderRadius: Radius.lg,
  },
  thumb: { width: THUMB, height: THUMB, borderRadius: THUMB / 10 },
  words: { flex: 1, gap: 3 },
});
