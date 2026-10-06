import { LinearGradient } from 'expo-linear-gradient';
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type DerivedValue } from 'react-native-reanimated';

import { withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The disc's playing side: polished metal under clear plastic.
 *
 * Material, like the case's plastic in `<CopyCaseBack>`, so it is stated here
 * and not in the theme: it is what a depicted object is made of, and nothing in
 * the interface may borrow it.
 */
const MIRROR = {
  rim: '#5D626B',
  outer: '#A9AEB6',
  band: '#D4D8DE',
  inner: '#8C9199',
  ring: 'rgba(255,255,255,0.22)',
} as const;

export type CdDiscUndersideProps = {
  /** Rendered diameter in dp. */
  size: number;
  /** What shows through the hole: the page the disc stands in front of. */
  holeColor: string;
  /** Which way the lamp's reflection points, in degrees. Driven by the turn and the phone. */
  light: DerivedValue<number>;
};

/**
 * The other side of `<CdDisc>`: what you see when the disc is turned over.
 *
 * A mirror with a rainbow in it. A disc's reflection is a bow-tie — two wedges
 * of spectrum meeting at the hub and opening toward the rim — and it swings
 * round the disc as the light moves. React Native draws no conic gradient, so
 * the wedge is four soft bars of colour laid across the disc through its
 * centre, fanned a few degrees apart: they overlap at the hub, where the hole
 * is, and part toward the rim, which is the shape. The fan is one view, turned
 * as a whole; nothing is redrawn while it moves.
 *
 * The hues are the app's own identity ramp, not new ones. Only the showcase
 * draws this — a disc in the binder lies label up in its sleeve.
 */
export const CdDiscUnderside = memo(function CdDiscUnderside({
  size,
  holeColor,
  light,
}: CdDiscUndersideProps) {
  const theme = useTheme();
  /* A real disc's, whichever console pressed it: a 15mm hole and a clear hub
     out to the stacking ring, on 120mm. */
  const hole = size * (15 / 120);
  const hub = size * (36 / 120);

  const fan = useAnimatedStyle(() => ({ transform: [{ rotate: `${light.get()}deg` }] }));

  const bars = useMemo(
    () =>
      (
        [
          [theme.identityMagenta, -19],
          [theme.identitySky, -6],
          [theme.identityJade, 6],
          [theme.identityGold, 19],
        ] as const
      ).map(([hue, turn]) => ({ hue, turn })),
    [theme]
  );

  return (
    <View
      style={[styles.disc, { width: size, height: size, borderRadius: size / 2 }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            /* Rim, the mirrored band, then the darker ring the data stops at. */
            experimental_backgroundImage: `radial-gradient(circle at center, ${MIRROR.inner} 0%, ${MIRROR.inner} 30%, ${MIRROR.band} 36%, ${MIRROR.outer} 78%, ${MIRROR.band} 93%, ${MIRROR.rim} 97%, ${MIRROR.rim} 100%)`,
          },
        ]}
      />

      <Animated.View style={[StyleSheet.absoluteFill, fan]} pointerEvents="none">
        {bars.map(({ hue, turn }) => (
          <View
            key={turn}
            style={[
              styles.bar,
              {
                height: size * 0.17,
                top: size * 0.415,
                transform: [{ rotate: `${turn}deg` }],
              },
            ]}>
            <LinearGradient
              colors={[withAlpha(hue, 0), withAlpha(hue, 0.5), withAlpha(hue, 0)]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
        ))}
      </Animated.View>

      {/* The clear hub, its stacking ring, and the hole. */}
      <View
        style={[
          styles.centred,
          {
            width: hub,
            height: hub,
            borderRadius: hub / 2,
            left: (size - hub) / 2,
            top: (size - hub) / 2,
            backgroundColor: withAlpha(MIRROR.rim, 0.92),
            borderColor: MIRROR.ring,
          },
        ]}
      />
      <View
        style={[
          styles.centred,
          {
            width: hole,
            height: hole,
            borderRadius: hole / 2,
            left: (size - hole) / 2,
            top: (size - hole) / 2,
            backgroundColor: holeColor,
            borderColor: MIRROR.ring,
          },
        ]}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  disc: { overflow: 'hidden' },
  bar: { position: 'absolute', left: 0, right: 0 },
  centred: { position: 'absolute', borderWidth: StyleSheet.hairlineWidth },
});
