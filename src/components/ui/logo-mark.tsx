import { Image } from 'expo-image';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useLogoInk } from '@/hooks/use-logo-ink';
import { useTheme } from '@/hooks/use-theme';
import { logoTreatment } from '@/lib/logo-ink';

export type LogoMarkProps = {
  /** The logo, or null for a thing that has none. */
  uri: string | null;
  /** Whose logo it is: the initial drawn when there is no image. */
  name: string;
  /** The frame the mark is fitted into, whole. */
  width: number;
  height: number;
  /**
   * Space between a plate's edge and the mark on it. Defaults to an eighth of
   * the short side. A mark drawn straight on the page takes the whole frame.
   */
  inset?: number;
  /** A download priority for a wall of them; expo-image's own `normal` when omitted. */
  priority?: 'low' | 'normal' | 'high';
  /**
   * Draw the mark on a tile of its own — a filled, rounded frame — for a grid
   * of them (`<LogoTile>`). The fill is the app's control surface, or the
   * logo's own ground when it brought one; the frame is there from the first
   * paint, so a grid keeps its shape while its logos are measured.
   */
  tile?: boolean;
};

/**
 * Somebody else's logo — a platform's, a studio's — on this app's dark page,
 * with nothing behind it wherever that can be done.
 *
 * ## It was a light plate under every one
 *
 * These marks are drawn for white pages: most are dark ink cut out of nothing,
 * which on a near-black page is a hole. The first answer was a light plate
 * under all of them, which worked and made a directory of logos a wall of
 * white tiles. The owner asked for them transparent, so each logo's pixels are
 * read once (`useLogoInk`) and it is drawn one of three ways (`logoTreatment`):
 *
 *  - **as it is**, on the page — ink that already reads there: Windows' blue,
 *    a white wordmark, a filled badge;
 *  - **as a light silhouette**, on the page — ink that would be lost:
 *    PlayStation 4's black, the Series X's charcoal;
 *  - **on a plate of its own ground** — a logo that is not cut out at all:
 *    PlayStation 5's white-on-black rectangle gets a black plate that all but
 *    disappears into the page, and one scanned on white keeps a white one.
 *    Nothing can make these transparent; the plate only rounds the corners of
 *    a ground the picture already had.
 *
 * `contain`ed and never cropped: a logo is a shape with its own proportions.
 *
 * ## Nothing is drawn until the logo has been measured
 *
 * The frame stays empty on a logo's first sighting, for the few hundred
 * milliseconds the measurement takes. Drawing it on a plate meanwhile and then
 * lifting it off would be a flash on every tile; the answer is on disk from
 * then on, so the wait happens once per logo, ever. A logo that could not be
 * measured falls back to the light plate (`logoPlate`), which is legible
 * whatever is on it.
 *
 * Without a logo at all the frame is the app's own dark control surface with
 * the name's initial on it — recognisably "no picture".
 */
export const LogoMark = memo(function LogoMark({
  uri,
  name,
  width,
  height,
  inset,
  priority,
  tile = false,
}: LogoMarkProps) {
  const theme = useTheme();
  const { ink, resolved } = useLogoInk(uri);

  if (!uri) {
    return (
      <View
        style={[
          styles.plate,
          styles.empty,
          { width, height, backgroundColor: theme.surfaceElevated },
        ]}>
        <Text variant={height >= 64 ? 'h1' : 'h4'} color="textMuted">
          {name.trim().charAt(0).toUpperCase() || '?'}
        </Text>
      </View>
    );
  }

  if (!resolved) {
    return (
      <View
        style={[
          { width, height },
          tile && styles.plate,
          tile && { backgroundColor: theme.surfaceElevated },
        ]}
      />
    );
  }

  const treatment = logoTreatment(ink);
  const plated = treatment.kind === 'plate';
  /* A mark on a tile keeps well clear of its edge — a sixth of the side — where
     one on a plate that is only its own ground needs an eighth. */
  const padding = inset ?? Math.round(Math.min(width, height) / (tile ? 6 : 8));

  return (
    <View
      style={[
        { width, height },
        (plated || tile) && styles.plate,
        plated && { padding, backgroundColor: treatment.color ?? theme.logoPlate },
        tile && !plated && { padding, backgroundColor: theme.surfaceElevated },
      ]}>
      <Image
        source={{ uri }}
        recyclingKey={uri}
        style={styles.mark}
        cachePolicy="memory-disk"
        contentFit="contain"
        /* One ink for the whole mark: every opaque pixel takes it. */
        tintColor={treatment.kind === 'silhouette' ? theme.text : undefined}
        transition={160}
        priority={priority}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
});

const styles = StyleSheet.create({
  /* A plate, not artwork: the description card's 8, a step softer than box
     art's 4, so a wall of them does not read as a shelf of covers. */
  plate: { borderRadius: Radius.lg, overflow: 'hidden' },
  empty: { alignItems: 'center', justifyContent: 'center' },
  mark: { width: '100%', height: '100%' },
});
