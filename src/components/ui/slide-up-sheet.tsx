import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Radius, Spacing, TapTarget, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * How the sheet arrives and leaves.
 *
 * Damped just under critical, so it settles with one shallow overshoot rather
 * than sliding to a dead stop. Heavier than `ARRIVAL_CONTROL`: this is a whole
 * surface moving, and it should read as having some mass behind it.
 */
const RISE = { damping: 26, stiffness: 190, mass: 1 } as const;

/** Dismissal is faster than arrival, as an exit always should be. */
const FALL_MS = 220;

/**
 * How far down it has to be dragged before releasing dismisses it.
 *
 * A release *anywhere* closing the sheet is the literal reading of "drag down
 * and let go", and it is a trap: a two-pixel twitch while reaching for the list
 * would throw the screen away. Sixty points is unmistakably a drag and still
 * well short of effortful — and a downward flick dismisses from anywhere, so the
 * threshold never stands between a deliberate gesture and its result.
 */
const DISMISS_AT = 60;

/** A flick counts even when it has not travelled far. dp per second. */
const DISMISS_VELOCITY = 700;

/** Resistance on an upward drag. There is nothing above full screen. */
const RUBBER_BAND = 0.2;

export type SlideUpSheetProps = {
  /** Mount and raise it. The caller keeps this in state. */
  visible: boolean;
  onClose: () => void;
  /** Shown in the grabber row, beside the close control. */
  title?: string;
  children: ReactNode;
};

/**
 * A screen that rises over the one beneath it.
 *
 * The music-player pattern: it comes up from the bottom, settles full-screen,
 * and is pulled back down by its own top edge. The page underneath never
 * unmounts, so dismissing it is a reveal rather than a navigation — which is the
 * entire reason this is a sheet and not a route.
 *
 * ## What the gesture is attached to
 *
 * The grabber, not the whole sheet. The body scrolls, and a pan on the container
 * would have to negotiate with that scroll on every drag — the well-known
 * failure where a sheet dismisses when you meant to scroll its content. Giving
 * the drag its own 44dp handle at the top removes the negotiation entirely: the
 * two gestures never occupy the same pixels.
 *
 * ## Reduce Motion
 *
 * The slide becomes a crossfade and the drag still works. Movement is what the
 * setting asks to be spared, not control — a sheet you cannot pull down because
 * you asked for less animation would be answering an accessibility preference by
 * removing an affordance.
 */
export function SlideUpSheet({ visible, onClose, title, children }: SlideUpSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  /** Distance below its resting place, in dp. `height` is fully dismissed. */
  const offset = useSharedValue(height);

  useEffect(() => {
    if (visible) {
      offset.set(reduceMotion ? 0 : withSpring(0, RISE));
    } else {
      offset.set(height);
    }
  }, [visible, height, offset, reduceMotion]);

  function dismiss() {
    if (reduceMotion) {
      offset.set(height);
      onClose();
      return;
    }
    offset.set(
      withTiming(height, { duration: FALL_MS, easing: Easing.in(Easing.cubic) }, (finished) => {
        'worklet';
        if (finished) runOnJS(onClose)();
      })
    );
  }

  const drag = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onUpdate((event) => {
      'worklet';
      /* Down follows the finger exactly; up resists, because there is nothing
         above a full-screen sheet to reveal. */
      offset.set(event.translationY > 0 ? event.translationY : event.translationY * RUBBER_BAND);
    })
    .onEnd((event) => {
      'worklet';
      const far = event.translationY > DISMISS_AT;
      const flicked = event.velocityY > DISMISS_VELOCITY;

      if (far || flicked) {
        runOnJS(dismiss)();
        return;
      }
      offset.set(withSpring(0, RISE));
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.get() }],
    /* Under Reduce Motion the sheet does not travel, so opacity is the only
       thing left to carry the transition. */
    opacity: reduceMotion ? interpolate(offset.get(), [0, height], [1, 0], 'clamp') : 1,
  }));

  /* The page beneath darkens as the sheet rises and comes back as it falls, so
     the two read as one surface moving rather than two crossfading. */
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(offset.get(), [0, height], [1, 0], 'clamp'),
  }));

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: withAlpha(theme.shadowInk, 0.5) },
          scrimStyle,
        ]}
        pointerEvents="none"
      />

      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: theme.background, paddingTop: insets.top },
          sheetStyle,
        ]}>
        <GestureDetector gesture={drag}>
          <View style={styles.grabRow}>
            {/* The handle. Centred and the full width of the row, so the drag
                target is the whole top edge rather than the 36dp bar drawn in
                it — the bar is the *sign*, not the hit area. */}
            <View style={[styles.grabber, { backgroundColor: theme.borderStrong }]} />

            {title && (
              <Text variant="h5" numberOfLines={1} style={styles.grabTitle}>
                {title}
              </Text>
            )}

            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={dismiss}
              scaleTo={0.9}
              style={styles.close}>
              <Ionicons name="chevron-down" size={22} color={theme.textSecondary} />
            </PressableScale>
          </View>
        </GestureDetector>

        <View style={styles.body}>{children}</View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    /* The four offsets written out: `StyleSheet.absoluteFillObject` is gone from
       the RN 0.86 types, and this style is spread into an array rather than used
       alone, so `StyleSheet.absoluteFill` would not compose. */
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    overflow: 'hidden',
  },
  grabRow: {
    height: TapTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.x16,
  },
  grabber: { position: 'absolute', top: Spacing.x8, width: 36, height: 4, borderRadius: 2 },
  grabTitle: { marginTop: Spacing.x8 },
  close: {
    position: 'absolute',
    right: Spacing.x8,
    height: TapTarget,
    width: TapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
});
