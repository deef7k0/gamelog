import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { GAME_LABEL_TEXT } from '@/constants/game-labels';
import { readableInk } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The mark itself: a face with a quiff, stars for eyes and a grin full of
 * teeth, giving a thumbs up.
 *
 * Two layers, each one colour on a transparent ground: the lines of the mark,
 * and under them the white of its grin. `assets/images/badges/must-play.svg` is
 * the source of both and says how to rasterise them. The disc and its ring are
 * drawn here and the layers are tinted here, so every colour stays in the theme
 * and retuning `mustPlay` needs no new file.
 */
const MARK = require('@/assets/images/badges/must-play.png');
const TEETH = require('@/assets/images/badges/must-play-teeth.png');

/** The ring's share of the badge's width, and the thinnest it is ever drawn. */
const RING_RATIO = 0.06;
const RING_MIN = 1.5;

export type MustPlayBadgeProps = {
  /** The badge's diameter, in dp. */
  size: number;
  /**
   * Say what it is to a screen reader. Off where the badge sits beside the
   * words — the stats strip's cell, the list's own heading — and would be read
   * twice.
   */
  labelled?: boolean;
};

/**
 * The Must Play badge: a moderator's pick (0034).
 *
 * After the mark OpenCritic puts on its top tier, at the owner's direction — a
 * round badge with a face on it, a green disc inside a dark ring. The ring is
 * what lets one colour sit on any cover: it separates the disc from a cover of
 * its own hue the way a sticker's edge does, and it is the same near-black the
 * face is drawn in. The teeth are the one other colour: the opposite ink, so
 * they read as teeth whichever way the disc's ink falls.
 *
 * Presentational. Whether a game carries the label is `useGameLabel`'s to say.
 */
export function MustPlayBadge({ size, labelled = true }: MustPlayBadgeProps) {
  const theme = useTheme();
  const ink = readableInk(theme.mustPlay);
  const teeth = readableInk(ink);
  const ring = Math.max(RING_MIN, size * RING_RATIO);

  return (
    <View
      accessible={labelled}
      accessibilityRole={labelled ? 'image' : undefined}
      accessibilityLabel={labelled ? GAME_LABEL_TEXT.must_play.spoken : undefined}
      importantForAccessibility={labelled ? 'yes' : 'no-hide-descendants'}
      accessibilityElementsHidden={!labelled}
      style={[
        styles.disc,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: ring,
          borderColor: ink,
          backgroundColor: theme.mustPlay,
        },
      ]}>
      {/* Bundled assets: they are on screen with the frame they belong to, so
          a fade would be the badge arriving late on every cover. */}
      <Image
        source={TEETH}
        style={styles.mark}
        tintColor={teeth}
        contentFit="contain"
        transition={0}
        accessibilityIgnoresInvertColors
      />
      <Image
        source={MARK}
        style={styles.mark}
        tintColor={ink}
        contentFit="contain"
        transition={0}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  /* Stacked, both the size of the disc: the grin's white under its lines. */
  mark: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
});
