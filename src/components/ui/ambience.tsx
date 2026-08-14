import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

import { tint, withAlpha } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';

/**
 * The page, lit by the colour of the game on it.
 *
 * ## Why this is a gradient and not a picture
 *
 * The first version laid a blurred copy of the cover behind the page. It looked
 * broken on a device, and unavoidably so: a bitmap has edges. Its top edge cut
 * across the key art, its bottom edge ended wherever the fixed height ran out,
 * and the hero's own fade closed on an opaque background in between — three
 * horizontal seams stacked in the first screenful, each one visible as a hard
 * line across the artwork.
 *
 * A gradient has no edges. That is the entire argument. The colour still comes
 * from the artwork — `artwork-color.ts` reads the dominant hue out of the actual
 * pixels — but it arrives as *one* continuous ramp with nothing to crop, nothing
 * to tile and no second image fighting the first.
 *
 * ## The shape of the ramp
 *
 * Four stops, and every one has a job:
 *
 *  1. **Transparent at the top**, so the key art behind it is untouched. The
 *     hero is the first thing on the page and the wash must not veil it.
 *  2. **The hue, at strength, across the middle.** This is the band the case and
 *     the title sit against.
 *  3. **Opaque accent-dark at `coverAt`.** This is load-bearing: it lands
 *     exactly where the hero art ends, so the bitmap's bottom edge is covered by
 *     a colour rather than meeting one. There is no seam because there is
 *     nothing for the eye to find — the art is already fully obscured when it
 *     stops.
 *  4. **Background at the bottom**, resolving into the ordinary page.
 *
 * Stops 3 and 4 are why the hero no longer draws its own fade on these screens
 * (`<HeroArt fade={false} />`). Two ramps closing on two slightly different
 * darks is what produced the band in the middle of the old composition; there is
 * now exactly one.
 */
export type AmbienceProps = {
  /**
   * Where the ramp must be fully opaque, as a fraction of its own height.
   *
   * Set this so it lands on the bottom edge of whatever artwork sits behind —
   * on the game page, the hero's height over the ambience's height. Getting it
   * wrong is visible: too early and the art is cut short, too late and its edge
   * shows.
   */
  coverAt?: number;
};

/** Default for a screen whose artwork occupies the top ~55% of the wash. */
const DEFAULT_COVER_AT = 0.55;

export function Ambience({ coverAt = DEFAULT_COVER_AT }: AmbienceProps) {
  const theme = useTheme();
  const accent = useAccent();

  /*
   * The dark the ramp closes on: the page colour carrying the accent, not the
   * accent itself and not plain black. Closing on `background` would throw away
   * the colour exactly where the content starts, which is where it is doing the
   * most work; closing on the accent would leave a bright band across the middle
   * of the screen that every piece of body copy then has to survive.
   */
  const deep = tint(theme.background, accent.color, 0.55);

  return (
    <LinearGradient
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      /* Every stop ends on a colour at an explicit alpha, never the keyword
         `transparent` — `expo-linear-gradient` premultiplies on Android and
         fades the keyword through black, which would put a grey bruise across
         the top of the artwork. */
      colors={[withAlpha(accent.color, 0), withAlpha(accent.color, 0.34), deep, theme.background]}
      locations={[0, coverAt * 0.62, coverAt, 1]}
    />
  );
}
