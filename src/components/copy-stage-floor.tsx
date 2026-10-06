import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  type DerivedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { withAlpha } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';

/** How far the lamp's field and the shadow move with the phone, in dp. */
const LIGHT_SLIDE = 14;

/** How flat the shadow lies: the floor is seen from in front, and only a little above. */
const SHADOW_FLATTEN = 0.105;

export type CopyStageFloorProps = {
  /** Where on the stage the object stands. */
  centreX: number;
  /** From the top of the stage: the middle of the object, and the floor under it. */
  centreY: number;
  floorY: number;
  /** The object's width at rest. The lamp and the shadow are sized from it. */
  footprint: number;
  /** How wide the object stands to the camera now, as a share of `footprint`. */
  spread: DerivedValue<number>;
  /** The phone's tilt, -1…1 each way. */
  tiltX: SharedValue<number>;
  tiltY: SharedValue<number>;
  /** 0 as the screen opens, 1 once the object has landed. */
  landed: SharedValue<number>;
  /** Whether it has, as React knows it — see `useLandingArrival`. */
  settled: boolean;
};

/**
 * What the copy stands on, and the light it stands in.
 *
 * Two things: the **lamp** — one soft field up and to the left of the object,
 * the side the case's shadow has always fallen away from, in the game's own
 * colour (`useAccent`, read off the box art) — and the object's **shadow** on
 * the floor, which narrows as the object turns edge-on. Both are native CSS
 * gradients: no image behind the page, no Skia (CLAUDE.md § Gotchas). Both move
 * a little with the phone, the opposite ways, as a light and the shadow it
 * throws do.
 *
 * **There was a third, and the owner had it removed.** The object stood on a
 * ring of light lying on the floor — a turntable's platter, with a pool inside
 * it and marks round it that went round as the object turned. Their words, the
 * first time they saw it run: "remove the ring below the art where it spins".
 * So the copy turns on nothing. Do not draw a platter, a ring, a disc of light
 * or any other base under it again; the shadow is what stands it on the floor.
 *
 * This is the "one glow per screen" a screen about one game is allowed. It is
 * a lamp for an object, not a gradient behind a page: the page itself stays
 * flat in the game's dark tone.
 */
export const CopyStageFloor = memo(function CopyStageFloor({
  centreX,
  centreY,
  floorY,
  footprint,
  spread,
  tiltX,
  tiltY,
  landed,
  settled,
}: CopyStageFloorProps) {
  const theme = useTheme();
  /* M3's `primary` — the game's hue at tone 80 — as light: always a plain hex,
     where the `glow` role is already translucent and cannot be thinned again. */
  const light = useAccent().m3.primary;

  const lamp = Math.round(footprint * 1.8);
  const shadow = Math.round(footprint * 1.12);

  const lampStyle = useAnimatedStyle(() => ({
    opacity: interpolate(landed.get(), [0, 1], [0, 1]),
    transform: [
      { translateX: tiltX.get() * LIGHT_SLIDE * 1.6 },
      { translateY: tiltY.get() * LIGHT_SLIDE },
    ],
  }));

  const shadowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(landed.get(), [0, 1], [0, 1]),
    transform: [
      { translateX: -tiltX.get() * LIGHT_SLIDE },
      { scaleX: Math.max(0.16, spread.get()) },
      { scaleY: SHADOW_FLATTEN },
    ],
  }));

  const backgrounds = useMemo(
    () => ({
      /* A lamp's field: bright where it falls, then a long tail. Eight stops,
         because a wide gradient on a near-black page bands at three. */
      lamp: `radial-gradient(circle at center, ${withAlpha(light, 0.2)} 0%, ${withAlpha(light, 0.16)} 14%, ${withAlpha(light, 0.115)} 28%, ${withAlpha(light, 0.075)} 42%, ${withAlpha(light, 0.045)} 56%, ${withAlpha(light, 0.022)} 70%, ${withAlpha(light, 0.008)} 85%, ${withAlpha(light, 0)} 100%)`,
      shadow: `radial-gradient(circle at center, ${withAlpha(theme.shadowInk, 0.62)} 0%, ${withAlpha(theme.shadowInk, 0.5)} 30%, ${withAlpha(theme.shadowInk, 0.28)} 58%, ${withAlpha(theme.shadowInk, 0.1)} 80%, ${withAlpha(theme.shadowInk, 0)} 100%)`,
    }),
    [light, theme.shadowInk]
  );

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.layer,
          {
            width: lamp,
            height: lamp,
            left: centreX - lamp / 2 - footprint * 0.24,
            top: centreY - lamp / 2 - footprint * 0.24,
            experimental_backgroundImage: backgrounds.lamp,
          },
          lampStyle,
          settled && styles.shown,
        ]}
      />

      <Animated.View
        style={[
          styles.layer,
          {
            width: shadow,
            height: shadow,
            left: centreX - shadow / 2,
            top: floorY - shadow / 2,
            experimental_backgroundImage: backgrounds.shadow,
          },
          shadowStyle,
          settled && styles.shown,
        ]}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  layer: { position: 'absolute' },
  shown: { opacity: 1 },
});
