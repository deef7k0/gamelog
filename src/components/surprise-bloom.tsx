import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';

import { SoftGlow } from '@/components/ui/soft-glow';
import { useAccent } from '@/hooks/use-accent';
import { mix } from '@/lib/color';

/**
 * The room, lit by the game on the card.
 *
 * ## Why one glow here is not the thing CLAUDE.md bans
 *
 * The house rule is *"one glow per screen is atmosphere, eight is a lava lamp"* —
 * no ambience on rails, grids or feeds. The licence here is the same one this
 * screen already claims for `<AccentProvider>`: **it shows exactly one game**,
 * filling the display, which is the condition the accent was built for.
 *
 * And at rest there is exactly one. The two `<SwipeEdge>` canvases sit at opacity
 * 0 until a finger moves, and they are the *gesture's* light rather than the
 * room's — they come from the bezel you are pushing toward, not from the object
 * in the middle.
 *
 * ## How this obeys `<SoftGlow>`'s hardest rule
 *
 * That component's docblock is blunt: **do not animate `size` or `blurRadius`**.
 * Either one rebuilds the gradient, every frame.
 *
 * Here the rule is not so much obeyed as unreachable. Every prop `<SoftGlow>`
 * receives is a constant for a given viewport, and it is `memo`'d, so after mount
 * it never re-renders and the gradient is drawn **once**. Everything that moves
 * is `opacity` and `scale` on the `Animated.View` wrapping it — compositor work,
 * no redraw. Do not "improve" this by animating one of the glow's props.
 *
 * ## Why the colour is allowed to cut
 *
 * `<SoftGlow>` takes hex strings, not shared values, and forking the app's single
 * glow primitive to accept animated colours would complicate every caller to
 * serve one screen. So the hue cuts — and `DIM` hides it: the room falls to half
 * strength as the card flies out, the cut lands in that trough underneath an
 * arriving opaque card, and it relights on the new hue. Free, and honest.
 */

/**
 * How far the glow overhangs the card, in dp.
 *
 * The well that holds this is sized `card + BLEED * 2` with `-BLEED` of vertical
 * margin, so the light has room to fall off to nothing while the block's *layout*
 * footprint stays exactly the card's. Nothing below it moves.
 *
 * It also pre-empts an Android clipping problem: the glow lives inside the well's
 * bounds rather than hanging outside them, so no ancestor has to be told not to
 * clip its children.
 */
export const BLOOM_BLEED = 140;

/** The source circle's diameter, against the cover's edge. */
const SIZE_RATIO = 1.55;

/** How far the glow's soft edge reaches past its body, in dp. `<SoftGlow>`'s own default. */
const BLUR = 24;

/** Peak paint alpha. Under the cover, never over it — this is the room, not a veil. */
const PEAK = 0.5;

/** Where the room falls to as the card leaves. Also the cover for the hue cut. */
const DIM = 0.5;

/** How much the light swells past the commit point, as a scale factor. */
const SWELL = 0.06;

export type SurpriseBloomProps = {
  /**
   * The card's **longest** edge, which is always its height.
   *
   * The glow is a circle, so it has to surround the larger dimension. A square
   * cover is `squareWidth` both ways; the portrait fallback is narrower but
   * exactly as tall, by construction in `revealLayout`. So this is one number for
   * both shapes, and the light does not shrink when a game has no square art.
   */
  cardEdge: number;
  /** Live card offset — the room dims as the card leaves. */
  dealX: SharedValue<number>;
  /** Springs to 1 past the commit threshold. */
  bloom: SharedValue<number>;
  /** The card's landing spring, so the light arrives with the object. */
  arrival: SharedValue<number>;
  /** How far a dealt card travels before it is let go. */
  exitDistance: number;
};

export function SurpriseBloom({
  cardEdge,
  dealX,
  bloom,
  arrival,
  exitDistance,
}: SurpriseBloomProps) {
  const accent = useAccent();
  const reduceMotion = useReducedMotion();

  /*
   * The canvas is its own `size × size` box, centred by the layer around it —
   * **not** an absolute fill.
   *
   * The well it lives in is full screen width, so a glow positioned at half the
   * *card's* box would sit well left of the cover. Centring a fixed-size host
   * instead means the offsets are always `size / 2`, they never depend on the
   * viewport, and the gradient is drawn over a 500dp square rather than a
   * full-screen one.
   */
  const size = Math.round(cardEdge * SIZE_RATIO);
  const centre = Math.round(size / 2);

  const animated = useAnimatedStyle(() => {
    /* The room dims as the card leaves and relights as the next one lands. Under
       Reduce Motion the swell goes; the dim stays, because it is a response to
       the drag rather than an animation of its own. */
    const dim = interpolate(Math.abs(dealX.get()), [0, exitDistance], [1, DIM], 'clamp');
    const swell = reduceMotion ? 0 : bloom.get();

    return {
      opacity: arrival.get() * dim * (1 + swell * 0.3),
      transform: [{ scale: 1 + swell * SWELL }],
    };
  });

  return (
    <Animated.View style={[styles.layer, animated]} pointerEvents="none">
      <View style={{ width: size, height: size }}>
        <SoftGlow
          color={accent.color}
          /* The mid stop half-way to the room it is lighting, so the ramp lands
             on the page rather than on a second hue — the construction
             `<SwipeEdge>` uses. */
          secondaryColor={mix(accent.color, accent.page, 0.55)}
          opacity={PEAK}
          size={size}
          blurRadius={BLUR}
          offsetX={centre}
          offsetY={centre}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /* The four offsets written out — `StyleSheet.absoluteFillObject` is gone from
     the RN types on SDK 57. Centres the fixed-size canvas host on the cover. */
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
