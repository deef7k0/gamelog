import { BlurView } from 'expo-blur';
import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

/**
 * A floating icon dock with a selection pill that slides between items.
 *
 * This is a React Native port. The original is a web component built on
 * `motion/react` and Tailwind classes — `<div>`, `className`, `layoutId`,
 * `backdrop-blur-xl` — none of which exist here: this app renders to native
 * views, has no DOM and no Tailwind (see the note in CLAUDE.md). Everything it
 * did has a native equivalent, so nothing was lost:
 *
 *   motion `layoutId` shared element  →  one pill in the parent, its `left` and
 *                                        `width` sprung by Reanimated
 *   `backdrop-blur-xl`                →  `expo-blur`'s BlurView
 *   `useReducedMotion` (framer)       →  Reanimated's `useReducedMotion`
 *   Tailwind `bg-card/80 border ...`  →  theme tokens + StyleSheet
 *   lucide-react icons                →  whatever the caller passes as children,
 *                                        which in this app means Ionicons
 *
 * The spring constants are the original's `SPRING_LAYOUT`, kept as-is so the
 * movement feels the same.
 */

/** From the source component's motion presets. */
const SPRING_LAYOUT = { stiffness: 360, damping: 32, mass: 0.6 } as const;

type DockContextValue = {
  size: number;
  /** Called by the active item once it knows where it is. */
  movePillTo: (rect: { x: number; width: number }) => void;
};

const DockContext = createContext<DockContextValue | null>(null);

export interface DockProps {
  children: ReactNode;
  /** Edge length of every item. The pill insets itself from this. */
  size?: number;
}

export function Dock({ children, size = 44 }: DockProps) {
  const theme = useTheme();
  const scheme = useColorScheme();
  const reduceMotion = useReducedMotion();

  const pillX = useSharedValue(0);
  const pillWidth = useSharedValue(0);
  /* 0 until the active item has reported a position. Without it the pill would
     be visible at x=0 for one frame and then fly across to where it belongs. */
  const placed = useSharedValue(0);

  const movePillTo = useCallback(
    (rect: { x: number; width: number }) => {
      if (placed.get() === 0) {
        pillX.set(rect.x);
        pillWidth.set(rect.width);
        placed.set(withTiming(1, { duration: 160 }));
        return;
      }

      if (reduceMotion) {
        pillX.set(rect.x);
        pillWidth.set(rect.width);
        return;
      }

      pillX.set(withSpring(rect.x, SPRING_LAYOUT));
      pillWidth.set(withSpring(rect.width, SPRING_LAYOUT));
    },
    [pillX, pillWidth, placed, reduceMotion]
  );

  const pillStyle = useAnimatedStyle(() => ({
    left: pillX.get(),
    width: pillWidth.get(),
    opacity: placed.get(),
  }));

  return (
    <DockContext.Provider value={{ size, movePillTo }}>
      <View style={[styles.shell, { borderColor: theme.border }]}>
        <BlurView
          intensity={40}
          tint={scheme === 'dark' ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        {/* The blur alone is too transparent to read icons against artwork, so a
            tinted wash sits on top of it rather than replacing it. */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: `${theme.surface}CC` }]} />

        <View style={styles.row}>
          <Animated.View
            pointerEvents="none"
            style={[styles.pill, { backgroundColor: theme.surfaceSelected }, pillStyle]}
          />
          {children}
        </View>
      </View>
    </DockContext.Provider>
  );
}

export interface DockItemProps {
  children: ReactNode;
  onPress?: () => void;
  active?: boolean;
  accessibilityLabel?: string;
}

export function DockItem({ children, onPress, active = false, accessibilityLabel }: DockItemProps) {
  const dock = useContext(DockContext);
  const size = dock?.size ?? 44;

  /* Its own position within the dock's row. A ref, not state: the pill is driven
     on the UI thread and re-rendering the item to move it would defeat that. */
  const rect = useRef<{ x: number; width: number } | null>(null);

  function handleLayout(event: LayoutChangeEvent) {
    const { x, width } = event.nativeEvent.layout;
    rect.current = { x, width };
    // Covers the first paint, where layout lands after the effect below has
    // already run with nothing to report.
    if (active) dock?.movePillTo(rect.current);
  }

  /*
   * The one effect in here, and it deliberately sets no state — it writes
   * Reanimated shared values, which do not re-render anything. Selection can
   * change without this item being touched (a parent flipping the active key),
   * and there is no other signal for "I am the active one now".
   */
  const movePillTo = dock?.movePillTo;
  useEffect(() => {
    if (active && rect.current) movePillTo?.(rect.current);
  }, [active, movePillTo]);

  const content = <View style={[styles.item, { width: size, height: size }]}>{children}</View>;

  if (!onPress) {
    return (
      <View onLayout={handleLayout} collapsable={false}>
        {content}
      </View>
    );
  }

  return (
    <PressableScale
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onLayout={handleLayout}
      scaleTo={0.88}>
      {content}
    </PressableScale>
  );
}

export function DockSeparator() {
  const theme = useTheme();
  return <View style={[styles.separator, { backgroundColor: theme.border }]} />;
}

const styles = StyleSheet.create({
  shell: {
    alignSelf: 'center',
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x4,
    paddingHorizontal: Spacing.x8,
    paddingVertical: Spacing.x4,
  },
  pill: {
    position: 'absolute',
    top: Spacing.x4,
    bottom: Spacing.x4,
    borderRadius: Radius.control,
  },
  item: { alignItems: 'center', justifyContent: 'center' },
  separator: { width: StyleSheet.hairlineWidth, height: 22, marginHorizontal: Spacing.x4 },
});
