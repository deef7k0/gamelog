import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { PosterAspectRatio, Radius, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * One card in the deck.
 *
 * 76dp is the width at which box art is still recognisable as box art while
 * three of them plus their fan still leave two thirds of a phone's width for the
 * type beside them. `PosterAspectRatio` supplies the height, as everywhere else.
 */
const CARD = 76;
const CARD_HEIGHT = Math.round(CARD / PosterAspectRatio);

/**
 * How the hand sits, and where it goes when you press it.
 *
 * Two states per card rather than a formula: a fan is a composition, and three
 * cards is few enough that placing each one by hand beats deriving them from a
 * spread angle. Index 0 is the card facing you.
 *
 * The press state opens the fan by roughly half its resting angle and lifts the
 * face-down card off the other two — a hand being cut, not a button depressing.
 */
const FAN = [
  { restX: 0, pressX: 0, restDeg: -4, pressDeg: -8, restY: 0, pressY: -7 },
  { restX: 21, pressX: 27, restDeg: 6, pressDeg: 10, restY: 2, pressY: 3 },
  { restX: 42, pressX: 53, restDeg: 12, pressDeg: 18, restY: 5, pressY: 7 },
] as const;

/**
 * What the rotation adds beyond the card's own box, in dp.
 *
 * A rotated rectangle needs more room than an upright one, and the block has to
 * reserve it or the deepest card of an opened fan runs under the type beside it.
 * For a 76×114 card at the widest angle here (18°) the corners reach roughly
 * 16dp past each side and 16dp past each end once the card's own press offset is
 * counted — `(h·sinθ + w·cosθ)/2 - w/2`, and the same with the terms swapped,
 * plus `pressY`. Rounded up rather than computed at runtime: these are three
 * fixed angles, not a variable fan.
 *
 * The vertical figure is the one that bites. At 10 it was 6dp short, which does
 * not clip — nothing here has `overflow: hidden` — but it makes the block's
 * measured height a lie, so the row centres the fan against a box smaller than
 * the fan and the whole deck sits low against the type beside it.
 */
const OVERHANG_X = 16;
const OVERHANG_Y = 16;

/**
 * Where the cards hang inside the block.
 *
 * Absolutely positioned children ignore `justifyContent`, so the offset has to
 * be explicit — laying them out with a centred parent leaves every card at the
 * top and the lift on press then rides up out of the block.
 */
const CARD_TOP = OVERHANG_Y;

/** The block the fan occupies, overhang included at its widest and highest. */
export const DECK_WIDTH = FAN[FAN.length - 1].pressX + CARD + OVERHANG_X;
export const DECK_HEIGHT = CARD_TOP + CARD_HEIGHT + OVERHANG_Y;

/**
 * Three covers in a fan, the first in front — Surprise Me's way in, where the
 * front card is face down, and the Top 1000's, where the three are the top
 * three with their ranks on them (2026-10-21). One composition, so the two
 * buttons read as siblings. Moves only while `press` does.
 */
export function CoverFan({
  cards,
  press,
}: {
  /** Front first. Three; fewer leave the places behind empty. */
  cards: readonly FanCard[];
  press: SharedValue<number>;
}) {
  return (
    <View
      style={styles.deck}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden>
      {/* Painted back to front so the front card lands on top without a
          zIndex, which Android honours inconsistently inside a transformed
          subtree. */}
      {[2, 1, 0].map((index) =>
        cards[index] ? (
          <DeckCard key={index} index={index} press={press} card={cards[index]} />
        ) : null
      )}
    </View>
  );
}

/** One card of a fan: face down, or a cover — with a small mark on it, a rank. */
export type FanCard = { kind: 'back' } | { kind: 'cover'; uri: string | null; badge?: string };

type DeckCardProps = {
  index: number;
  /** The shared 0→1 press driver. Read on the UI thread, never in render. */
  press: SharedValue<number>;
  card: FanCard;
};

/**
 * One card of the fan — a real cover, or a face-down one.
 *
 * The hairline and the cast shadow are both load-bearing: without the outline
 * two dark covers merge into a single shape, and without the shadow the fan
 * reads as a flat collage rather than as three objects in front of one another.
 */
function DeckCard({ index, press, card }: DeckCardProps) {
  const theme = useTheme();
  const spec = FAN[index];

  const animated = useAnimatedStyle(() => {
    const progress = press.get();
    return {
      transform: [
        { translateX: interpolate(progress, [0, 1], [spec.restX, spec.pressX]) },
        { translateY: interpolate(progress, [0, 1], [spec.restY, spec.pressY]) },
        { rotate: `${interpolate(progress, [0, 1], [spec.restDeg, spec.pressDeg])}deg` },
        // Only the face-down card grows. The two behind it are being uncovered,
        // not lifted, and scaling all three would read as the whole block
        // zooming rather than as a hand opening.
        { scale: index === 0 ? interpolate(progress, [0, 1], [1, 1.03]) : 1 },
      ],
    };
  });

  const back = card.kind === 'back';
  const source = card.kind === 'cover' ? card.uri : null;

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: theme.surfaceElevated,
          /* The face-down card is the app's own material and keeps the app's
             edge; a real cover wears none, as no cover in the app does. */
          borderColor: back ? theme.borderStrong : 'transparent',
          shadowColor: theme.shadowInk,
        },
        animated,
      ]}>
      {back ? (
        /* The back of the card. The app's own material — one surface step, one
           hairline, no artwork — because the point is that there is nothing to
           read yet. The glyph names the mechanism rather than decorating it, and
           it is the same `shuffle` the "Another song" control uses on the result
           screen, so the two moves in this feature share one mark. */
        <View style={styles.back}>
          <Ionicons name="shuffle" size={24} color={theme.primaryText} />
        </View>
      ) : source ? (
        <Image
          source={{ uri: source }}
          style={styles.art}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={200}
          accessibilityIgnoresInvertColors
        />
      ) : null}
      {card.kind === 'cover' && card.badge && (
        <View style={[styles.badge, { backgroundColor: withAlpha(theme.shadowInk, 0.82) }]}>
          <Text variant="h6" style={{ color: theme.white }}>
            {card.badge}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /* Absolutely positioned children, so the block is as wide as the fan rather
     than as wide as three cards laid side by side. */
  deck: { width: DECK_WIDTH, height: DECK_HEIGHT },
  card: {
    position: 'absolute',
    top: CARD_TOP,
    left: 0,
    width: CARD,
    height: CARD_HEIGHT,
    borderRadius: Radius.image,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    /* Tight, short and cast down-right, along the fan. A soft wide shadow at
       this scale is a grey smudge between covers rather than depth. */
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 3, height: 2 },
    elevation: 5,
  },
  art: { width: '100%', height: '100%' },
  back: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  /* A rank on a cover: near-black with white type, as the word on a cover is. */
  badge: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    minWidth: 18,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: Radius.sm,
    alignItems: 'center',
  },
});
