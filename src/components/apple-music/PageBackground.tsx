/**
 * PageBackground.tsx
 *
 * Full-bleed vertical gradient background driven by the screen's keyColor.
 *
 * Remains fixed behind the content at all times. As the hero blurs and fades,
 * this underlying gradient emerges, creating the signature Apple Music
 * "color drain" transition into near-black (#0a0a0a).
 */

import React, { memo, useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { getKeyColorGradient } from './keyColorUtils';

export type PageBackgroundProps = {
  /** Dominant hex color extracted from the hero image */
  keyColor: string;
  /** Dark base color at the bottom of the page (default: #0a0a0a) */
  bottomColor?: string;
  /** Optional custom container styling */
  style?: StyleProp<ViewStyle>;
  /** Optional decorative layers placed above the gradient */
  children?: React.ReactNode;
};

export const PageBackground = memo(function PageBackground({
  keyColor,
  bottomColor = '#0a0a0a',
  style,
  children,
}: PageBackgroundProps) {
  const gradientColors = useMemo(
    () => getKeyColorGradient(keyColor, bottomColor),
    [keyColor, bottomColor]
  );

  return (
    <View pointerEvents="none" style={[styles.container, style]}>
      <LinearGradient
        colors={gradientColors}
        locations={[0, 0.26, 0.6, 1.0]}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0a0a0a',
    zIndex: 0,
  },
});
