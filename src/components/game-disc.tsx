import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { DISC_TEMPLATE } from '@/constants/platform-cases';
import { useTheme } from '@/hooks/use-theme';

export type GameDiscProps = {
  coverUrl?: string | null;
  heroUrl?: string | null;
  /** Rendered diameter in dp. */
  size?: number;
  /** Slow continuous rotation. Off by default — it is a focal effect. */
  spinning?: boolean;
  /** Seconds per revolution. */
  revolutionMs?: number;
};

/**
 * A game rendered as a physical optical disc.
 *
 * The artwork is centre-cropped into a circle and sits beneath the disc
 * template, which supplies the rim, hub and centre hole. Metallic character
 * comes from two crossed gradients over the top rather than a texture — cheaper
 * to composite and it scales to any size.
 *
 * Built for the soundtrack pages that will come later, hence `spinning`: the
 * rotation is driven by Reanimated on the UI thread, so a spinning disc costs
 * the JS thread nothing while a page scrolls.
 */
export const GameDisc = memo(function GameDisc({
  coverUrl,
  heroUrl,
  size = 220,
  spinning = false,
  revolutionMs = 12000,
}: GameDiscProps) {
  const theme = useTheme();
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (!spinning) {
      cancelAnimation(rotation);
      return;
    }

    rotation.set(0);
    rotation.set(
      withRepeat(withTiming(360, { duration: revolutionMs, easing: Easing.linear }), -1, false)
    );

    return () => cancelAnimation(rotation);
  }, [spinning, revolutionMs, rotation]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.get()}deg` }],
  }));

  // The template's art annulus, expressed as a fraction of its own canvas, so
  // the artwork lines up whatever the rendered size.
  const artScale = (DISC_TEMPLATE.artRadius * 2) / DISC_TEMPLATE.size;
  const artSize = size * artScale;
  const source = coverUrl ?? heroUrl ?? null;

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Animated.View style={[styles.disc, { width: size, height: size }, spinStyle]}>
        {/* Artwork, circular-cropped. */}
        <View
          style={[
            styles.art,
            {
              width: artSize,
              height: artSize,
              borderRadius: artSize / 2,
              backgroundColor: theme.surfaceElevated,
            },
          ]}>
          {source && (
            <Image
              source={{ uri: source }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={220}
              accessibilityIgnoresInvertColors
            />
          )}
        </View>

        {/* Rim, hub and centre hole. */}
        <Image
          source={DISC_TEMPLATE.template}
          style={[StyleSheet.absoluteFill, { width: size, height: size }]}
          contentFit="fill"
          pointerEvents="none"
          accessibilityIgnoresInvertColors
        />

        {/* Two crossed sheens stand in for a metallic surface. They rotate with
            the disc, which is what sells the spin. */}
        <LinearGradient
          colors={[
            'rgba(255,255,255,0.28)',
            'transparent',
            'rgba(255,255,255,0.14)',
            'transparent',
          ]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['transparent', 'rgba(120,190,255,0.16)', 'transparent']}
          start={{ x: 1, y: 0.1 }}
          end={{ x: 0, y: 0.9 }}
          style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
          pointerEvents="none"
        />
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center' },
  disc: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  art: { position: 'absolute', overflow: 'hidden' },
});
