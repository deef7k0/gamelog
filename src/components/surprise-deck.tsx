import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';

import { Elevation } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';

/**
 * The deck the dealt card comes off.
 *
 * ## Why the cards behind are face down
 *
 * `games[cursor + 1]` is sitting in memory — the batch is fifty deep — so drawing
 * the next game's real cover here would cost nothing and be **wrong**. It spoils
 * the surprise, which is the entire feature: you would stop swiping to find out
 * what is next and start swiping to confirm what you already saw.
 *
 * The app settled this once already. `<SurpriseEntry>` on Home draws the top of
 * its fan face down — one surface step, one hairline, no artwork — under the note
 * *"the point is that there is nothing to read yet."* This is the same card, on
 * the screen that deals it.
 *
 * **And there is no glyph on it, unlike the entry deck.** That card is 76dp and
 * mostly empty, so a `shuffle` mark is the whole composition. These are 300dp and
 * mostly *occluded* — you see a 10dp rim at rest. The one frame where a mark
 * would be legible is mid-drag, when the front card has travelled away and the
 * card behind is briefly the thing you are looking at. A large glyph fading up in
 * exactly that frame is decoration arriving mid-gesture. What should be there is
 * the back of the next card, which is blank, which is the point.
 *
 * It is also the cheap version: no images, no `useSquareCover` lookups, nothing
 * to decode, nothing to pop a beat late.
 *
 * ## Why it exists at all
 *
 * Everything about how this feature is *written* says deck — `deal()`, `dealX`,
 * "the card is dealt", an entry point that draws a hand being cut. The reveal
 * showed one card on a flat field, so the gesture had nothing to come off and
 * nothing to reveal underneath. The stack is what makes a swipe a *deal* rather
 * than a slide.
 *
 * ## The material, and the shadow ceiling
 *
 * Surfaces come from `useAccent()`, not from the grey ladder: this page is filled
 * with `accent.page` (M3 neutral tone 10, seeded from the cover), and a fixed
 * `surfaceElevated` card on it would be the one object in the room lit by a
 * different lamp.
 *
 * The three depths cast in **descending** order — front `raised` (0.30), depth 1
 * `control` (0.24), depth 2 `card` (0.20) — which is both the DESIGN.md § 6.2
 * ceiling honoured with room to spare, and physically right: a card lower in a
 * stack is closer to the table and casts less. The game case stays the ceiling at
 * 0.45, untouched and unapproached.
 */

/**
 * Where the two cards behind sit, and where each one goes as the top is pulled.
 *
 * Placed by hand rather than derived from a spread, for the reason the entry fan
 * gives: two cards is few enough that composing them beats deriving them.
 *
 * **They recede upward.** Below the card is the facts pill, the title and two
 * support cards, all inside 13dp; above it is a flex spacer holding nothing. A
 * stack peeking out of the bottom would sit on the one block on this screen that
 * has to stay legible.
 *
 * `lead` is the slot in front. Depth 1's lead is deliberately the front card's
 * **arrival-start pose** — `caseStyle` springs `scale` from 0.94 — so at the
 * commit frame you have watched depth 1 rise to 0.94, the deal fires, and the new
 * card mounts at that same 0.94 and springs to 1. The object you watched rise is
 * the object that lands, and depth 1's snap back to rest happens underneath an
 * opaque card.
 *
 * The opposing sub-2° rotations are the difference between a hand-stacked deck
 * and a perspective ladder. Equal angles read as a diagram.
 */
const DECK = [
  { restY: -7, restScale: 0.94, restDeg: -1.4, leadY: 0, leadScale: 0.94, leadDeg: 0 },
  { restY: -13, restScale: 0.885, restDeg: 1.8, leadY: -7, leadScale: 0.94, leadDeg: -1.4 },
] as const;

export type SurpriseDeckProps = {
  /** The dealt card's exact footprint. The stack takes the same shape. */
  width: number;
  height: number;
  /**
   * The dealt card's corner, so the stack shares it.
   *
   * Passed in rather than fixed here because the front card has two shapes: a
   * square cover at `SQUARE_RADIUS`, or the portrait fallback at `Radius.image`
   * when SteamGridDB has no 1:1 art for the game. A deck with a different corner
   * from the card on top of it reads as two unrelated objects.
   */
  radius: number;
  /**
   * Live card offset, in dp. Drives the stack forward as the top card leaves.
   *
   * The same shared value the card, the edge lights and the bloom read — the
   * screen owns it, so nothing here has to be kept in step with anything.
   */
  dealX: SharedValue<number>;
  /** Travel at which releasing deals. The stack is fully advanced by then. */
  commitAt: number;
};

export function SurpriseDeck({ width, height, radius, dealX, commitAt }: SurpriseDeckProps) {
  const accent = useAccent();

  /*
   * Painted back to front, and without a `zIndex`.
   *
   * Document order is the only ordering Android honours reliably inside a
   * transformed subtree — `<SurpriseEntry>` records the same thing. It agrees
   * with the elevation ladder here (deepest card, lowest elevation, drawn first),
   * so the two cannot disagree.
   */
  return (
    <View style={styles.layer} pointerEvents="none" importantForAccessibility="no-hide-descendants">
      <DeckCard
        slot={DECK[1]}
        fill={accent.elevated}
        elevation={Elevation.card}
        {...{ width, height, radius, dealX, commitAt, accent }}
      />
      <DeckCard
        slot={DECK[0]}
        fill={accent.m3.surfaceContainerHighest}
        elevation={Elevation.control}
        {...{ width, height, radius, dealX, commitAt, accent }}
      />
    </View>
  );
}

/**
 * One face-down card.
 *
 * Split out so each gets its own `useAnimatedStyle` — one worklet driving two
 * views would have to recompute both poses every frame to return either.
 */
function DeckCard({
  slot,
  fill,
  elevation,
  width,
  height,
  radius,
  dealX,
  commitAt,
  accent,
}: {
  slot: (typeof DECK)[number];
  fill: string;
  elevation: (typeof Elevation)[keyof typeof Elevation];
  width: number;
  height: number;
  radius: number;
  dealX: SharedValue<number>;
  commitAt: number;
  accent: ReturnType<typeof useAccent>;
}) {
  const reduceMotion = useReducedMotion();

  const animated = useAnimatedStyle(() => {
    /*
     * Static under Reduce Motion — but still *drawn*.
     *
     * The stack is depth, not movement: two receding rims say "there is more
     * behind this" whether or not they animate, and deleting them would take
     * information from the reader who asked for less motion rather than less
     * meaning. What goes is the travel — a pseudo-depth effect whose job,
     * marking the commit threshold, the haptic and the edge light already do.
     *
     * This is a different call from the drag itself, which the reveal keeps under
     * Reduce Motion because a swipe is an input rather than an animation.
     */
    if (reduceMotion) {
      return {
        transform: [
          { translateY: slot.restY },
          { scale: slot.restScale },
          { rotate: `${slot.restDeg}deg` },
        ],
      };
    }

    /*
     * Advance on the *absolute* travel, so the deck rises whichever way the card
     * is being pulled — going back is still a deal, off the same stack from the
     * other side.
     *
     * `commitAt`, not `exitDistance`: the stack is fully forward at exactly the
     * travel where the haptic ticks and the edge light's word finishes resolving.
     * Three signals on one threshold is what makes the commit point feel like a
     * detent rather than three unrelated events.
     */
    const advance = interpolate(Math.abs(dealX.get()), [0, commitAt], [0, 1], 'clamp');

    return {
      transform: [
        { translateY: interpolate(advance, [0, 1], [slot.restY, slot.leadY]) },
        { scale: interpolate(advance, [0, 1], [slot.restScale, slot.leadScale]) },
        { rotate: `${interpolate(advance, [0, 1], [slot.restDeg, slot.leadDeg])}deg` },
      ],
    };
  });

  /*
   * One view, not two.
   *
   * DESIGN.md § 6.3 says to split fill-and-elevation from the clip, because
   * Android cuts `elevation` away under `overflow: 'hidden'`. There is nothing to
   * clip here — a face-down card is an empty filled rectangle — so the split is
   * not needed and a second view per depth would be two more nodes for nothing.
   *
   * **No animated opacity.** Depth is carried by the surface step, the scale and
   * the shadow, which is § 6's whole thesis; fading two full-size layers per
   * frame would be the most expensive way to say what three tones already say.
   */
  return (
    <Animated.View
      style={[
        styles.card,
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: fill,
          borderColor: accent.m3.outlineVariant,
          shadowColor: accent.m3.background,
        },
        elevation,
        animated,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  /*
   * Filled to the card slot rather than sized here: the slot already knows the
   * footprint, and a second source for it is a second thing to keep in step.
   *
   * The four offsets written out — `StyleSheet.absoluteFillObject` is gone from
   * the RN types on SDK 57 (see CLAUDE.md).
   */
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Both radii are supplied inline from `radius` — see the prop. The hairline is
     load-bearing: without it two near-identical dark rectangles on a dark page
     merge into one shape, which is the same note `<GamesWidget>` and the entry
     deck both record. */
  card: { position: 'absolute', borderWidth: StyleSheet.hairlineWidth },
});
