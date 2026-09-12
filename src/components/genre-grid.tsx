import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { GAME_GENRES, type GameGenre } from '@/constants/game-genres';
import { identityColorFor } from '@/constants/identity';
import { Elevation, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getGenres } from '@/lib/games';

/** Two across, matching the grid this was drawn from. */
const COLUMNS = 2;

/**
 * Browse the catalogue by genre — ten tiles, at the top of Search.
 *
 * ## What this is for
 *
 * Search could only be used by someone who already knew what they wanted to
 * type. Everything else on the screen answers "what is popular" or "what is like
 * the thing you played"; nothing answered "show me racing games", which is the
 * one browse a catalogue of three hundred thousand titles most obviously owes
 * its reader. Ten tiles is ten queries nobody has to spell.
 *
 * ## The colour
 *
 * Read from `identityColorFor`, the same function that gives a game's own page
 * its hue — so a Shooter tile is ember, and so is every Shooter page behind it.
 * Colour on this screen is therefore *identity*, one of the three sanctioned
 * sources in DESIGN.md § 1.4, rather than ten decorative swatches.
 *
 * It tints the **glyph only**. A grid of ten filled colour blocks would be the
 * loudest thing in an app whose subject is box art, and it would put ten
 * saturated rectangles directly above a rail of covers — the same reasoning that
 * keeps `<Chip>` fills grey.
 *
 * ## Why the ids are fetched rather than written down
 *
 * IGDB owns the vocabulary. `getGenres()` is cached for the session (it changes
 * about once a year), and a tile whose genre IGDB no longer returns is dropped
 * rather than rendered as a door to nothing. The grid renders its full shape
 * while that request is in flight — the labels and colours are local, so only
 * the destination is waiting on the network.
 */
export function GenreGrid() {
  const genres = useQuery({
    queryKey: ['igdb', 'genres'],
    queryFn: ({ signal }) => getGenres(signal),
    staleTime: Infinity,
    gcTime: Infinity,
  });

  /* Resolve each curated entry against IGDB's live names. A tile with no id is
     still drawn but is not tappable — the alternative is a grid that pops into
     existence a beat after the screen, which is worse than one that fills in. */
  const tiles = GAME_GENRES.map((genre) => ({
    genre,
    id: genres.data?.find((tag) => tag.name.toLowerCase().includes(genre.match))?.id ?? null,
  })).filter((tile) => !genres.isSuccess || tile.id !== null);

  if (tiles.length === 0) return null;

  return (
    <View style={styles.grid}>
      {tiles.map(({ genre, id }) => (
        <GenreTile key={genre.match} genre={genre} genreId={id} />
      ))}
    </View>
  );
}

function GenreTile({ genre, genreId }: { genre: GameGenre; genreId: number | null }) {
  const theme = useTheme();
  const tint = identityColorFor([genre.identity], theme);

  const card = (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${genre.label} games`}
      accessibilityState={{ disabled: genreId === null }}
      disabled={genreId === null}
      scaleTo={0.97}
      style={StyleSheet.flatten([
        styles.tile,
        Elevation.card,
        { backgroundColor: theme.surface, opacity: genreId === null ? 0.5 : 1 },
      ])}>
      {/* The label leads and the glyph trails, which is the reading order of the
          grid this follows: the word is the content and the icon is the mark. */}
      <Text variant="h5" style={styles.label} numberOfLines={2}>
        {genre.label}
      </Text>
      <Ionicons name={genre.icon} size={28} color={tint} />
    </PressableScale>
  );

  if (genreId === null) return card;

  return (
    <Link
      href={{ pathname: '/genre/[id]', params: { id: String(genreId), name: genre.label } }}
      asChild>
      {card}
    </Link>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.x8,
    paddingHorizontal: Spacing.x16,
  },
  /*
   * Two per row, without hard-coding a width.
   *
   * `minWidth` just over 45% is what forces the wrap — three tiles cannot fit —
   * and `flexGrow` then shares out whatever the gap leaves, so the pair lines up
   * flush with the covers below at every display width. A literal `width: '48%'`
   * would leave a different sliver on every device.
   */
  tile: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: `${100 / COLUMNS - 5}%`,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.x8,
    minHeight: 72,
    paddingVertical: Spacing.x16,
    paddingHorizontal: Spacing.x16,
    borderRadius: Radius.card,
  },
  /* `flexShrink` so a two-line label ("Role-playing") wraps instead of pushing
     the glyph off the tile. */
  label: { flexShrink: 1 },
});
