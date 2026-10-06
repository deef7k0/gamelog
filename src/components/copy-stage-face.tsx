import { LinearGradient } from 'expo-linear-gradient';
import { memo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type DerivedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { FacePose } from '@/lib/stage-geometry';

export type StageFaceProps = {
  /** Where the camera puts this face now. Solved on the UI thread; see `lib/stage-geometry`. */
  pose: DerivedValue<FacePose>;
  /** The face as it is laid out, square on and at full size. */
  width: number;
  height: number;
  /** The camera's axis in the stage: every face is centred on it. */
  centreX: number;
  centreY: number;
  /** How far the face is carried down the screen, in dp. A disc standing on the floor. */
  drop?: SharedValue<number>;
  children: ReactNode;
};

/**
 * One face of the object on the copy's stage.
 *
 * Two nested views, because that is the whole of what both platforms draw the
 * same way: the inner one turns about its own centre under a perspective, the
 * outer one places and sizes the result on the screen. `lib/stage-geometry`
 * says why it cannot be one view with one matrix, and works out the five
 * numbers; this only applies them.
 *
 * A face turned from the camera is not drawn: there is no back-face culling to
 * rely on, and a view turned past edge-on shows its contents mirrored.
 *
 * Never touchable. The stage's one gesture detector reads every tap and drag,
 * and a face under a finger is somewhere else a frame later.
 */
export const StageFace = memo(function StageFace({
  pose,
  width,
  height,
  centreX,
  centreY,
  drop,
  children,
}: StageFaceProps) {
  const outer = useAnimatedStyle(() => {
    const now = pose.get();
    return {
      opacity: now.visible ? 1 : 0,
      transform: [
        { translateX: now.tx },
        { translateY: drop ? drop.get() : 0 },
        { scaleX: now.sx },
        { scaleY: now.sy },
      ],
    };
  });

  const inner = useAnimatedStyle(() => {
    const now = pose.get();
    return { transform: [{ perspective: now.perspective }, { rotateY: `${now.angle}deg` }] };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.face,
        { left: centreX - width / 2, top: centreY - height / 2, width, height },
        outer,
      ]}>
      <Animated.View style={[{ width, height }, inner]}>{children}</Animated.View>
    </Animated.View>
  );
});

/** The two reflections in the strip, as shares of its length, and how bright each is. */
const GLINT = { at: 0.5, half: 0.06, peak: 0.2 } as const;
const ECHO = { at: 0.8125, half: 0.034, peak: 0.11 } as const;
/** The strip is this many faces long, so a reflection can wait well off either edge. */
const STRIP = 4;
/** How far the reflections lean from upright. */
const LEAN = '14deg';

export type StageLightProps = {
  width: number;
  height: number;
  /** How much of the lamp the face has lost, 0–1 (`lampShade`). */
  shade: DerivedValue<number>;
  /** Where the reflection lies across the face (`lampGlint`). A narrow edge has none. */
  glint?: DerivedValue<number>;
  /** How dark a face fully turned from the lamp gets. */
  depth?: number;
  /** A sealed copy's film is glossier than the case under it. */
  gloss?: number;
};

/**
 * The lamp on one face: how dark the face has gone turning from it, and the
 * reflection that crosses the face as it comes round.
 *
 * Drawn inside the face, so both are foreshortened with it. The reflection is a
 * long strip holding two soft bands — the lamp, and a fainter echo a face and a
 * quarter along — slid sideways under the face's own clip; nothing is redrawn
 * as it moves. Two, so that the phone tilted either way brings one in.
 *
 * **This is the one place a case catches a moving light**, and it is the
 * showcase's own layer: the protected `<GameCase>` and its fixed 0.20 gloss are
 * untouched, and no brighter than they were (DESIGN.md § 4.3.1). The reflection
 * peaks at that same 0.20; `gloss` raises it for a sealed copy's film, to 0.30,
 * and for nothing else.
 */
export const StageLight = memo(function StageLight({
  width,
  height,
  shade,
  glint,
  depth = 0.5,
  gloss = 1,
}: StageLightProps) {
  const theme = useTheme();

  const dark = useAnimatedStyle(() => ({ opacity: shade.get() * depth }));
  const slide = useAnimatedStyle(() => ({
    transform: [{ translateX: ((glint ? glint.get() : 0) - STRIP * GLINT.at) * width }],
  }));

  const clear = withAlpha(theme.text, 0);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip]}>
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.shadowInk }, dark]}
      />
      {!!glint && (
        <Animated.View
          style={[
            styles.strip,
            { top: -height * 0.35, width: width * STRIP, height: height * 1.7 },
            slide,
          ]}>
          <View style={[styles.fill, { transform: [{ rotate: LEAN }] }]}>
            <LinearGradient
              colors={[
                clear,
                clear,
                withAlpha(theme.text, Math.min(0.32, GLINT.peak * gloss)),
                clear,
                clear,
                withAlpha(theme.text, Math.min(0.2, ECHO.peak * gloss)),
                clear,
                clear,
              ]}
              locations={[
                0,
                GLINT.at - GLINT.half,
                GLINT.at,
                GLINT.at + GLINT.half,
                ECHO.at - ECHO.half,
                ECHO.at,
                ECHO.at + ECHO.half,
                1,
              ]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
        </Animated.View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  face: { position: 'absolute' },
  clip: { overflow: 'hidden' },
  strip: { position: 'absolute', left: 0 },
  fill: { flex: 1 },
});
