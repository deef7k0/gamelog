import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { FlatList, Modal, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Spacing, TapTarget, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type Screenshot = { url: string; label: string };

/** How far a shot can be pinched in. Four times shows a 1080p shot's own pixels on most phones. */
const MAX_ZOOM = 4;

/** Where a double tap takes it. */
const DOUBLE_TAP_ZOOM = 2.5;

/** Under this it counts as not zoomed, and settles back to whole. */
const ZOOM_FLOOR = 1.02;

/** The settle back into bounds, and a double tap's zoom. */
const SETTLE_MS = 220;

/**
 * IGDB serves any size from the same image id; the rail draws `screenshot_big`
 * (889×500), and a phone held sideways wants more than that.
 */
function large(url: string): string {
  return url.replace(/t_screenshot_big|t_screenshot_med/, 't_1080p');
}

/**
 * A game's screenshots, one at a time, the width of the screen — the owner's
 * direction (2026-10-15): "make game page screenshots expandable" — and each
 * one zoomable (2026-10-16): "I want the users to be able to zoom-in on the
 * screenshots".
 *
 * Opened at the one that was tapped; swipe for the rest. Black behind them,
 * each fitted whole rather than cropped (the rail crops to 16:9), a count and
 * a close key at the top, and Android's back closes it.
 *
 * **Pinch to zoom, double tap to zoom in or out, drag to look round a zoomed
 * shot** (`<ZoomableShot>`). While a shot is zoomed the swipe between shots is
 * off, so a drag moves the picture and not the page; at its whole size the
 * swipe is back.
 */
export function ScreenshotViewer({
  shots,
  index,
  onClose,
}: {
  shots: readonly Screenshot[];
  /** The one opened at, or null when the viewer is closed. */
  index: number | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const [current, setCurrent] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const visible = index !== null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
      onShow={() => {
        setCurrent(index ?? 0);
        setZoomed(false);
      }}>
      {/* A modal is its own window on Android, outside the app's root
          gesture view: it needs one of its own for the pinch to be heard. */}
      <GestureHandlerRootView style={[styles.root, { backgroundColor: theme.shadowInk }]}>
        {visible && (
          <FlatList
            data={shots}
            keyExtractor={(shot) => shot.url}
            horizontal
            pagingEnabled
            scrollEnabled={!zoomed}
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={index ?? 0}
            getItemLayout={(_, item) => ({ length: width, offset: width * item, index: item })}
            onMomentumScrollEnd={(event) =>
              setCurrent(Math.round(event.nativeEvent.contentOffset.x / width))
            }
            initialNumToRender={2}
            windowSize={3}
            renderItem={({ item }) => (
              <ZoomableShot shot={item} width={width} height={height} onZoomChange={setZoomed} />
            )}
          />
        )}

        <SafeAreaView style={styles.top} edges={['top']} pointerEvents="box-none">
          <View style={styles.bar}>
            <Text variant="itemTitle" color="white">
              {`${Math.min(current, shots.length - 1) + 1} / ${shots.length}`}
            </Text>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Close screenshots"
              onPress={onClose}
              scaleTo={0.9}
              style={StyleSheet.flatten([
                styles.close,
                { backgroundColor: withAlpha(theme.white, 0.14) },
              ])}>
              <Ionicons name="close" size={22} color={theme.white} />
            </PressableScale>
          </View>
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

/**
 * One screenshot, filling a page, that can be pinched, double-tapped and
 * dragged.
 *
 * The point under the fingers stays under them as it zooms — the translation
 * is solved for it — and the picture never leaves a gap at an edge: it is
 * held inside its bounds as it moves, and eased back into them when a gesture
 * ends. Everything runs on the UI thread; React hears only "zoomed" or "not",
 * which is what turns the page swipe off.
 */
function ZoomableShot({
  shot,
  width,
  height,
  onZoomChange,
}: {
  shot: Screenshot;
  width: number;
  height: number;
  onZoomChange: (zoomed: boolean) => void;
}) {
  const reduceMotion = useReducedMotion();
  /* The picture's own box: the width of the screen, at 16:9. */
  const imageHeight = width * (9 / 16);

  const scale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  /* Where each was when the gesture began. */
  const startScale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  /* The fingers' midpoint, from the page's centre, when the pinch began. */
  const focusX = useSharedValue(0);
  const focusY = useSharedValue(0);

  /** How far the picture may move each way at a scale, so no edge comes inside the page. */
  const bounds = (at: number) => {
    'worklet';
    return {
      x: Math.max(0, (width * at - width) / 2),
      y: Math.max(0, (imageHeight * at - height) / 2),
    };
  };

  const clamp = (value: number, limit: number) => {
    'worklet';
    return Math.min(limit, Math.max(-limit, value));
  };

  /** Ease (or jump, under Reduce Motion) to a scale and a place, kept in bounds. */
  const settle = (to: number, toX: number, toY: number) => {
    'worklet';
    const limit = bounds(to);
    const nextX = clamp(toX, limit.x);
    const nextY = clamp(toY, limit.y);
    const duration = reduceMotion ? 0 : SETTLE_MS;
    scale.set(withTiming(to, { duration }));
    x.set(withTiming(nextX, { duration }));
    y.set(withTiming(nextY, { duration }));
    runOnJS(onZoomChange)(to > ZOOM_FLOOR);
  };

  const pinch = Gesture.Pinch()
    .onStart((event) => {
      startScale.set(scale.get());
      startX.set(x.get());
      startY.set(y.get());
      focusX.set(event.focalX - width / 2);
      focusY.set(event.focalY - height / 2);
    })
    .onUpdate((event) => {
      /* A little past the ends while the fingers are down; settled on release. */
      const next = Math.min(MAX_ZOOM * 1.15, Math.max(0.85, startScale.get() * event.scale));
      const ratio = next / startScale.get();
      scale.set(next);
      /* Keep the point that was under the fingers under them. */
      x.set(focusX.get() - (focusX.get() - startX.get()) * ratio);
      y.set(focusY.get() - (focusY.get() - startY.get()) * ratio);
    })
    .onEnd(() => {
      const to = Math.min(MAX_ZOOM, Math.max(1, scale.get()));
      if (to <= ZOOM_FLOOR) settle(1, 0, 0);
      else settle(to, x.get(), y.get());
    });

  /*
   * A drag moves a zoomed picture, and is let go — to the page swipe — when
   * the picture is whole. Decided as the finger moves, so a swipe between
   * shots is never held up waiting for this to fail.
   */
  const pan = Gesture.Pan()
    .manualActivation(true)
    .onTouchesMove((_event, state) => {
      if (scale.get() > ZOOM_FLOOR) state.activate();
      else state.fail();
    })
    .onStart(() => {
      startX.set(x.get());
      startY.set(y.get());
    })
    .onUpdate((event) => {
      const limit = bounds(scale.get());
      x.set(clamp(startX.get() + event.translationX, limit.x));
      y.set(clamp(startY.get() + event.translationY, limit.y));
    });

  /* In to the tapped point, or back out to the whole picture. */
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event) => {
      if (scale.get() > ZOOM_FLOOR) {
        settle(1, 0, 0);
        return;
      }
      const tapX = event.x - width / 2;
      const tapY = event.y - height / 2;
      settle(DOUBLE_TAP_ZOOM, -tapX * (DOUBLE_TAP_ZOOM - 1), -tapY * (DOUBLE_TAP_ZOOM - 1));
    });

  const gesture = Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan));

  const zoomStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: scale.get() }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={[styles.page, { width, height }]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={shot.label}
        accessibilityHint="Pinch or double tap to zoom.">
        <Animated.View style={zoomStyle}>
          <Image
            source={{ uri: large(shot.url) }}
            placeholder={{ uri: shot.url }}
            style={{ width, height: imageHeight }}
            contentFit="contain"
            transition={160}
            accessibilityIgnoresInvertColors
          />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  page: { justifyContent: 'center', overflow: 'hidden' },
  top: { position: 'absolute', top: 0, left: 0, right: 0 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.x16,
    paddingTop: Spacing.x8,
  },
  close: {
    width: TapTarget,
    height: TapTarget,
    borderRadius: TapTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
