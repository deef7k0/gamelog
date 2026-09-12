import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { SoftGlow } from '@/components/ui/soft-glow';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { mix } from '@/lib/color';

/**
 * Peak paint alpha at the light's centre, at full travel.
 *
 * A ceiling, solved for rather than chosen: the word sits close to the centre
 * now that the light comes from the screen edge rather than from a narrow margin
 * beside the art, so white type has to survive nearly the full strength of it.
 * Measured across all ten identity hues plus the house blue, `0.39` is the most
 * that holds 4.5:1 under the label — with the label at `LABEL_RATIO`, which was
 * solved for at the same time.
 *
 * It is lower than the 0.9 this carried when the glow lived in the margin, and
 * the light still reads far more strongly — because it is now roughly six times
 * the area. Coverage, not intensity, is what makes it present.
 */
const PEAK = 0.39;

/**
 * How far the light's core is lifted toward white, before the hue is spent.
 *
 * The light has to out-brighten a page painted in the *same hue*, so raising
 * alpha alone barely separates it — at full alpha the accent is only 2.4:1 on
 * its own ambience. Lifting the core toward white is what buys the step, and
 * 45% is the ceiling: past that it stops reading as this game's colour and
 * starts reading as a white lamp.
 */
const HUE_LIFT = 0.45;

/**
 * How much the light swells past the commit point, as a scale factor.
 *
 * A *scale*, not a second glow stacked on the first. Two layers doubled the
 * Skia canvases on this screen and composited to an alpha the label could not
 * survive. Widening the same light costs one transform on the UI thread and adds
 * no alpha at all.
 */
const BLOOM_SCALE = 0.08;

/** Where the light's centre sits, as a fraction of the half-screen it fills. */
const CENTRE_RATIO = 0.14;

/** How tall the light is, as a fraction of the display. */
const HEIGHT_RATIO = 0.55;

/**
 * Where the word sits, as a fraction of the half-screen the light fills.
 *
 * Solved jointly with `PEAK`, because the two trade against each other: the
 * further out the word sits the brighter the light may be, but past ~0.35 it
 * starts running under the cover, which paints above this layer and would clip
 * it. At 0.35 the word clears the artwork on every shipped width — the tightest
 * is a 393dp display, where it ends 2.6dp inside the cover's edge.
 *
 * A first pass put it at 0.21, which is 93% of the way up the ramp: essentially
 * *on* the peak, which is why `PEAK` was capped at 0.34 and the light read at
 * only 1.57:1.
 */
const LABEL_RATIO = 0.35;

/** Half the label's box, in dp. Centred on `LABEL_RATIO`. */
const LABEL_HALF = 48;

/** Travel at which the icon and word begin to resolve, as a fraction of commit. */
const LABEL_ONSET = 0.3;

export type SwipeEdgeProps = {
  side: 'left' | 'right';
  /** Live card offset in dp. Negative is a drag left. */
  dealX: SharedValue<number>;
  /** Springs to 1 while the swipe is past the point where releasing deals. */
  bloom: SharedValue<number>;
  /** Travel in dp at which the swipe commits. */
  commitAt: number;
  /** Nothing behind you: the light stays low and the word is struck through. */
  blocked?: boolean;
  /** Full display width. The light fills half of it. */
  screenWidth: number;
  /** Full display height. The light spans it. */
  screenHeight: number;
  /** The game's own hue. */
  color: string;
  /** Page colour, for the gradient's mid stop. */
  background: string;
};

/**
 * The light at the edge of the screen.
 *
 * ## What it is
 *
 * A circular light rising out of the left or right edge of the display, which
 * brightens as you push the card toward it and carries the name of what
 * releasing will do. It is the same gesture the haptic already marks, given a
 * second sense: by the time the word is fully resolved, the swipe has passed the
 * point where letting go deals.
 *
 * ## Why it is a stretched circle
 *
 * The gradient is circular — one `<SoftGlow>`, one radial ramp — and the whole
 * layer is then scaled vertically. That is what lets it span the full height of
 * the display while its *horizontal* reach still ends exactly at the middle of
 * the screen: the radius sets the reach, the scale sets the coverage, and
 * neither has to compromise for the other. Building it as a genuinely elliptical
 * gradient would have meant leaving `<SoftGlow>` behind and hand-rolling a
 * second Skia component for the same picture.
 *
 * ## Why the centre is on screen
 *
 * The instinct is to push the circle's centre off the display so no silhouette
 * can show. `<SoftGlow>`'s own docblock records that as cause #2 of the
 * component once rendering nothing visible: at an off-screen centre only 6.4% of
 * the disc was on screen and every visible pixel came from the outer, nearly
 * transparent half of the ramp. There is no silhouette to hide, because the
 * gradient already ends fully transparent. So the centre sits just inside the
 * edge and the falloff is aimed instead — `CENTRE_RATIO` plus a radius of
 * whatever remains puts zero exactly at mid-screen.
 *
 * ## Why the colour is the game's own
 *
 * Because the page is too. A light in some fixed hue would clash on nine games
 * out of ten, and one in a *contrasting* hue would be the only colour on screen
 * that came from nowhere. The room is lit by the game; pushing its cover spills
 * more of the same light. Legibility is bought with luminance instead — see
 * `PEAK` and `HUE_LIFT`.
 */
export function SwipeEdge({
  side,
  dealX,
  bloom,
  commitAt,
  blocked = false,
  screenWidth,
  screenHeight,
  color,
  background,
}: SwipeEdgeProps) {
  const core = mix(color, '#FFFFFF', HUE_LIFT);

  /* Half the display: the light may fill it and must not cross it. */
  const width = Math.round(screenWidth / 2);
  const centreX = Math.round(width * CENTRE_RATIO);
  /* Whatever is left. The ramp therefore reaches zero at exactly mid-screen —
     not at a container edge, which is the thing that would show a seam. */
  const radius = width - centreX;
  /* One circle, stretched. The radius already spends itself horizontally, so
     height comes from the scale rather than from a bigger disc. */
  const stretch = (screenHeight * HEIGHT_RATIO) / radius;
  /* Positioned in dp rather than as a percentage so the box is a known width and
     can be checked against where the cover starts. */
  const labelInset = Math.round(width * LABEL_RATIO) - LABEL_HALF;

  /** `1` when the card is being pushed toward this edge, else `0`. */
  const towards = side === 'left' ? -1 : 1;

  const glowStyle = useAnimatedStyle(() => {
    const travel = dealX.get() * towards;
    /* Only this edge's own direction lights it. The other edge reads a negative
       here and clamps to zero, which is the cross-fade: one side comes up as the
       other goes out, with no second value to keep in step. */
    const progress = interpolate(travel, [0, commitAt], [0, 1], 'clamp');

    return {
      opacity: progress * (blocked ? 0.5 : 1),
      transform: [
        { scaleY: stretch * (1 + bloom.get() * (blocked ? 0 : BLOOM_SCALE)) },
        { scaleX: 1 + bloom.get() * (blocked ? 0 : BLOOM_SCALE) },
      ],
    };
  });

  const labelStyle = useAnimatedStyle(() => {
    const travel = dealX.get() * towards;
    const progress = interpolate(travel, [0, commitAt], [0, 1], 'clamp');

    return {
      opacity: interpolate(progress, [LABEL_ONSET, 1], [0, 1], 'clamp'),
      transform: [
        { scale: interpolate(progress, [LABEL_ONSET, 1], [0.88, 1], 'clamp') + bloom.get() * 0.05 },
        /* Drifts inward as it resolves, in the direction the card is going. */
        { translateX: interpolate(progress, [0, 1], [towards * -10, 0]) },
      ],
    };
  });

  const label = side === 'left' ? 'Another game' : 'Previous game';
  const icon = side === 'left' ? 'shuffle' : 'arrow-undo';

  return (
    <View
      style={[styles.edge, side === 'left' ? { left: 0 } : { right: 0 }, { width }]}
      pointerEvents="none"
      /* Decorative: the gesture it describes is already announced by the card's
         own hint and by its two accessibility actions. */
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden>
      <Animated.View style={[StyleSheet.absoluteFill, glowStyle]}>
        <SoftGlow
          color={core}
          /* The mid stop half-way to the page colour, so the ramp lands on the
             room it is lighting rather than on a second hue. */
          secondaryColor={mix(core, background, 0.5)}
          opacity={PEAK}
          size={radius * 2}
          offsetX={side === 'left' ? centreX : width - centreX}
          /* Centred in its own layer; the stretch above spans the display. */
          offsetY={Math.round(screenHeight / 2)}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.label,
          side === 'left' ? { left: labelInset } : { right: labelInset },
          labelStyle,
        ]}>
        <Ionicons
          name={icon}
          size={24}
          color="#F5F5F5"
          style={blocked ? styles.struck : undefined}
        />
        <Text variant="label" numberOfLines={2} style={[styles.word, blocked && styles.struckWord]}>
          {label}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  edge: { position: 'absolute', top: 0, bottom: 0, overflow: 'hidden' },
  /*
   * Vertically centred in the display; horizontal position is `LABEL_RATIO`,
   * which is solved against `PEAK` and against where the cover begins.
   */
  label: {
    position: 'absolute',
    top: '50%',
    width: LABEL_HALF * 2,
    marginTop: -30,
    alignItems: 'center',
    gap: Spacing.x4,
  },
  /* Near-white, not a theme token: this sits on light whose strength changes
     under the finger, and `PEAK` is solved so white is the one ink that holds on
     every hue at every point in the ramp. */
  word: { color: '#F5F5F5', textAlign: 'center' },
  /* Nothing behind you. The word is the same word — struck, not replaced — so
     the edge says "this, unavailable" rather than teaching a second phrase. */
  struck: { opacity: 0.5 },
  struckWord: { opacity: 0.5, textDecorationLine: 'line-through' },
});
