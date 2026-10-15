import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, View, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { cubicBezier, useReducedMotion, type CSSStyle } from 'react-native-reanimated';

import { paintReach } from '@/lib/paint';

/**
 * How long the paint takes to reach the ends of a pill. It was 380ms and the
 * owner asked for "a little slower" (2026-10-15).
 */
export const PAINT_MS = 560;

/**
 * The curve: Material's standard ease — the paint is born slowly, spreads, and
 * settles. It was emphasized-decelerate, which spent its first frames at full
 * speed: the round blob was past the pill's top and bottom before it could be
 * seen, and what was left looked like two edges sliding apart — "a slide that
 * goes left and right", in the owner's words. Starting gently keeps the circle
 * a circle long enough to read as one.
 */
const POUR = cubicBezier(0.4, 0, 0.2, 1);

/** How quickly the ink on a pill changes over, in step with the paint under it. */
const INK_MS = 160;

/* Scale 0 is a matrix with no inverse, which Android will not draw. */
const DRY = 0.001;

/**
 * The paint pour — the owner's direction (2026-10-15): an outlined pill, once
 * chosen, "fills entirely… like the color being born and expanding from the
 * middle to the edges of the pill until it fills it completely. Like a bucket
 * of paint pouring". And: "Every button with a colored outline must have this
 * behavior. Colored outline > fill in animation > still solid color pill."
 *
 * Drawn as the first child of the pill, which must clip (`overflow: 'hidden'`)
 * and be rounded. It measures the pill and puts a circle of the colour at its
 * centre, sized to stop exactly when it has reached every point inside the
 * shape (`paintReach` — for a pill, the tips of its round ends; `cornerRadius`
 * says how round the corners are, a pill's by default) — and grows it from
 * nothing: round at first, then meeting the top and bottom, then reaching the
 * far ends last. Taking the choice away drains it back to the middle.
 *
 * **A CSS transition on a React prop, not a running animation**, so the pill
 * always comes to rest on what React last rendered — chosen is full, unchosen
 * is empty — and cannot be left half-poured by a re-render (CLAUDE.md, "An
 * animated style's end value can be lost"). A pill that is already chosen when
 * it mounts is simply full; nothing pours on arrival. Under Reduce Motion it
 * fills and empties at once.
 */
export function PaintFill({
  on,
  color,
  cornerRadius,
}: {
  on: boolean;
  color: string;
  /** The pill's corner radius. Omitted: a pill, rounded at half its height. */
  cornerRadius?: number;
}) {
  const reduceMotion = useReducedMotion();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setSize((current) =>
          current && current.width === width && current.height === height
            ? current
            : { width, height }
        );
      }}>
      {size ? (
        <Animated.View style={[disc(size, color, on, cornerRadius), pour(reduceMotion)]} />
      ) : on ? (
        /* Before the pill has been measured, a chosen one is already full. */
        <View style={[StyleSheet.absoluteFill, { backgroundColor: color }]} />
      ) : null}
    </View>
  );
}

function disc(
  size: { width: number; height: number },
  color: string,
  on: boolean,
  cornerRadius = size.height / 2
): ViewStyle {
  /* A hair over the reach, so antialiasing at the very tips is covered too. */
  const diameter = Math.ceil(paintReach(size.width, size.height, cornerRadius) * 2) + 2;
  return {
    position: 'absolute',
    width: diameter,
    height: diameter,
    borderRadius: diameter / 2,
    left: (size.width - diameter) / 2,
    top: (size.height - diameter) / 2,
    backgroundColor: color,
    transform: [{ scale: on ? 1 : DRY }],
  };
}

function pour(reduceMotion: boolean): CSSStyle<ViewStyle> {
  return {
    transitionProperty: 'transform',
    transitionDuration: reduceMotion ? 0 : PAINT_MS,
    transitionTimingFunction: POUR,
  };
}

/**
 * The colour change for the words and glyph on a pill that pours. The paint is
 * born under them — they sit in the middle — so they turn over at once, on a
 * short ease rather than a cut, so a pale ink never flashes on the dark ground
 * for a frame before the paint arrives.
 */
export function inkTransition(reduceMotion: boolean): CSSStyle<TextStyle> {
  return {
    transitionProperty: 'color',
    transitionDuration: reduceMotion ? 0 : INK_MS,
    transitionTimingFunction: 'ease-out',
  };
}

/**
 * An Ionicons glyph whose colour can transition with the words beside it.
 * `<Ionicons>` takes its colour as a prop, which a CSS transition cannot reach,
 * so this draws the same glyph as text in the icon font.
 */
export function PaintGlyph({
  name,
  size,
  color,
}: {
  name: keyof typeof Ionicons.glyphMap;
  size: number;
  color: string;
}) {
  const reduceMotion = useReducedMotion();
  const code = Ionicons.glyphMap[name];
  return (
    <Animated.Text
      accessible={false}
      importantForAccessibility="no"
      style={[
        { fontFamily: 'ionicons', fontSize: size, lineHeight: size, color },
        inkTransition(reduceMotion),
      ]}>
      {typeof code === 'number' ? String.fromCodePoint(code) : ''}
    </Animated.Text>
  );
}
