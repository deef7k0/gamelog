/**
 * FrostedNavBar.tsx
 *
 * Sticky frosted glass navigation bar mimicking the iOS 27 Apple Music artist header.
 *
 * Requirements:
 *  - Pinned at the top using absolute positioning + animated translateY (zero position:sticky)
 *  - Fixed blur intensity (40) — container opacity animates from 0 to 1 over heroHeight*0.5 -> heroHeight
 *  - Android: blurMethod="dimezisBlurViewSdk31Plus" with blurTarget reference
 *  - KeyColor tint: 30% opacity overlay
 *  - Layout: Back button, 40px circular avatar, title + subtitle, action button
 */

import React, { memo, useMemo } from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { getNavTint } from './keyColorUtils';

export type FrostedNavBarProps = {
  /** Title text shown in the center of the bar */
  title: string;
  /** Subtitle or category text */
  subtitle?: string;
  /** Image URL for the 40px circular avatar */
  avatarUri?: string;
  /** Dominant keyColor of the screen (e.g. "#1a0a2e") */
  keyColor: string;
  /** Reanimated scroll offset shared value */
  scrollY: SharedValue<number>;
  /** Total height of the hero header */
  heroHeight: number;
  /** Callback when pressing the right action button */
  onActionPress?: () => void;
  /** Label or icon name for the right action button */
  actionLabel?: string;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  /** Callback when pressing the back button */
  onBackPress?: () => void;
  /** Callback when pressing the overflow more button */
  onMorePress?: () => void;
  /** BlurTarget ref passed on Android for RenderNode blur capture */
  blurTarget?: any;
  /** Custom container style */
  style?: StyleProp<ViewStyle>;
};

export const FrostedNavBar = memo(function FrostedNavBar({
  title,
  subtitle,
  avatarUri,
  keyColor,
  scrollY,
  heroHeight,
  onActionPress,
  actionLabel = 'Play',
  actionIcon = 'play',
  onBackPress,
  onMorePress,
  blurTarget,
  style,
}: FrostedNavBarProps) {
  const insets = useSafeAreaInsets();
  const tintColor = useMemo(() => getNavTint(keyColor, 0.3), [keyColor]);

  // Container opacity animates from 0 -> 1 over heroHeight*0.5 -> heroHeight
  // FIXED blur intensity used internally to prevent full-layer GPU rasterization every frame
  const animatedBarStyle = useAnimatedStyle(() => {
    'worklet';
    const opacity = interpolate(
      scrollY.value,
      [heroHeight * 0.5, heroHeight],
      [0, 1],
      Extrapolation.CLAMP
    );

    const translateY = interpolate(
      scrollY.value,
      [heroHeight * 0.45, heroHeight * 0.65],
      [-8, 0],
      Extrapolation.CLAMP
    );

    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  return (
    <Animated.View style={[styles.container, animatedBarStyle, style]} pointerEvents="box-none">
      {/* 1. Underlying Blur Layer with fixed intensity */}
      <BlurView
        intensity={40}
        tint="dark"
        blurMethod={Platform.OS === 'android' ? 'dimezisBlurViewSdk31Plus' : undefined}
        blurTarget={blurTarget}
        style={StyleSheet.absoluteFill}
      />

      {/* 2. KeyColor Tint Overlay (30% opacity) */}
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: tintColor }]}
        pointerEvents="none"
      />

      {/* 3. Hairline divider border */}
      <View style={styles.borderBottom} pointerEvents="none" />

      {/* 4. Nav Bar Content Row */}
      <View
        style={[
          styles.contentRow,
          {
            paddingTop: insets.top + 6,
            paddingBottom: 10,
          },
        ]}>
        {/* Left: Back Button */}
        {onBackPress ? (
          <Pressable
            onPress={onBackPress}
            hitSlop={8}
            style={styles.navButton}
            accessibilityRole="button"
            accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </Pressable>
        ) : (
          <View style={styles.navButtonPlaceholder} />
        )}

        {/* Center: 40px Circular Avatar + Title & Subtitle */}
        <View style={styles.centerIdentity}>
          {avatarUri && (
            <Image source={{ uri: avatarUri }} style={styles.avatar} resizeMode="cover" />
          )}
          <View style={styles.titleColumn}>
            <Text style={styles.titleText} numberOfLines={1}>
              {title}
            </Text>
            {subtitle && (
              <Text style={styles.subtitleText} numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </View>
        </View>

        {/* Right: Primary Action Button + Overflow */}
        <View style={styles.rightActions}>
          {onActionPress && (
            <Pressable
              onPress={onActionPress}
              style={styles.actionPill}
              accessibilityRole="button"
              accessibilityLabel={actionLabel}>
              <Ionicons name={actionIcon} size={15} color="#000000" />
              {actionLabel && <Text style={styles.actionText}>{actionLabel}</Text>}
            </Pressable>
          )}

          {onMorePress && (
            <Pressable
              onPress={onMorePress}
              hitSlop={8}
              style={styles.navButton}
              accessibilityRole="button"
              accessibilityLabel="Options">
              <Ionicons name="ellipsis-horizontal" size={20} color="#FFFFFF" />
            </Pressable>
          )}
        </View>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    overflow: 'hidden',
  },
  borderBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonPlaceholder: {
    width: 8,
  },
  centerIdentity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  titleColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  titleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  subtitleText: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.65)',
    marginTop: 1,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
  },
});
