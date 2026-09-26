import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';

import { withAlpha } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { INK_ON_DARK, mix } from '@/lib/color';

/**
 * The light moving across the card as it turns.
 *
 * ## Why this is not a decorative gradient
 *
 * DESIGN.md § 25 bans gradients as decoration, and a permanent sheen painted over
 * box art would be exactly that. **At rest this is at opacity 0.** It only exists
 * while the card is tilting: no tilt, no sheen. That is the whole difference
 * between a texture on a card and a reflection on one, and it is the line this
 * component has to stay on the right side of.
 *
 * It is the same argument § 4.1.7 makes for the game case's own gloss — *"a
 * narrow diagonal sheen across the plastic"* — applied to the app's second
 * depicted object. Peak alpha is deliberately under the case's 0.20: see
 * DESIGN.md § 4.2, which keeps the case superior on every material axis.
 *
 * ## Why `expo-linear-gradient` and not Skia
 *
 * Three Skia canvases already live on this screen (two swipe edges, one bloom).
 * A fourth, over the artwork, on mid-range Android, is what this budget cannot
 * afford. A `<LinearGradient>` with fixed colours rasterises **once**; everything
 * per-frame is a `translateX` and an `opacity` on the wrapper, which is a pure
 * compositor operation with no JS and no Skia in it.
 *
 * ## Why it is a sibling of the artwork rather than inside it
 *
 * `<SquareArt>` is one of two shapes this slot can hold — the other is a 2:3
 * `<Poster>` when SteamGridDB has no square cover — and a sheen built into the
 * first would leave the second unlit. `<Poster>` is on nearly every screen in the
 * app, so a `sheen` prop there would be a prop on forty call sites to change the
 * behaviour of one. Mounted as a sibling, exactly as `<HiddenNotice>` already is,
 * it covers both shapes and touches neither.
 */

/** The band's width, as a fraction of the card's. A reflection, not a wash. */
const WIDTH_RATIO = 0.55;

/**
 * Peak alpha at the band's centre.
 *
 * Under the game case's 0.20 gloss on purpose (DESIGN.md § 4.2). The case is the
 * object allowed to look expensive; this one is allowed to look lit.
 */
const PEAK = 0.16;

/** How much of `PEAK` the single catch-of-light on arrival is worth. */
const ARRIVAL_CATCH = 0.45;

export type SurpriseSheenProps = {
  /** The card's footprint, so the band is clipped to the artwork's own edge. */
  width: number;
  height: number;
  radius: number;
  /** Live card offset. The band's position is a function of it and nothing else. */
  dealX: SharedValue<number>;
  /** Travel at which releasing deals. */
  commitAt: number;
  /** The card's landing spring, for one catch of light as it arrives. */
  arrival: SharedValue<number>;
};

export function SurpriseSheen({
  width,
  height,
  radius,
  dealX,
  commitAt,
  arrival,
}: SurpriseSheenProps) {
  const accent = useAccent();
  const reduceMotion = useReducedMotion();

  /*
   * Near-white carrying a trace of the game's own hue — the same move
   * `<SwipeEdge>` makes with `HUE_LIFT`, and for the same reason: the light in
   * this room comes from this game. A pure white highlight would be the one thing
   * on the page lit by a lamp that is not the cover.
   *
   * `INK_ON_DARK` rather than a literal, so no hex appears in a component.
   */
  const core = mix(accent.color, INK_ON_DARK, 0.6);
  const colors = [withAlpha(core, 0), withAlpha(core, PEAK), withAlpha(core, 0)] as const;

  const animated = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: 0 };

    const offset = dealX.get();

    /* Raked off vertical rather than a true diagonal, so it reads as a reflection
       rather than as a corner gradient. The band travels further than the card
       does, which is what makes it look like light staying still while the object
       moves through it. */
    const travel = interpolate(
      offset,
      [-commitAt * 1.5, 0, commitAt * 1.5],
      [width * 0.9, -width * 0.35, -width * 1.6]
    );

    /* Up fast off the first few points of travel, then held. The highlight should
       already be there by the time the eye notices the card has moved. */
    const drag = interpolate(
      Math.abs(offset),
      [0, commitAt * 0.15, commitAt],
      [0, 1, 0.85],
      'clamp'
    );

    /* One catch of light as the card lands, and only one: the spring passes 0.5
       once on the way up. Free under Reduce Motion too — `useArrival` seeds at 1
       there, so this term is 0 from the first frame. */
    const landing = interpolate(arrival.get(), [0, 0.5, 1], [0, 1, 0], 'clamp');

    return {
      opacity: Math.max(drag, landing * ARRIVAL_CATCH),
      transform: [{ translateX: travel }],
    };
  });

  return (
    /* Clipped to the artwork's own corner — a band running past a rounded edge is
       the tell that a highlight was painted on rather than reflected off. No
       elevation here, so DESIGN.md § 6.3's shadow-versus-clip conflict does not
       arise and one view is enough. */
    <View
      style={[styles.clip, { width, height, borderRadius: radius }]}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.band, { width: width * WIDTH_RATIO, height }, animated]}>
        <LinearGradient
          /* Both ends are `withAlpha(colour, 0)`, never the keyword —
             `expo-linear-gradient` premultiplies on Android and fades the keyword
             through black, which would drag a grey bruise across the cover. */
          colors={[...colors]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={styles.fill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  /* The four offsets written out — `StyleSheet.absoluteFillObject` is gone from
     the RN types on SDK 57. */
  clip: { position: 'absolute', top: 0, left: 0, overflow: 'hidden' },
  /* Over-tall, so the rake never brings a horizontal end of the band inside the
     clip as it travels. */
  band: { position: 'absolute', top: 0, left: 0 },
  fill: { width: '100%', height: '100%' },
});
