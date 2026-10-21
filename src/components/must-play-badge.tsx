import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { GAME_LABEL_TEXT } from '@/constants/game-labels';
import { useTheme } from '@/hooks/use-theme';

/** The star's share of the wedge's side. */
const STAR_RATIO = 0.42;

export type MustPlayCornerProps = {
  /** The length of the wedge's two short sides, in dp. */
  size: number;
};

/**
 * The Must Play label on a cover (0034): a green wedge filling the cover's
 * top-right corner, its long side facing into the art, and a star in it in a
 * darker green — the owner's direction (2026-10-17). It was a round badge
 * with a face on it.
 *
 * The wedge is a zero-sized box with two borders: the top one green, the left
 * one clear. They meet on the diagonal, so the top border is the triangle
 * whose right angle is the box's top-right corner. Drawn inside the cover's
 * clip, it takes the cover's own rounded corner.
 *
 * The star stands on the triangle's centroid, a third of the side in from the
 * top and from the right.
 *
 * Presentational. Whether a game carries the label is `useGameLabel`'s to say.
 */
export function MustPlayCorner({ size }: MustPlayCornerProps) {
  const theme = useTheme();
  const star = Math.round(size * STAR_RATIO);
  const inset = size / 3 - star / 2;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={GAME_LABEL_TEXT.must_play.spoken}
      style={[styles.corner, { width: size, height: size }]}>
      <View
        style={[
          styles.wedge,
          { borderTopWidth: size, borderLeftWidth: size, borderTopColor: theme.mustPlay },
        ]}
      />
      <Ionicons
        name="star"
        size={star}
        color={theme.mustPlayStar}
        style={[styles.star, { top: inset, right: inset }]}
      />
    </View>
  );
}

export type MustPlayStarProps = {
  /** The star's size, in dp. */
  size: number;
  /**
   * Say what it is to a screen reader. Off where the star sits beside the
   * words — the stats strip's cell, the list's own heading — and would be read
   * twice.
   */
  labelled?: boolean;
};

/**
 * The Must Play mark away from a cover — the star alone, in the label's
 * green: the Must Play list's heading, the owner's direction (2026-10-17),
 * and the game page's stats strip.
 */
export function MustPlayStar({ size, labelled = true }: MustPlayStarProps) {
  const theme = useTheme();

  return (
    <View
      accessible={labelled}
      accessibilityRole={labelled ? 'image' : undefined}
      accessibilityLabel={labelled ? GAME_LABEL_TEXT.must_play.spoken : undefined}
      importantForAccessibility={labelled ? 'yes' : 'no-hide-descendants'}
      accessibilityElementsHidden={!labelled}
      style={[styles.starBox, { width: size, height: size }]}>
      <Ionicons name="star" size={size} color={theme.mustPlay} />
    </View>
  );
}

const styles = StyleSheet.create({
  corner: { position: 'relative' },
  wedge: {
    width: 0,
    height: 0,
    borderLeftColor: 'transparent',
  },
  star: { position: 'absolute' },
  starBox: { alignItems: 'center', justifyContent: 'center' },
});
