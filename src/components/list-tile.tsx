import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { displayNameFor } from '@/lib/format';
import type { ListSummary } from '@/lib/api';

/** One square of the mosaic, and the gap that keeps the four apart. */
const SQUARE = 46;
const SQUARE_GAP = 4;
/** The mosaic: two squares and the gap between them, each way. */
const MOSAIC = SQUARE * 2 + SQUARE_GAP;
/** The kind's mark on the title line. */
const KIND_GLYPH = 13;

/** No covers yet: the summary a restored cache row may still be missing them from. */
const NO_COVERS: ListSummary['stack'] = [];

export type ListTileProps = { list: ListSummary };

/**
 * A collection, wherever collections are listed: **a mosaic of four squares**
 * — each a game's portrait cover, cropped to the square, a hair apart — and
 * beside it the collection's name and two small lines in capitals.
 *
 * ```
 *  ▮▮ ▮▮   Great Games To Create Screenshots
 *  ▮▮ ▮▮   316 GAMES
 *  ▮▮ ▮▮   BY ADA
 *  ▮▮ ▮▮
 * ───────────────────────────────────────────   a hairline to the next
 * ```
 *
 * The owner's reference (2026-10-22): a list of collections from another game
 * site — "a mosaic, 4 squares with the portrait cover in each square. They are
 * slightly separated, you can make out the squares." Rows on the page with a
 * hairline between them (`<CollectionSeparator>`), not cards. It replaced the
 * review card with a stack of five covers (`<CoverStack>`, a collection's
 * tile from 2026-10-09), and the owner's earlier "remove the mosaic" — that
 * was four covers joined into one picture on the collection's *own* screen,
 * which stays one cover.
 *
 * - **The squares are 46, four apart**: the reference's mosaic is a hundred
 *   pixels of two squares and a visible gap. A cover is cropped to its middle
 *   — IGDB publishes no square, and the squares are thumbnails. The first is
 *   the collection's chosen cover (`list.stack`, the game its screen opens
 *   on), then the rest in order; a collection of fewer than four keeps the
 *   empty squares, drawn as faint tiles, so every mosaic is the same shape.
 * - **The name is `h3`, two lines at most**, top-aligned with the mosaic.
 * - **Two quiet lines in capitals**: how many games, and whose it is. The
 *   reference's second line is a count of its "cakes" — likes. A collection's
 *   likes are not on its summary and cost a request per screenful (the owner
 *   had that request removed once), so the line is the owner, whom the old
 *   card named in its byline.
 * - **No description.** It is on the collection's screen.
 */
export const ListTile = memo(function ListTile({ list }: ListTileProps) {
  const theme = useTheme();

  /*
   * `?? NO_COVERS` is for a summary written to the device before it had a
   * `stack` at all — reading `.slice` off that would close the screen.
   */
  const stack = list.stack ?? NO_COVERS;
  const squares = Array.from({ length: 4 }, (_, index) => stack[index] ?? null);

  const owner = displayNameFor(list.owner);
  const games = `${list.itemCount} ${list.itemCount === 1 ? 'game' : 'games'}`;

  /* The shapes that are not a plain collection: which of these you are
     looking at changes what the games inside mean. */
  const kindGlyph =
    list.kind === 'awards'
      ? 'trophy'
      : list.kind === 'tier'
        ? 'layers'
        : list.kind === 'captioned'
          ? 'grid'
          : list.is_ranked
            ? 'list'
            : null;

  return (
    <Link href={{ pathname: '/list/[id]', params: { id: list.id } }} asChild>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={[list.title, games, `by ${owner}`].join(', ')}
        scaleTo={0.98}
        style={styles.row}>
        <View style={styles.mosaic}>
          {squares.map((cover, index) => (
            <View
              key={cover?.id ?? `empty-${index}`}
              style={[styles.square, { backgroundColor: theme.surfaceElevated }]}>
              {cover?.cover_url || cover?.hero_url ? (
                <Image
                  source={{ uri: (cover.cover_url ?? cover.hero_url)! }}
                  recyclingKey={cover.cover_url ?? cover.hero_url}
                  cachePolicy="memory-disk"
                  contentFit="cover"
                  transition={220}
                  style={StyleSheet.absoluteFill}
                  accessibilityIgnoresInvertColors
                />
              ) : null}
            </View>
          ))}
        </View>

        <View style={styles.words}>
          <Text variant="h3" numberOfLines={2}>
            {kindGlyph && (
              /* Inline, so it sits on the title's first line and wraps with it. */
              <Ionicons
                name={kindGlyph}
                size={KIND_GLYPH}
                color={list.kind === 'awards' ? theme.identityGold : theme.textMuted}
              />
            )}
            {kindGlyph ? ` ${list.title}` : list.title}
          </Text>
          <Text variant="body" color="textMuted" numberOfLines={1} style={styles.fact}>
            {games.toUpperCase()}
          </Text>
          <Text variant="body" color="textMuted" numberOfLines={1} style={styles.fact}>
            {`BY ${owner.toUpperCase()}`}
          </Text>
        </View>
      </PressableScale>
    </Link>
  );
});

/**
 * The hairline between two collections — every list of `<ListTile>`s uses it
 * as its separator. Module scope, so a list's separator prop is one component
 * type for the life of the list.
 */
export function CollectionSeparator() {
  const theme = useTheme();
  return <View style={[styles.separator, { backgroundColor: theme.border }]} />;
}

const styles = StyleSheet.create({
  /* The reference's rows: the mosaic and the words, twenty apart, and about as
     much air above and below as the gap the mosaic's squares are spaced by
     makes look intended. */
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.x20,
    paddingVertical: Spacing.x20,
  },
  mosaic: {
    width: MOSAIC,
    height: MOSAIC,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SQUARE_GAP,
  },
  square: { width: SQUARE, height: SQUARE, borderRadius: Radius.image, overflow: 'hidden' },
  words: { flex: 1, gap: Spacing.x4, paddingTop: 2 },
  /* Spaced capitals, as the reference's counts are; a hair of tracking keeps
     the small caps from crowding. */
  fact: { fontFamily: FontFamily.medium, letterSpacing: 0.6 },
  separator: { height: StyleSheet.hairlineWidth },
});
