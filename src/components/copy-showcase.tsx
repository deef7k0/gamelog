import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { CdDisc } from '@/components/cd-disc';
import { CopyCaseBack } from '@/components/copy-case-back';
import { caseHeightFor } from '@/components/game-case';
import { GameCaseDisplay } from '@/components/game-case-display';
import { CONDITION_LABEL, completenessLabel, mediumFor, releaseLine } from '@/constants/physical';
import { PLATFORMS, hasCase, type PlatformKey } from '@/constants/platform-cases';
import { platformKeyForStored } from '@/constants/platform-family';
import { PosterAspectRatio } from '@/constants/theme';
import { useArrival } from '@/hooks/use-arrival';
import { useTheme } from '@/hooks/use-theme';
import type { CopyWithRelations } from '@/lib/api';

/*
 * The turn, copied from `<GameCaseFlip>` rather than shared.
 *
 * That component is protected, and its tap already means "turn over" — here a
 * tap takes the disc out, so the gesture has to be composed again. Its numbers
 * are kept exactly so the two cases in the app weigh the same in the hand.
 */
const TURN_PER_WIDTH = 1.15;
const COMMIT_ANGLE = 52;
const FLING_VELOCITY = 550;
const OVERTURN = 22;
const READ_SCALE = 1.08;
const TURN = { damping: 18, stiffness: 140, mass: 0.8 } as const;

/**
 * How much of the disc shows once it is out: a little over half, with the rest
 * still under the art — the way a disc sits half out of its sleeve.
 */
const REVEAL = 0.58;

/** The disc turns this far as it slides, so it reads as a disc and not a plate. */
const DISC_TURN = 34;

/** Lighter than the case's turn: a disc is a thin thing on a smooth sleeve. */
const SLIDE = { damping: 17, stiffness: 150, mass: 0.7 } as const;

/** The case's cast, from DESIGN.md § 4.1.7, for the back face it does not draw. */
const CASE_CAST = {
  shadowOpacity: 0.45,
  shadowRadius: 18,
  shadowOffset: { width: 6, height: 12 },
  elevation: 12,
} as const;

export type CopyShowcaseProps = {
  copy: CopyWithRelations;
  /** The width the showcase may use; it centres itself inside it. */
  width: number;
  /** The page colour, which is what shows through the disc's centre hole. */
  pageColor: string;
};

/**
 * One physical copy, as the object it is: its case, and the disc inside it.
 *
 * **Tap and the disc slides out** from under the art, to the right, until a
 * little over half of it shows — turning as it goes — and the pair re-centres so
 * the composition stays balanced. Tap again and it goes back. **Drag sideways and
 * the case turns over**, exactly as the game page's does, to a back printing
 * what this box is (`<CopyCaseBack>`). The disc tucks itself in first; a case is
 * not turned over with its disc hanging out.
 *
 * The case is the platform's own (`<GameCaseDisplay>`, untouched): PS5, PS4,
 * Xbox and Switch get their templates, everything else its bare box art. Those
 * have no case to turn over, so they keep the disc and lose the turn — the same
 * rule the game page follows.
 *
 * A screen reader gets both as actions on one element, with everything both
 * faces print in its label: nothing here is only reachable by a gesture.
 */
export function CopyShowcase({ copy, width, pageColor }: CopyShowcaseProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const landed = useArrival();

  /* A copy with no platform recorded is shown as bare art: drawing a PS5 case
     round a box whose platform nobody wrote down would be inventing it. */
  const platform: PlatformKey = platformKeyForStored(copy.platform) ?? 'other';
  const flippable = hasCase(platform);

  /* The case takes a little over half the width so the disc has room to come
     out beside it; capped so a wide phone does not get a case taller than the
     screen can hold with the facts below it. */
  const caseWidth = Math.round(Math.min(width * 0.54, 230));
  const caseHeight = flippable ? caseHeightFor(caseWidth) : caseWidth / PosterAspectRatio;
  /* Small enough to hide completely behind the art when it is in. */
  const disc = Math.round(Math.min(caseHeight * 0.84, caseWidth * 0.98));
  const reveal = disc * REVEAL;
  const discIn = (caseWidth - disc) / 2;
  const discOut = caseWidth + reveal - disc;

  const [discShown, setDiscShown] = useState(false);
  const out = useSharedValue(0);
  const turn = useSharedValue(0);
  const facing = useSharedValue(0);

  const tick = useCallback(() => {
    if (Platform.OS === 'web') return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const setDisc = useCallback(
    (next: boolean) => {
      setDiscShown(next);
      out.set(
        reduceMotion ? withTiming(next ? 1 : 0, { duration: 140 }) : withSpring(next ? 1 : 0, SLIDE)
      );
      tick();
      AccessibilityInfo.announceForAccessibility(next ? 'Disc out' : 'Disc back in the case');
    },
    [out, reduceMotion, tick]
  );

  const settle = useCallback(
    (toBack: boolean) => {
      const target = toBack ? 180 : 0;
      facing.set(target);
      turn.set(reduceMotion ? withTiming(target, { duration: 140 }) : withSpring(target, TURN));
      AccessibilityInfo.announceForAccessibility(toBack ? 'Showing this copy' : 'Showing cover');
    },
    [facing, reduceMotion, turn]
  );

  const tap = Gesture.Tap().onEnd(() => {
    /* On the back, a tap brings the front round rather than reaching for a disc
       that is behind the case. */
    if (facing.get() >= 90) runOnJS(settle)(false);
    else runOnJS(setDisc)(out.get() < 0.5);
  });

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-14, 14])
    .enabled(flippable)
    .onStart(() => {
      if (out.get() > 0.01) runOnJS(setDisc)(false);
    })
    .onUpdate((event) => {
      const swept = (event.translationX / (caseWidth * TURN_PER_WIDTH)) * 180;
      turn.set(Math.max(-OVERTURN, Math.min(180 + OVERTURN, facing.get() + swept)));
    })
    .onEnd((event) => {
      const swept = (event.translationX / (caseWidth * TURN_PER_WIDTH)) * 180;
      const ended = facing.get() + swept;
      const toBack =
        Math.abs(event.velocityX) > FLING_VELOCITY
          ? event.velocityX > 0
          : facing.get() < 90
            ? ended > COMMIT_ANGLE
            : ended > 180 - COMMIT_ANGLE;
      runOnJS(settle)(toBack);
    });

  const gesture = Gesture.Exclusive(pan, tap);

  /* The pair re-centres as the disc comes out: half the reveal, back to 0. */
  const group = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(out.get(), [0, 1], [reveal / 2, 0]) },
      { translateY: interpolate(landed.get(), [0, 1], [-14, 0]) },
    ],
  }));

  const discStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(out.get(), [0, 1], [discIn, discOut]) },
      { rotate: `${interpolate(out.get(), [0, 1], [0, DISC_TURN])}deg` },
    ],
  }));

  const object = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      {
        scale:
          interpolate(landed.get(), [0, 1], [0.92, 1]) *
          interpolate(Math.abs(turn.get()), [0, 180], [1, READ_SCALE], 'clamp'),
      },
      { rotateY: `${turn.get() + interpolate(landed.get(), [0, 1], [14, 0])}deg` },
    ],
  }));

  /* A step at the edge, never a fade — see `<GameCaseFlip>`. */
  const frontFace = useAnimatedStyle(() => ({ opacity: turn.get() < 90 ? 1 : 0 }));
  const backFace = useAnimatedStyle(() => ({ opacity: turn.get() < 90 ? 0 : 1 }));

  const title = copy.game?.title ?? 'A copy';
  const stageHeight = Math.max(caseHeight, disc);

  return (
    <GestureDetector gesture={gesture}>
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={describe(copy, platform, discShown)}
        accessibilityActions={[
          { name: 'activate', label: discShown ? 'Put the disc back' : 'Take the disc out' },
          ...(flippable ? [{ name: 'turn', label: 'Turn the case over' }] : []),
        ]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'turn') settle(facing.get() < 90);
          else setDisc(!discShown);
        }}
        style={[styles.stage, { width: caseWidth + reveal, height: stageHeight }]}>
        <Animated.View
          style={[styles.group, { width: caseWidth, height: stageHeight }, group]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          {/* Drawn first, so it is under the case and hidden while it is in. */}
          <Animated.View
            style={[styles.disc, { top: (stageHeight - disc) / 2, width: disc }, discStyle]}>
            <CdDisc
              coverUrl={copy.game?.cover_url}
              heroUrl={copy.game?.hero_url}
              title={title}
              size={disc}
              holeColor={pageColor}
              cast
            />
          </Animated.View>

          <Animated.View
            style={[
              styles.object,
              { top: (stageHeight - caseHeight) / 2, width: caseWidth, height: caseHeight },
              object,
            ]}>
            <Animated.View style={frontFace}>
              <GameCaseDisplay
                coverUrl={copy.game?.cover_url}
                heroUrl={copy.game?.hero_url}
                title={title}
                edition={
                  copy.edition?.trim() && copy.edition.trim() !== 'Standard' ? copy.edition : null
                }
                platform={platform}
                width={caseWidth}
                tilt={0}
              />
            </Animated.View>
            {flippable && (
              <Animated.View style={[styles.back, backFace]}>
                <View style={[CASE_CAST, { shadowColor: theme.shadowInk }]}>
                  <CopyCaseBack copy={copy} platform={platform} width={caseWidth} />
                </View>
              </Animated.View>
            )}
          </Animated.View>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

/** One sentence carrying both faces, since a screen reader never sees the turn. */
function describe(copy: CopyWithRelations, platform: PlatformKey, discOut: boolean): string {
  const parts = [
    copy.game?.title ?? 'A copy',
    releaseLine(copy) || PLATFORMS[platform].label,
    copy.completeness ? completenessLabel(copy.completeness, mediumFor(platform)) : null,
    copy.condition ? CONDITION_LABEL[copy.condition] : null,
    discOut ? 'Disc out' : null,
  ].filter(Boolean);
  return parts.join('. ');
}

const styles = StyleSheet.create({
  stage: { alignSelf: 'center' },
  group: { position: 'absolute', left: 0, top: 0 },
  disc: { position: 'absolute', left: 0 },
  object: { position: 'absolute', left: 0 },
  back: { position: 'absolute', top: 0, left: 0, transform: [{ rotateY: '180deg' }] },
});
