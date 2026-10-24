/**
 * HeroTransition.tsx
 *
 * Full-bleed reusable hero component for Apple Music iOS 27 artist page transitions.
 *
 * Visual Behaviors:
 *  - Skia Progressive Blur: Blur radius accelerates from 0 to ~36px via Reanimated worklet
 *  - Canvas Capping: Canvas turns invisible / dormant when scrolled past heroHeight + 100
 *  - Scale: Expands from 1.0 to 1.08 on scroll up (hiding edge blur falloff) & zooms on pull-down
 *  - Opacity: Fades from 1.0 down to ~0.3
 *  - Color Overlay: KeyColor-to-dark gradient overlay fades in from 0 to 0.8 opacity
 *  - Hero Content: Title, subtitle, and play controls dissolve as the sticky nav bar approaches
 */

import React, { memo, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
// eslint-disable-next-line import/no-unresolved
import { Blur, Canvas, Group, Image as SkiaImage, useImage } from '@shopify/react-native-skia';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { getOverlayGradient, hexToRgba } from './keyColorUtils';

export type HeroTransitionProps = {
  /** High resolution image URL or source for the hero banner */
  imageUri: string;
  /** Height in dp of the hero section (default: 420) */
  heroHeight?: number;
  /** Dominant extracted hex color (e.g. "#1a0a2e") */
  keyColor: string;
  /** Reanimated scroll offset shared value from useScrollProgress */
  scrollY: SharedValue<number>;
  /** Primary headline (artist / game / collection title) */
  title?: string;
  /** Subtitle or artist descriptor (e.g. "Upcoming Concerts" or "Studio") */
  subtitle?: string;
  /** Badge or category tag above title (e.g. "FEATURED ALBUM") */
  badge?: string;
  /** Additional metadata string (e.g. "30M monthly listeners") */
  metaText?: string;
  /** Primary action controls (e.g. Play, Star, Shuffle buttons) */
  actionButtons?: React.ReactNode;
  /** Callback for top-left back button */
  onBackPress?: () => void;
  /** Callback for top-right share button */
  onSharePress?: () => void;
  /** Callback for top-right overflow options button */
  onMorePress?: () => void;
  /** Optional custom content rendered inside the hero */
  children?: React.ReactNode;
  /** Custom wrapper style */
  style?: StyleProp<ViewStyle>;
};

export const HeroTransition = memo(function HeroTransition({
  imageUri,
  heroHeight = 420,
  keyColor,
  scrollY,
  title,
  subtitle,
  badge,
  metaText,
  actionButtons,
  onBackPress,
  onSharePress,
  onMorePress,
  children,
  style,
}: HeroTransitionProps) {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const width = window.width;
  const height = heroHeight;

  // Skia image loader
  const skiaImage = useImage(imageUri);

  // Progressive blur calculation running 100% on UI thread via Reanimated
  // Quantized to 1px steps to minimize redundant Skia repaints on Android
  const blurRadius = useDerivedValue(() => {
    'worklet';
    const rawBlur = interpolate(scrollY.value, [0, heroHeight * 0.7], [0, 36], Extrapolation.CLAMP);
    return Math.round(rawBlur);
  });

  // Hero container animation: scale, opacity, parallax, and dormancy culling
  const animatedHeroStyle = useAnimatedStyle(() => {
    'worklet';
    // Dormancy culling: turn completely off when scrolled far past viewport
    if (scrollY.value > heroHeight + 100) {
      return { opacity: 0 };
    }

    // Rubber-band pull down zoom vs. scroll-up edge falloff protection (1.0 -> 1.08)
    let scale = 1;
    if (scrollY.value < 0) {
      scale = 1 + Math.abs(scrollY.value) / (heroHeight * 1.6);
    } else {
      scale = interpolate(scrollY.value, [0, heroHeight], [1, 1.08], Extrapolation.CLAMP);
    }

    // Opacity drains from 1.0 -> 0.3
    const opacity = interpolate(
      scrollY.value,
      [0, heroHeight * 0.75, heroHeight],
      [1, 0.55, 0.3],
      Extrapolation.CLAMP
    );

    // Parallax translateY
    const translateY = interpolate(
      scrollY.value,
      [-heroHeight, 0, heroHeight],
      [0, 0, -heroHeight * 0.35],
      Extrapolation.CLAMP
    );

    return {
      opacity,
      transform: [{ translateY }, { scale }],
    };
  });

  // Dynamic color overlay gradient (keyColor -> dark) fading in (0.0 -> 0.8)
  const animatedOverlayStyle = useAnimatedStyle(() => {
    'worklet';
    const opacity = interpolate(
      scrollY.value,
      [0, heroHeight * 0.65, heroHeight],
      [0, 0.5, 0.8],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  // Foreground text & buttons dissolve as the user scrolls into content
  const animatedContentStyle = useAnimatedStyle(() => {
    'worklet';
    const opacity = interpolate(scrollY.value, [0, heroHeight * 0.42], [1, 0], Extrapolation.CLAMP);
    const translateY = interpolate(
      scrollY.value,
      [0, heroHeight * 0.42],
      [0, -22],
      Extrapolation.CLAMP
    );
    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  const overlayColors = useMemo(() => getOverlayGradient(keyColor), [keyColor]);
  const footFadeColors = useMemo(
    () => ['transparent', hexToRgba(keyColor, 0.45), keyColor] as const,
    [keyColor]
  );

  return (
    <View style={[styles.container, { height }, style]}>
      {/* Layer 1: Skia Progressive Blur Canvas with Reanimated Scale & Opacity */}
      <Animated.View style={[StyleSheet.absoluteFill, animatedHeroStyle]}>
        <Canvas style={{ width, height }} pointerEvents="none">
          {skiaImage && (
            <Group>
              <Blur blur={blurRadius} mode="clamp" />
              <SkiaImage image={skiaImage} x={0} y={0} width={width} height={height} fit="cover" />
            </Group>
          )}
        </Canvas>
      </Animated.View>

      {/* Layer 2: Constant Foot Fade into keyColor at rest */}
      <LinearGradient
        colors={footFadeColors}
        locations={[0, 0.6, 1.0]}
        style={styles.footFade}
        pointerEvents="none"
      />

      {/* Layer 3: Dynamic Scroll-driven Color Overlay (keyColor -> dark) */}
      <Animated.View style={[StyleSheet.absoluteFill, animatedOverlayStyle]} pointerEvents="none">
        <LinearGradient
          colors={overlayColors}
          locations={[0, 0.5, 1.0]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Layer 4: Top Navigation Pill Controls (Floating in Safe Area) */}
      <View style={[styles.topActions, { top: insets.top + 8 }]}>
        {onBackPress && (
          <Pressable
            onPress={onBackPress}
            hitSlop={8}
            style={styles.circleButton}
            accessibilityRole="button"
            accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          </Pressable>
        )}
        <View style={styles.topRightActions}>
          {onSharePress && (
            <Pressable
              onPress={onSharePress}
              hitSlop={8}
              style={styles.circleButton}
              accessibilityRole="button"
              accessibilityLabel="Share">
              <Ionicons name="share-outline" size={20} color="#FFFFFF" />
            </Pressable>
          )}
          {onMorePress && (
            <Pressable
              onPress={onMorePress}
              hitSlop={8}
              style={styles.circleButton}
              accessibilityRole="button"
              accessibilityLabel="More options">
              <Ionicons name="ellipsis-horizontal" size={20} color="#FFFFFF" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Layer 5: Hero Content (Headline, Subtitle, Play Button) */}
      <Animated.View
        style={[styles.contentContainer, animatedContentStyle]}
        pointerEvents="box-none">
        {badge && (
          <View style={styles.badgeRow}>
            <Text style={styles.badgeText}>{badge.toUpperCase()}</Text>
          </View>
        )}

        {subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}

        {title && (
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
        )}

        {metaText && (
          <Text style={styles.metaText} numberOfLines={1}>
            {metaText}
          </Text>
        )}

        {actionButtons ? (
          <View style={styles.actionsRow}>{actionButtons}</View>
        ) : (
          <View style={styles.defaultActionRow}>
            <Pressable style={styles.primaryPlayButton}>
              <Ionicons name="play" size={26} color="#000000" style={{ marginLeft: 3 }} />
            </Pressable>
            <Pressable style={styles.secondaryButton}>
              <Ionicons name="shuffle" size={20} color="#FFFFFF" />
            </Pressable>
            <Pressable style={styles.secondaryButton}>
              <Ionicons name="star-outline" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        )}

        {children}
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: 'transparent',
  },
  footFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '40%',
  },
  topActions: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  circleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 24,
    zIndex: 5,
  },
  badgeRow: {
    marginBottom: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.75)',
    letterSpacing: 1.2,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.6,
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  metaText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
  },
  actionsRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  defaultActionRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  primaryPlayButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  secondaryButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
