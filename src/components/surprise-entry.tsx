import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { memo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Motion, PosterAspectRatio, Radius, Spacing } from '@/constants/theme';
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
const DECK_WIDTH = FAN[FAN.length - 1].pressX + CARD + OVERHANG_X;
const DECK_HEIGHT = CARD_TOP + CARD_HEIGHT + OVERHANG_Y;

export type SurpriseEntryCover = {
  coverUrl: string | null;
  heroUrl: string | null;
};

export type SurpriseEntryProps = {
  /**
   * Artwork for the two cards behind the face-down one.
   *
   * Passed in rather than fetched. Discover has already loaded these games for
   * the band below this one, so the deck is real box art at the cost of a prop —
   * a query here would spend a request to decorate a link. Fewer than two, or
   * none at all, is a valid state: the cards behind simply render blank, which
   * is what the first frame shows anyway.
   */
  covers?: readonly SurpriseEntryCover[];
};

/**
 * The way into Surprise Me, from Home.
 *
 * It sat on Discover for a while, third band down, between the genre grid and
 * the popularity chart. It reads better directly under the greeting: this is the
 * one control on the app that needs no input and no browsing, so the person who
 * has just opened the app and does not know what they want should meet it before
 * they meet a single ranked list.
 *
 * ## Why a deck
 *
 * This began as an icon, a heading, two lines and a chevron — the generic list
 * row, in the one place on Discover that is not a list. It also broke the rule
 * the rest of the app is built on: every other surface leads with box art, and
 * the single row promising you a *game* led with an outlined glyph.
 *
 * So it leads with games. Two real covers, fanned, behind a third card that is
 * face-down. The composition states the whole feature without a word of copy:
 * the catalogue is in there, one of them is already picked, and you cannot see
 * which. It is also the honest shape — a preview of three actual candidates
 * would be a promise this feature does not keep, because the roll draws from a
 * random offset into IGDB and not from the games Discover happens to be showing.
 *
 * ## Why the cards are tilted, when the profile shelf refuses to be
 *
 * `<GamesWidget>` overlaps five covers and keeps them dead level, and its
 * docblock is explicit that the diagonal was tried and rejected: it "read as a
 * hand of cards dropped on a table rather than as a shelf". That is the correct
 * judgement there and the reason to tilt here. A shelf is an inventory of things
 * you own; this is a deck about to be cut. Same covers, same hairline, same
 * cast shadow, opposite metaphor.
 *
 * ## Cost
 *
 * No queries, no timers, no ambient animation. The deck moves only while a
 * finger is on it, so a band that most readers scroll straight past costs one
 * layout and nothing else.
 */
export const SurpriseEntry = memo(function SurpriseEntry({ covers = [] }: SurpriseEntryProps) {
  const router = useRouter();

  /*
   * One driver for the whole hand: 0 at rest, 1 held down. Every card reads the
   * same value and interpolates its own two positions out of it, so the fan
   * cannot desynchronise and there is one animation to reason about rather than
   * three.
   */
  const press = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  function setPress(to: number) {
    if (reduceMotion) return;
    press.set(
      withTiming(to, {
        duration: to === 1 ? Motion.fast : Motion.normal,
        // Out on the way down, back on the way up: the cut should feel like it
        // leaves your hand and settles, not like it bounces off a spring.
        easing: to === 1 ? Easing.out(Easing.cubic) : Easing.out(Easing.quad),
      })
    );
  }

  return (
    <View style={styles.band}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Surprise me. One game, one song, no browsing."
        accessibilityHint="Opens a random game with a song from its soundtrack"
        scaleTo={0.985}
        onPressIn={() => {
          setPress(1);
          /* The tick belongs to the press, not the navigation — it is the deck
             being cut. Selection rather than impact: this is picking, and the
             app already reserves notification haptics for a saved log. iOS only,
             where the Taptic Engine makes the distinction legible; Android's
             generic buzz for the same event reads as an error tone. */
          if (Platform.OS === 'ios') {
            Haptics.selectionAsync().catch(() => {});
          }
        }}
        onPressOut={() => setPress(0)}
        onPress={() => router.push('/surprise')}
        style={styles.row}>
        {/* One control, not four images: without this a screen reader reads two
            unlabelled covers and a stray icon before reaching the label. */}
        <View
          style={styles.deck}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden>
          {/* Painted back to front so the face-down card lands on top without a
              zIndex, which Android honours inconsistently inside a transformed
              subtree. */}
          {[2, 1, 0].map((index) => (
            <DeckCard
              key={index}
              index={index}
              press={press}
              cover={index === 0 ? null : (covers[index - 1] ?? null)}
            />
          ))}
        </View>

        <View style={styles.body}>
          {/* `h2`, the same step every band heading on this screen uses. This
              one is not inside a `<HomeSection>` on purpose — a section heading
              announces a list, and a lone control under one reads as a list that
              failed to load. */}
          <Text variant="h2" accessibilityRole="header">
            Surprise me
          </Text>
          {/* Three beats, 32 characters. The two-sentence version said the same
              thing and ran to three lines in the 135dp column a 320dp display
              leaves once the deck has taken its half. */}
          <Text variant="bodySmall" color="textMuted">
            One game, one song, no browsing.
          </Text>

          {/*
            No call-to-action row.

            It read "Shuffle ›", and it was the only part of this card that
            repeated something the composition had already said — the heading
            names the feature and the deck shows what it does. It was also a
            fourth word for one action, on a screen where the same press is
            called "Surprise me" directly above it. The chevron went with it: the
            whole card is one button, and its accessible hint says where it goes.
          */}
        </View>
      </PressableScale>
    </View>
  );
});

type DeckCardProps = {
  index: number;
  /** The shared 0→1 press driver. Read on the UI thread, never in render. */
  press: SharedValue<number>;
  cover: SurpriseEntryCover | null;
};

/**
 * One card of the fan — a real cover, or the face-down one at index 0.
 *
 * The hairline and the cast shadow are both load-bearing, for the reasons
 * `<GamesWidget>` gives: without the outline two dark covers merge into a single
 * shape, and without the shadow the fan reads as a flat collage rather than as
 * three objects in front of one another.
 */
function DeckCard({ index, press, cover }: DeckCardProps) {
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

  const source = cover?.coverUrl ?? cover?.heroUrl ?? null;

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: theme.surfaceElevated,
          borderColor: index === 0 ? theme.borderStrong : theme.border,
          shadowColor: theme.shadowInk,
        },
        animated,
      ]}>
      {index === 0 ? (
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /* The page gutter and nothing else. On Discover this carried a top rule and
     its own 24dp of air, which is how a band separates itself from the band
     above it; Home separates its sections with a 48dp gap and draws no rules at
     all, so both would be a second, contradicting rhythm. */
  band: { paddingHorizontal: Spacing.x16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x20 },
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
       this scale is a grey smudge between covers rather than depth — the same
       call `<GamesWidget>` makes, turned to follow the diagonal. */
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 3, height: 2 },
    elevation: 5,
  },
  art: { width: '100%', height: '100%' },
  back: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
});
