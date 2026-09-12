import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import {
  CASE_TEMPLATE_SIZE,
  CASE_TEMPLATES,
  type CasePlatformKey,
} from '@/constants/platform-cases';
import { useTheme } from '@/hooks/use-theme';

export type GameCaseSize = 'small' | 'medium' | 'large';

/** Rendered width of the case face, in dp. */
const WIDTHS: Record<GameCaseSize, number> = {
  small: 108,
  medium: 168,
  large: 232,
};

/**
 * How tall a case face renders at a given width.
 *
 * For callers that have to reserve or overlap space before the case mounts.
 */
export function caseHeightFor(width: number): number {
  return (width / CASE_TEMPLATE_SIZE.width) * CASE_TEMPLATE_SIZE.height;
}

export type GameCaseProps = {
  /** Portrait box art. Falls back to `heroUrl`, then to a lettered placeholder. */
  coverUrl?: string | null;
  heroUrl?: string | null;
  /** Drives which template is used. */
  /** Console only — PC and mobile have no case. `<GameCaseDisplay>` decides. */
  platform: CasePlatformKey;
  /**
   * The game's name. Not printed on the object — the template PNG carries all
   * of its own branding — but used for the accessibility label and for the
   * lettered placeholder when there is no artwork.
   */
  title?: string | null;
  /** Optional badge — "Collector's Edition", "Deluxe". */
  edition?: string | null;
  size?: GameCaseSize;
  /**
   * Exact rendered width, overriding `size`.
   *
   * The three named sizes are fixed dp, which on a 320pt phone made the large
   * case 73% of the screen width while the hero above it scaled freely — two
   * elements in the same composition disagreeing about how big the screen is.
   * A caller that knows the viewport passes a measured width instead.
   */
  width?: number;
  /**
   * 3D turn, in degrees. **Defaults to 0 — the case rests square.**
   *
   * It defaulted to 6 for a long time, and that resting skew is gone: the case
   * lands on arrival and turns over on a drag, and those two say "physical
   * object" better than a permanent rotation did while costing the artwork
   * nothing. A static tilt foreshortens one edge of the cover for as long as the
   * page is open.
   *
   * Still a prop rather than a constant, because that is the seam
   * `<GameCaseFlip>` drives every degree of rotation through without touching
   * this component.
   */
  tilt?: number;
};

/**
 * A game rendered as a physical boxed copy.
 *
 * Layering, bottom to top:
 *   1. drop shadow (on the outer wrapper, so it follows the whole object)
 *   2. cover artwork, positioned into the template's transparent window
 *   3. the platform template PNG
 *   4. a soft diagonal gloss
 *
 * All geometry is derived from the template metadata in
 * `constants/platform-cases.ts` and scaled to the rendered width, so swapping a
 * template for one with a different window needs no change here.
 *
 * ## There is no drawn spine, deliberately
 *
 * There used to be: a coloured slab offset behind the face, carrying the game's
 * title rotated to read bottom-to-top and the platform's short name. It was
 * *generated* — a rectangle in `spineColor` with app type on it — which put a
 * hand-drawn element flush against a template PNG that is already a finished
 * piece of art, in a different colour and a different typeface. The object read
 * as a case with something stuck to its edge.
 *
 * The template is the whole object now. `spineWidth`, `spineColor`,
 * `spineLabel` and `spineTextColor` survive in `constants/platform-cases.ts`
 * because `<GameCaseBack>` reads `spineColor` for its branding band — that band
 * is printing, on a face, matching the front's own strip. Nothing draws a spine.
 *
 * Deliberately NOT for feeds — see the note in CLAUDE.md. Use <Poster /> in any
 * list, card or social context.
 */
export const GameCase = memo(function GameCase({
  coverUrl,
  heroUrl,
  platform,
  title,
  edition,
  size = 'medium',
  width: widthOverride,
  tilt = 0,
}: GameCaseProps) {
  const theme = useTheme();
  const template = CASE_TEMPLATES[platform];
  const width = widthOverride ?? WIDTHS[size];

  // Template pixels → dp. Every offset below rides on this one factor.
  const geometry = useMemo(() => {
    const scale = width / template.templateSize.width;
    const { coverArea } = template;
    return {
      scale,
      height: template.templateSize.height * scale,
      cover: {
        left: coverArea.x * scale,
        top: coverArea.y * scale,
        width: coverArea.width * scale,
        height: coverArea.height * scale,
      },
    };
  }, [template, width]);

  const source = coverUrl ?? heroUrl ?? null;

  return (
    /*
     * Accessibility only — no geometry, no tokens, no styles.
     *
     * This is the largest element on a game page and it announced as nothing
     * usable: the template PNG and the artwork as unlabelled images, which is to
     * say the 90% of the object that *is* the cover art announced as silence.
     *
     * `accessible` collapses the whole composite — template, artwork, gloss,
     * edition badge — into one node carrying one sentence, which is what a
     * sighted user gets in one glance.
     */
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={[title, edition, platform?.toUpperCase()].filter(Boolean).join(', ')}
      style={[styles.wrapper, { width }]}>
      <View
        style={[
          styles.object,
          {
            width,
            height: geometry.height,
            transform: [{ perspective: 900 }, { rotateY: `${tilt}deg` }],
          },
        ]}>
        {/* Artwork, sitting in the template's window. */}
        <View style={[styles.cover, geometry.cover, { backgroundColor: theme.surfaceElevated }]}>
          {source ? (
            <Image
              source={{ uri: source }}
              style={StyleSheet.absoluteFill}
              // `cover` crops rather than distorts — the window is rarely the
              // same aspect ratio as the artwork.
              contentFit="cover"
              transition={220}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={styles.placeholder}>
              <Text variant="caseTitle" color="textMuted">
                {(title ?? '?').trim().charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </View>

        {/* The case itself. */}
        <Image
          source={template.template}
          style={[StyleSheet.absoluteFill, { width, height: geometry.height }]}
          contentFit="fill"
          pointerEvents="none"
          accessibilityIgnoresInvertColors
        />

        {/* Gloss: a narrow diagonal sheen across the plastic. Low opacity on
            purpose — the brief asks for subtle, not a lens flare. */}
        <LinearGradient
          colors={['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.9, y: 0.55 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {edition && (
          <View style={[styles.edition, { backgroundColor: theme.scrim }]}>
            <Text variant="caseEdition" style={styles.editionText} numberOfLines={1}>
              {edition.toUpperCase()}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { alignItems: 'flex-start' },
  object: {
    // Shadow lives here so it wraps the whole object.
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 6, height: 12 },
    elevation: 12,
  },
  cover: { position: 'absolute', overflow: 'hidden' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  edition: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    /* Literal 4, not `Spacing.x4`. The case is a depicted physical object with
       fixed printed proportions, so none of its internal geometry may ride the
       interface spacing ladder — that ladder was compressed to scale the chrome
       down and would have dragged this inset with it. The atom happens to still
       be 4, but the case must not depend on that holding. Same reasoning as
       `Type.caseTitle` and `Radius.caseImage` being pinned. */
    paddingVertical: 4,
    alignItems: 'center',
  },
  editionText: { color: '#FFFFFF', letterSpacing: 1 },
});
