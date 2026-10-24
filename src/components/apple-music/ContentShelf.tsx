/**
 * ContentShelf.tsx
 *
 * Staggered fade-in + slide-up section wrapper for Apple Music content shelves.
 *
 * Animation Specifications:
 *  - Driven on UI thread via Reanimated worklet
 *  - Opacity: 0 -> 1 over 200px of vertical scroll
 *  - TranslateY: 20 -> 0 over the same range
 *  - Stagger: each subsequent shelf starts its fade 50px later (baseOffset + index * 50)
 */

import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

export type ContentShelfProps = {
  /** Sequential index of this shelf for the 50px stagger timing (0, 1, 2, ...) */
  index: number;
  /** Reanimated scrollY shared value */
  scrollY: SharedValue<number>;
  /** Base scroll offset where shelf index 0 begins animating (default: 120) */
  baseOffset?: number;
  /** Shelf headline (e.g. "Top Songs", "Featured Albums", "Screenshots") */
  title?: string;
  /** Optional interactive label on the right (e.g. "See All") */
  actionText?: string;
  /** Callback when pressing the shelf header or action label */
  onActionPress?: () => void;
  /** Content rendered inside this shelf */
  children: React.ReactNode;
  /** Outer container style */
  style?: StyleProp<ViewStyle>;
  /** Inner content style */
  contentContainerStyle?: StyleProp<ViewStyle>;
};

export const ContentShelf = memo(function ContentShelf({
  index,
  scrollY,
  baseOffset = 120,
  title,
  actionText,
  onActionPress,
  children,
  style,
  contentContainerStyle,
}: ContentShelfProps) {
  // Stagger calculation: each subsequent shelf triggers 50px later
  const animatedShelfStyle = useAnimatedStyle(() => {
    'worklet';
    const start = baseOffset + index * 50;
    const end = start + 200;

    const opacity = interpolate(scrollY.value, [start, end], [0, 1], Extrapolation.CLAMP);

    const translateY = interpolate(scrollY.value, [start, end], [20, 0], Extrapolation.CLAMP);

    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  return (
    <Animated.View style={[styles.container, animatedShelfStyle, style]}>
      {/* Optional Shelf Header */}
      {title && (
        <View style={styles.headerRow}>
          <Pressable
            onPress={onActionPress}
            disabled={!onActionPress}
            style={styles.titlePressable}>
            <Text style={styles.titleText}>{title}</Text>
            {onActionPress && (
              <Ionicons
                name="chevron-forward"
                size={16}
                color="rgba(255, 255, 255, 0.45)"
                style={styles.chevron}
              />
            )}
          </Pressable>

          {actionText && onActionPress && (
            <Pressable onPress={onActionPress} hitSlop={8}>
              <Text style={styles.actionText}>{actionText}</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Content Area */}
      <View style={[styles.content, contentContainerStyle]}>{children}</View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginVertical: 14,
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  titlePressable: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  chevron: {
    marginLeft: 4,
    marginTop: 2,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.75,
  },
  content: {
    width: '100%',
  },
});
