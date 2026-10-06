import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';

import { CdDisc } from '@/components/cd-disc';
import { PLASTIC } from '@/components/copy-case-back';
import type { PlatformKey } from '@/constants/platform-cases';
import { withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CopyCompleteness } from '@/lib/database.types';

/**
 * What a copy's box holds besides the game, from what its owner recorded.
 *
 * **The inside of the case is the copy's own.** A manual is drawn under its
 * clips only where the owner said the copy has one; "game + box" opens on empty
 * clips; a copy whose completeness was never recorded claims nothing. This is
 * the one thing a picture of a case could not show and this app can — so it is
 * never dressed with a booklet for looks.
 *
 * (`sealed` never gets here: a sealed copy does not open. `loose` and
 * `game_manual` have no box at all and are drawn in one anyway, by the owner's
 * decision — the back of the case is the one place a copy's edition is printed,
 * and a copy with no case would have nowhere to print it.)
 */
export function caseContents(completeness: CopyCompleteness | null): {
  manual: boolean;
  inserts: boolean;
} {
  return {
    manual:
      completeness === 'cib' || completeness === 'cib_inserts' || completeness === 'game_manual',
    inserts: completeness === 'cib_inserts',
  };
}

/** Every size is a fraction of the case's width, as the back's are. */
const radius = (width: number) => Math.max(3, Math.round(width * 0.025));

export type CopyCaseTrayProps = {
  coverUrl?: string | null;
  heroUrl?: string | null;
  title: string;
  platform: PlatformKey;
  width: number;
  height: number;
  /** The disc's diameter, true to its case (`discDiameter`). */
  disc: number;
  /**
   * The seated disc's own style: the stage hides it the moment the disc starts
   * to lift, and draws the one that travels in the same place. Animated, since
   * that moment is a frame on the UI thread and not a render.
   */
  seatStyle?: StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>;
};

/**
 * The tray: the half of an open case the disc sits in.
 *
 * The back's plastic seen from inside — the same two tones — with the well the
 * disc lies in, the hub that holds it, and the shadow the standing cover throws
 * across the hinge side. The disc is the binder's `<CdDisc>`, with the tray's
 * own plastic showing through its clear hub and the hub's clip drawn over its
 * hole, as a disc pressed onto one looks.
 */
export const CopyCaseTray = memo(function CopyCaseTray({
  coverUrl,
  heroUrl,
  title,
  platform,
  width,
  height,
  disc,
  seatStyle,
}: CopyCaseTrayProps) {
  const well = disc * 1.045;
  const clip = Math.max(10, disc * 0.115);

  return (
    <View style={[styles.shell, { width, height, borderRadius: radius(width) }]}>
      <LinearGradient
        colors={[PLASTIC.top, PLASTIC.bottom]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* The rim the cover closes onto. */}
      <View
        style={[
          styles.rim,
          { borderRadius: radius(width), borderColor: PLASTIC.rule, margin: width * 0.022 },
        ]}
      />

      <View
        style={[
          styles.round,
          {
            width: well,
            height: well,
            borderRadius: well / 2,
            left: (width - well) / 2,
            top: (height - well) / 2,
            backgroundColor: withAlpha(PLASTIC.bottom, 0.7),
            borderColor: PLASTIC.rule,
          },
        ]}
      />

      <Animated.View
        style={[styles.seat, { left: (width - disc) / 2, top: (height - disc) / 2 }, seatStyle]}>
        <CdDisc
          coverUrl={coverUrl}
          heroUrl={heroUrl}
          title={title}
          platform={platform}
          size={disc}
          holeColor={PLASTIC.top}
        />
      </Animated.View>

      {/* The hub's clip, through the disc's hole — or standing alone in an
          empty well while the disc is out. */}
      <View
        style={[
          styles.round,
          {
            width: clip,
            height: clip,
            borderRadius: clip / 2,
            left: (width - clip) / 2,
            top: (height - clip) / 2,
            backgroundColor: PLASTIC.top,
            borderColor: PLASTIC.highlight,
          },
        ]}>
        <View
          style={[
            styles.clipCore,
            { borderRadius: clip / 2, margin: clip * 0.26, backgroundColor: PLASTIC.bottom },
          ]}
        />
      </View>

      {/* The cover stands at the hinge and shades the tray beside it. */}
      <LinearGradient
        colors={[withAlpha(PLASTIC.bottom, 0.85), withAlpha(PLASTIC.bottom, 0)]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.hingeShade, { width: width * 0.16 }]}
        pointerEvents="none"
      />
    </View>
  );
});

export type CopyCaseLeafProps = {
  coverUrl?: string | null;
  heroUrl?: string | null;
  width: number;
  height: number;
  manual: boolean;
  inserts: boolean;
};

/**
 * The inside of the cover: the clips, and the manual if this copy has one.
 *
 * Laid out as it is read from inside the case — **its free edge on the left and
 * its hinge on the right** — which is the mirror of the cover outside.
 *
 * The manual is the game's own cover on a white booklet, as nearly every one
 * was printed. An insert is a second sheet behind it, showing at the top. With
 * neither, the clips hold nothing and an outline marks where a booklet went.
 * It is seen at a glancing angle, the cover standing nearly end-on to the
 * reader, so it is drawn to be recognised and not to be read.
 */
export const CopyCaseLeaf = memo(function CopyCaseLeaf({
  coverUrl,
  heroUrl,
  width,
  height,
  manual,
  inserts,
}: CopyCaseLeafProps) {
  const theme = useTheme();
  const art = coverUrl ?? heroUrl ?? null;

  const booklet = {
    left: width * 0.11,
    top: height * 0.09,
    width: width * 0.76,
    height: height * 0.82,
  };
  const tab = { width: width * 0.07, height: height * 0.1 };

  return (
    <View style={[styles.shell, { width, height, borderRadius: radius(width) }]}>
      <LinearGradient
        colors={[PLASTIC.top, PLASTIC.bottom]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {inserts && (
        <View
          style={[
            styles.sheet,
            booklet,
            {
              top: booklet.top - height * 0.025,
              left: booklet.left + width * 0.03,
              backgroundColor: theme.textSecondary,
            },
          ]}
        />
      )}

      {manual ? (
        <View style={[styles.sheet, booklet, { backgroundColor: theme.text }]}>
          {art ? (
            <Image
              source={{ uri: art }}
              style={[styles.manualArt, { margin: width * 0.02 }]}
              contentFit="cover"
              cachePolicy="memory-disk"
              accessibilityIgnoresInvertColors
            />
          ) : null}
          {/* The fold of a stapled booklet, on its hinge side. */}
          <View style={[styles.fold, { backgroundColor: withAlpha(theme.shadowInk, 0.22) }]} />
        </View>
      ) : (
        <View style={[styles.sheet, styles.empty, booklet, { borderColor: PLASTIC.rule }]} />
      )}

      {/* Two clips at the free edge, over whatever they hold. */}
      {[0.24, 0.66].map((at) => (
        <View
          key={at}
          style={[
            styles.tab,
            tab,
            { top: height * at, backgroundColor: PLASTIC.top, borderColor: PLASTIC.highlight },
          ]}
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  shell: { overflow: 'hidden' },
  rim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: StyleSheet.hairlineWidth,
  },
  round: { position: 'absolute', borderWidth: StyleSheet.hairlineWidth },
  seat: { position: 'absolute' },
  clipCore: { flex: 1 },
  hingeShade: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  sheet: { position: 'absolute', borderRadius: 2, overflow: 'hidden' },
  empty: { borderWidth: StyleSheet.hairlineWidth, borderStyle: 'dashed' },
  manualArt: { flex: 1 },
  fold: { position: 'absolute', top: 0, bottom: 0, right: 0, width: 3 },
  tab: {
    position: 'absolute',
    left: 0,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 0,
  },
});
