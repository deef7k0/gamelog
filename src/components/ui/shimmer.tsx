import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { css, useReducedMotion } from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';

/**
 * SimpMusic's shimmer, as a surface — `Modifier.shimmer()` in its `UIExt.kt`,
 * which every block of its `Shimmer.kt` placeholders wears.
 *
 * The reference is one brush: the block is filled with its `shimmerBackground`
 * and a linear gradient `[background, line, background]` is swept across it,
 * its start running from `-2 × width` to `+2 × width` on
 * `infiniteRepeatable(tween(1000))`. Outside that span Compose clamps the
 * brush to its end colour, which is the background again — so what you see is
 * a flat block with one soft light passing over it, and no seam where the
 * gradient begins or ends.
 *
 * Restated here as a flat fill with a gradient of exactly the block's width
 * translating over it. The two are the same picture: the gradient's own ends
 * *are* the fill, so its edges are invisible, and everywhere it is not is the
 * fill — which is what Compose's clamp draws.
 *
 * ## Why this is affordable now, when it was refused before
 *
 * `<Skeleton>` was deliberately static, and the reason given was the right one
 * at the time: "a shimmer across a whole search list costs more in dropped
 * frames than it gains in perceived speed." That cost was the JS thread. This
 * is a **Reanimated CSS animation** — `animationName` on a React prop — so it
 * is declared once, runs entirely on the UI thread, and a screen that is
 * scrolling or fetching does not slow it or get slowed by it. It also cannot
 * lose its end value (§ Gotchas): there is no end value, the animation is
 * infinite, and the resting state React holds is the plain fill.
 *
 * The travel is in dp, from a measured width, rather than the `'200%'` a CSS
 * transform would allow: a percentage transform is interpolated natively and
 * nothing here can be run on a phone to confirm it, while a number is a
 * number on both platforms. The measurement costs one extra render per block
 * on mount and nothing after.
 *
 * Still under Reduce Motion, where the block is the flat fill — which is what
 * it was before any of this.
 */

/** `infiniteRepeatable(animation = tween(1000))`. */
export const SHIMMER_MS = 1000;

/**
 * `-2 * size.width` to `2 * size.width`: the light spends two thirds of each
 * pass off the block, which is the pause between sweeps.
 */
export const SHIMMER_TRAVEL = 2;

export type ShimmerProps = {
  /** Rounded with the block it stands in for. */
  radius?: number;
  /** The flat fill. `theme.skeleton` unless a caller is on another surface. */
  color?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * A block of shimmer, sized by its `style` or by the space it is given.
 *
 * `<Skeleton>` is the usual way in; this is for a placeholder that has to be
 * its own shape — a tile, a card, a row of them.
 */
export function Shimmer({ radius = 0, color, style }: ShimmerProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);

  const fill = color ?? theme.skeleton;
  const sweep = useMemo(() => (width > 0 ? travel(width) : null), [width]);

  const onLayout = (event: LayoutChangeEvent) => {
    const measured = Math.round(event.nativeEvent.layout.width);
    setWidth((was) => (was === measured ? was : measured));
  };

  return (
    <View
      /* Hidden from a screen reader: a placeholder has nothing to say, and
         announcing one per row turns a loading list into a wall of noise. */
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={reduceMotion ? undefined : onLayout}
      style={[{ backgroundColor: fill, borderRadius: radius, overflow: 'hidden' }, style]}>
      {sweep && !reduceMotion && (
        <Animated.View
          style={[
            styles.sweep,
            { width },
            {
              animationName: sweep,
              animationDuration: SHIMMER_MS,
              animationIterationCount: 'infinite',
              animationTimingFunction: 'linear',
            },
          ]}>
          <LinearGradient
            /* `[background, line, background]` — the ends are the fill, so the
               light has no edge. */
            colors={[fill, theme.skeletonSweep, fill]}
            /* `start = Offset(x, 0)`, `end = Offset(x + width, height)`: the
               reference's brush runs corner to corner, not straight across. */
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}

/**
 * The sweep for a block this wide. Memoised by the caller, so a list of
 * equal-width placeholders declares one animation and not one each.
 */
function travel(width: number) {
  return css.keyframes({
    from: { transform: [{ translateX: -SHIMMER_TRAVEL * width }] },
    to: { transform: [{ translateX: SHIMMER_TRAVEL * width }] },
  });
}

const styles = StyleSheet.create({
  sweep: { position: 'absolute', top: 0, bottom: 0, left: 0 },
});
