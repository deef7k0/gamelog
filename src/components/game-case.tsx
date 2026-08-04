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
import { FontFamily, Spacing } from '@/constants/theme';
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
 * Excludes the spine, which extends sideways rather than down.
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
  /** Printed down the spine. */
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
   * Slight 3D turn, in degrees. 0 renders flat-on.
   *
   * Exposed as a prop rather than fixed so a future "rotate the case" animation
   * can drive it from a shared value without touching this component.
   */
  tilt?: number;
  /** Show the spine edge. Off for flat-on presentations. */
  showSpine?: boolean;
};

/**
 * A game rendered as a physical boxed copy.
 *
 * Layering, bottom to top:
 *   1. drop shadow (on the outer wrapper, so it follows the whole object)
 *   2. spine slab, offset behind the face
 *   3. cover artwork, positioned into the template's transparent window
 *   4. the platform template PNG
 *   5. a soft diagonal gloss
 *
 * All geometry is derived from the template metadata in
 * `constants/platform-cases.ts` and scaled to the rendered width, so swapping a
 * template for one with a different window needs no change here.
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
  tilt = 6,
  showSpine = true,
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
      spineWidth: template.spineWidth * scale,
    };
  }, [template, width]);

  const source = coverUrl ?? heroUrl ?? null;

  return (
    <View style={[styles.wrapper, { width: width + geometry.spineWidth }]}>
      <View
        style={[
          styles.object,
          {
            width,
            height: geometry.height,
            marginLeft: showSpine ? geometry.spineWidth : 0,
            transform: [{ perspective: 900 }, { rotateY: `${tilt}deg` }],
          },
        ]}>
        {/* Spine: a slab behind and to the left of the face. Its title is
            rotated to read bottom-to-top, the way a shelved case does. */}
        {showSpine && (
          <View
            style={[
              styles.spine,
              {
                width: geometry.spineWidth,
                height: geometry.height,
                left: -geometry.spineWidth,
                backgroundColor: template.spineColor,
              },
            ]}>
            <View style={[styles.spineText, { width: geometry.height }]}>
              <Text
                numberOfLines={1}
                style={[
                  styles.spineTitle,
                  { color: template.spineTextColor, fontSize: Math.max(7, width * 0.045) },
                ]}>
                {title ?? ''}
              </Text>
              <Text
                style={[
                  styles.spineBrand,
                  { color: template.spineTextColor, fontSize: Math.max(6, width * 0.038) },
                ]}>
                {template.spineLabel}
              </Text>
            </View>
          </View>
        )}

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
              <Text variant="title" color="textMuted">
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
            <Text variant="micro" style={styles.editionText} numberOfLines={1}>
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
    // Shadow lives here so it wraps the face and spine as one object.
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 6, height: 12 },
    elevation: 12,
  },
  spine: {
    position: 'absolute',
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
    overflow: 'hidden',
  },
  // Rotating a full-height row is what lets the text run vertically; the width
  // is set to the case height because it is measured pre-rotation.
  spineText: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
    transform: [{ rotate: '90deg' }],
  },
  spineTitle: { fontFamily: FontFamily.semibold, flexShrink: 1 },
  spineBrand: { fontFamily: FontFamily.bold, opacity: 0.85, letterSpacing: 0.5 },
  cover: { position: 'absolute', overflow: 'hidden' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  edition: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: Spacing.one,
    alignItems: 'center',
  },
  editionText: { color: '#FFFFFF', letterSpacing: 1 },
});
