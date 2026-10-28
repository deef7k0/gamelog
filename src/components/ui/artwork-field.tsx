import { memo, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

import { FIELD, blobAt, blobGradient, fieldKey } from '@/lib/artwork-field';
import { PINNED_HERO } from '@/lib/scroll-motion';

/** One set of the field's colours, and whether it arrived after the field was up. */
type Layer = { id: number; key: string; colors: readonly string[]; fades: boolean };

/**
 * Material's standard ease, which BitChord's `FastOutSlowInEasing` is — as
 * Reanimated's `cubicBezier()`, never a `'cubic-bezier(…)'` string: its CSS
 * animations accept only the predefined names as strings, and throw on that
 * one at the first render (`paint-fill` passes its ease the same way).
 */
const STANDARD = cubicBezier(0.4, 0, 0.2, 1);

/** A layer of colour arriving: from nothing to what React holds. */
const FADE_IN = { from: { opacity: 0 }, to: { opacity: 1 } } as const;

export type ArtworkFieldProps = {
  /** The page's colour: the field's ground, under every blob. */
  page: string;
  /** The four blob colours (`fieldColors`), or none for the page's colour alone. */
  colors: readonly string[];
};

/**
 * The colour field behind an art-coloured page — BitChord's legacy Now
 * Playing backdrop (`lib/artwork-field` has the rules and the numbers): four
 * soft blobs of the art's colours over the page's colour, filling the screen
 * behind everything. `<Screen backdrop>`'s first layer, under the pinned hero,
 * which dissolves into it.
 *
 * ## Motion, and why none of it can be lost
 *
 * - **The blobs drift once, as the page opens, and then rest** — BitChord's
 *   reason: a backdrop orbiting forever re-draws a full-screen layer every
 *   frame for motion nobody is watching. Each blob is placed where it *rests*,
 *   in React's style, and a CSS keyframe animation carries it there from
 *   where the drift began: when it ends the view stands on its own style, so
 *   there is no end value to lose to a dropped frame (CLAUDE.md, § Gotchas).
 * - **A change of colour is a cross-fade of whole layers**, the seamless
 *   shade switch: the new colours drawn over the old with the same geometry,
 *   fading in over `FIELD.fadeMs`. Over an opaque field with the blobs in the
 *   same places, that is exactly each blob's colour moving from one to the
 *   other — BitChord's four `animateColorAsState`s — and it is a keyframe from
 *   nothing to React's own opacity, so it too rests on what React holds. The
 *   layers under one that has finished arriving are dropped, so a resting
 *   field is four views.
 * - **Under Reduce Motion** nothing moves: the blobs are where they rest, and
 *   a new colour is simply there.
 *
 * Drawn into one hardware texture (`renderToHardwareTextureAndroid`,
 * `shouldRasterizeIOS`): a field that is not moving is composited, not
 * re-drawn, as the page scrolls over it.
 */
export const ArtworkField = memo(function ArtworkField({ page, colors }: ArtworkFieldProps) {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const key = fieldKey(colors);

  /* The colours seen so far, newest last. Seeded with what is known at mount,
     which needs no fade: there is nothing to fade from. Adjusted during
     render when the colours change — React's own pattern for state that
     follows a prop, which needs no effect. */
  const [layers, setLayers] = useState<Layer[]>(() =>
    colors.length > 0 ? [{ id: 0, key, colors, fades: false }] : []
  );
  const newest = layers[layers.length - 1];
  if (colors.length > 0 && newest?.key !== key) {
    setLayers((previous) => [
      /* At most the two under it: a fade cut short shows the one before. */
      ...previous.slice(-2),
      { id: (previous[previous.length - 1]?.id ?? -1) + 1, key, colors, fades: !reduceMotion },
    ]);
  }

  /* Once the newest has finished arriving, what is under it is covered. */
  const newestId = newest?.id;
  const stacked = layers.length > 1;
  useEffect(() => {
    if (!stacked || newestId === undefined) return;
    const timer = setTimeout(
      () => setLayers((previous) => previous.filter((layer) => layer.id >= newestId)),
      FIELD.fadeMs + 100
    );
    return () => clearTimeout(timer);
  }, [stacked, newestId]);

  /* Where each blob rests, and how far back along its orbit it starts. */
  const slots = useMemo(
    () =>
      FIELD.anchors.map((_, index) => {
        const rest = blobAt(index, FIELD.driftRadians, width, height);
        const start = blobAt(index, 0, width, height);
        return { rest, dx: start.x - rest.x, dy: start.y - rest.y };
      }),
    [width, height]
  );

  return (
    <View
      pointerEvents="none"
      renderToHardwareTextureAndroid
      shouldRasterizeIOS
      style={[
        styles.fill,
        {
          backgroundColor: page,
          transitionProperty: 'backgroundColor',
          transitionDuration: PINNED_HERO.arriveMs,
        },
      ]}>
      {slots.map(({ rest, dx, dy }, index) => (
        <Animated.View
          key={index}
          style={[
            styles.blob,
            {
              left: rest.x - rest.radius,
              top: rest.y - rest.radius,
              width: rest.radius * 2,
              height: rest.radius * 2,
            },
            !reduceMotion && {
              animationName: {
                from: { transform: [{ translateX: dx }, { translateY: dy }] },
                to: { transform: [{ translateX: 0 }, { translateY: 0 }] },
              },
              animationDuration: FIELD.driftMs,
              animationTimingFunction: STANDARD,
            },
          ]}>
          {layers.map((layer) => (
            <Animated.View
              key={layer.id}
              style={[
                styles.fill,
                { experimental_backgroundImage: blobGradient(layer.colors[index]) },
                layer.fades && {
                  animationName: FADE_IN,
                  animationDuration: FIELD.fadeMs,
                  animationTimingFunction: STANDARD,
                },
              ]}
            />
          ))}
        </Animated.View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  blob: { position: 'absolute' },
});
