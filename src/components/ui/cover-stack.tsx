import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Poster } from '@/components/ui/poster';
import { Text } from '@/components/ui/text';
import { STACK_SHADE, STACK_SIZE, stackLayout } from '@/constants/cover-stack';
import { Palette, Radius, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** The shadow a cover casts on the one behind it, read from left to right. */
const SHADE_LEFT = [
  withAlpha(Palette.shadowInk, 0),
  withAlpha(Palette.shadowInk, STACK_SHADE.depth),
] as const;
const SHADE_RIGHT = [
  withAlpha(Palette.shadowInk, STACK_SHADE.depth),
  withAlpha(Palette.shadowInk, 0),
] as const;
const ACROSS = { start: { x: 0, y: 0 }, end: { x: 1, y: 0 } } as const;

export type StackCover = {
  /** Stable per game: a recycled row must not show the last game's art. */
  id: string;
  title?: string | null;
  coverUrl?: string | null;
  heroUrl?: string | null;
};

export type CoverStackProps = {
  /** In order of standing: the first is drawn in front, in the middle. Five at most are shown. */
  covers: readonly StackCover[];
  /**
   * The row it stands in. The stack is as wide as this: five covers span it
   * edge to edge, and fewer stand in the middle of it.
   */
  width: number;
  /** The letter on the placeholder, for a stack with nothing in it. */
  title?: string | null;
};

/**
 * Up to five covers as one stack: the first whole and in front, the rest behind
 * it either side — five from one edge of the row to the other, fewer in its
 * middle.
 *
 * The owner's reference — see `constants/cover-stack`, which holds the geometry
 * and its tests. This draws it: each cover is a `<Poster>`, so it has the box
 * art's own corner, the edge every cover in the app wears, and the cache keys
 * that stop a recycled row flashing the wrong game.
 *
 * ## It is as wide as its row, and the centring is its own
 *
 * It used to be as wide as its covers and stand wherever its caller put it,
 * which was the left edge — so a collection of three left a third of the row
 * empty. The owner had a short stack centred, and the place for that is here:
 * the view is the row, the covers are placed from its left edge with the
 * centring already in the figure (`StackPlace.left`), and no caller can forget
 * to do it. A full stack needs none: it is the row.
 *
 * ## The shadow is drawn, and by the cover that casts it
 *
 * In the reference a cover darkens the one behind it for a few pixels beside
 * its own edge. That is a strip of gradient, not an elevation: Android's
 * elevation shadow falls downward from a light overhead, and five covers
 * standing level with each other have no "below" to cast on.
 *
 * The strip belongs to the cover **in front** and hangs outside its edge, over
 * its neighbour. The other way round — a strip laid on the cover behind — is
 * the obvious way and does not work on Android: a `<Poster>` carries elevation,
 * and Android paints a view's children in order of elevation rather than in the
 * order they were written, so a flat strip written after an elevated cover is
 * painted *under* it. A cover's wrapper has no elevation, so the wrappers do
 * paint in the order they are written, and whatever the front one draws lands
 * on top of the one behind.
 *
 * `collapsable={false}` is what keeps that true. A wrapper that only positions
 * its child is exactly what the renderer flattens away, and flattened, all five
 * covers and their strips become children of one view and are sorted by
 * elevation together.
 *
 * Presentational: it takes no touches. What a press on it does is its caller's.
 */
export const CoverStack = memo(function CoverStack({ covers, width, title }: CoverStackProps) {
  const theme = useTheme();
  const shown = covers.slice(0, STACK_SIZE);
  const layout = stackLayout(shown.length, width);
  const shade = Math.max(2, Math.round(layout.cover.width * STACK_SHADE.width));

  if (shown.length === 0) {
    /* Nothing in it yet. One cover's worth of the app's well with the
       collection's initial, where the front cover would stand, so the card is
       as tall as its neighbours and reads as a collection with no games rather
       than as art that did not load. */
    return (
      <View style={{ width, height: layout.height }}>
        <View
          style={[
            styles.empty,
            layout.cover,
            { left: layout.inset },
            { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
          ]}>
          <Text variant="h1" color="textMuted">
            {(title ?? '?').trim().charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ width, height: layout.height }} pointerEvents="none">
      {layout.places.map((place) => {
        const cover = shown[place.index];
        return (
          <View key={cover.id} collapsable={false} style={[styles.place, { left: place.left }]}>
            {place.shadesLeft && (
              <LinearGradient
                colors={SHADE_LEFT}
                {...ACROSS}
                style={[styles.shade, { width: shade, left: -shade }]}
              />
            )}
            {place.shadesRight && (
              <LinearGradient
                colors={SHADE_RIGHT}
                {...ACROSS}
                style={[styles.shade, { width: shade, left: layout.cover.width }]}
              />
            )}
            {/* No `gameId`: a collection's covers and a profile's shelf do not
                wear the Must Play mark (CLAUDE.md § Labels). */}
            <Poster
              coverUrl={cover.coverUrl}
              heroUrl={cover.heroUrl}
              title={cover.title}
              width={layout.cover.width}
            />
          </View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  place: { position: 'absolute', top: 0 },
  shade: { position: 'absolute', top: 0, bottom: 0 },
  empty: {
    position: 'absolute',
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.image,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
