import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { withAlpha } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The background behind every stack header.
 *
 * The header is transparent app-wide so that hero artwork — a game page, a
 * collection banner, the Top 10 — runs all the way to the top of the display
 * instead of starting under an opaque bar. That alone is unreadable: a white
 * title on a bright screenshot disappears, and the bar has no edge, so it melts
 * into whatever is behind it.
 *
 * Two layers fix that without giving the bar back its slab:
 *
 * 1. A page-coloured ramp, near-opaque behind the title and back arrow and
 *    gone by the bottom edge. Legibility where the controls are, and no seam
 *    where it ends.
 * 2. A short black tail hanging off the bottom of the ramp — the shadow. It is
 *    drawn rather than cast because `shadowOffset`/`elevation` need an opaque
 *    view to throw from, and the whole point here is that there is not one.
 *
 * Both are `pointerEvents="none"`: the artwork underneath stays tappable.
 */
export function HeaderBackdrop() {
  const theme = useTheme();
  const scheme = useColorScheme();

  const page = theme.background;

  /*
   * A shadow reads as "less light got here", so it is black in both schemes —
   * tinting it to the page colour would make it a highlight in dark mode. It is
   * stronger on light backgrounds, where the same alpha registers as far less
   * separation.
   */
  const shadow = scheme === 'dark' ? 0.28 : 0.14;

  return (
    <View style={styles.fill} pointerEvents="none">
      <LinearGradient
        colors={[withAlpha(page, 0.97), withAlpha(page, 0.88), withAlpha(page, 0)]}
        locations={[0, 0.6, 1]}
        style={styles.fill}
      />
      <LinearGradient
        colors={[withAlpha('#000000', shadow), withAlpha('#000000', 0)]}
        style={styles.shadow}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  /*
   * Anchored to the bottom of the header and only a fifth of its height, so the
   * darkening reads as an edge under the bar rather than as a vignette over the
   * art. It cannot extend past the header — a `headerBackground` is clipped to
   * the header's bounds — which is why the ramp above it fades out early: the
   * two together have to finish inside that box.
   */
  shadow: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '20%' },
});
