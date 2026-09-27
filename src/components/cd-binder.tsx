import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { CdBinderPage, SLEEVES_PER_PAGE, pageGeometry } from '@/components/cd-binder-page';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CopyWithRelations } from '@/lib/api';

/** The gutter between the two pages, where the rings would be. */
const SPINE = 10;

/** Discs on one spread: two pages of two. */
const PER_SPREAD = SLEEVES_PER_PAGE * 2;

/** The cover opens like a book: heavy, one soft settle. */
const OPEN = { damping: 20, stiffness: 120, mass: 1 } as const;

/** A page turn is quicker than the cover, and does not bounce. */
const TURN_MS = 480;

/** How far a swipe must travel before it turns the page. */
const SWIPE = 40;

type Turning = 'next' | 'prev' | null;

export type CdBinderProps = {
  /** Physical copies, in the order they fill the sleeves. */
  copies: CopyWithRelations[];
  /** The width the binder may use when open. */
  width: number;
  onOpenCopy: (copy: CopyWithRelations) => void;
};

/**
 * A person's physical games, kept the way discs are kept: in a zip binder.
 *
 * ## Closed, then open
 *
 * It arrives shut — a padded case with a stitched edge and a zip, the number of
 * discs debossed on its face. Tap it and the cover swings open about the spine
 * and becomes the left-hand page, the whole binder sliding over so the open
 * spread sits centred where the closed case was. **The cover's inside is the left
 * page**: it is drawn on the back of the cover and carried round by the same
 * rotation, which is why the spread never pops into place — it is turned into
 * place.
 *
 * ## Two sleeves a page, two pages a spread
 *
 * Swipe sideways or use the arrows to turn a page. The right page lifts about the
 * spine and lands on the left, its back carrying the next spread's left page —
 * the same two-faced trick as the cover, so the turn shows what is really on the
 * other side of the paper. Tap a disc to open that copy.
 *
 * Reduce Motion opens and turns instantly. The arrows and the per-disc labels mean
 * nothing here is only reachable by a swipe.
 */
export function CdBinder({ copies, width, onOpenCopy }: CdBinderProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();

  const pageWidth = Math.floor((width - SPINE) / 2);
  const { height } = pageGeometry(pageWidth);
  const spreadWidth = pageWidth * 2 + SPINE;

  const spreads = Math.max(1, Math.ceil(copies.length / PER_SPREAD));
  const [isOpen, setIsOpen] = useState(false);
  const [spread, setSpread] = useState(0);
  const [turning, setTurning] = useState<Turning>(null);

  const open = useSharedValue(0);
  const leaf = useSharedValue(0);

  const tick = useCallback(() => {
    if (Platform.OS === 'web') return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const setOpen = useCallback(
    (next: boolean) => {
      setIsOpen(next);
      tick();
      open.set(reduceMotion ? (next ? 1 : 0) : withSpring(next ? 1 : 0, OPEN));
      AccessibilityInfo.announceForAccessibility(next ? 'Binder open' : 'Binder closed');
    },
    [open, reduceMotion, tick]
  );

  const finishTurn = useCallback(
    (direction: Exclude<Turning, null>) => {
      setSpread((current) => current + (direction === 'next' ? 1 : -1));
      setTurning(null);
      leaf.set(0);
    },
    [leaf]
  );

  const turn = useCallback(
    (direction: Exclude<Turning, null>) => {
      if (turning) return;
      const target = spread + (direction === 'next' ? 1 : -1);
      if (target < 0 || target >= spreads) return;
      tick();
      AccessibilityInfo.announceForAccessibility(pagesLabel(target, spreads));
      if (reduceMotion) {
        setSpread(target);
        return;
      }
      setTurning(direction);
      leaf.set(0);
      leaf.set(
        withTiming(1, { duration: TURN_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
          if (finished) runOnJS(finishTurn)(direction);
        })
      );
    },
    [finishTurn, leaf, reduceMotion, spread, spreads, tick, turning]
  );

  const swipe = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-14, 14])
    .enabled(isOpen)
    .onEnd((event) => {
      if (event.translationX < -SWIPE || event.velocityX < -500) runOnJS(turn)('next');
      else if (event.translationX > SWIPE || event.velocityX > 500) runOnJS(turn)('prev');
    });

  /* Closed, the case sits centred: shifted left by half a page and the spine. */
  const body = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(open.get(), [0, 1], [-(pageWidth + SPINE) / 2, 0]) }],
  }));

  /* The cover turns about its left edge, the spine. */
  const cover = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1400 },
      { rotateY: `${interpolate(open.get(), [0, 1], [0, -180])}deg` },
    ],
  }));
  const coverOutside = useAnimatedStyle(() => ({ opacity: open.get() < 0.5 ? 1 : 0 }));
  /*
   * The left page exists twice, and only one is ever showing.
   *
   * While the cover is moving, its inside *is* the left page — carried round by
   * the turn. Once it has landed, the flat page underneath takes over, so the
   * page turns that follow (which change what is on the left) are never hidden
   * behind a cover still printing the old spread.
   */
  const coverInside = useAnimatedStyle(() => ({
    opacity: open.get() > 0.5 && open.get() < 0.99 ? 1 : 0,
  }));
  const flatLeft = useAnimatedStyle(() => ({ opacity: open.get() >= 0.99 ? 1 : 0 }));

  /* A turning page: from the right about the spine for "next", from the left
     about the spine for "prev". */
  const leafStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1400 },
      { rotateY: `${interpolate(leaf.get(), [0, 1], [0, turning === 'prev' ? 180 : -180])}deg` },
    ],
  }));
  const leafFront = useAnimatedStyle(() => ({ opacity: leaf.get() < 0.5 ? 1 : 0 }));
  const leafBack = useAnimatedStyle(() => ({ opacity: leaf.get() < 0.5 ? 0 : 1 }));
  /* The page underneath darkens as the leaf passes over it. */
  const shade = useAnimatedStyle(() => ({
    opacity: interpolate(leaf.get(), [0, 0.5, 1], [0, 0.28, 0]),
  }));

  const pageOf = (spreadIndex: number, side: 'left' | 'right') => {
    const start = spreadIndex * PER_SPREAD + (side === 'right' ? SLEEVES_PER_PAGE : 0);
    return Array.from({ length: SLEEVES_PER_PAGE }, (_, index) => copies[start + index]);
  };

  const page = (spreadIndex: number, side: 'left' | 'right') => (
    <CdBinderPage
      copies={pageOf(spreadIndex, side)}
      width={pageWidth}
      side={side}
      onOpenCopy={onOpenCopy}
    />
  );

  /* What lies flat under a turning leaf: the pages it uncovers. */
  const baseLeft = turning === 'prev' ? spread - 1 : spread;
  const baseRight = turning === 'next' ? spread + 1 : spread;
  const rightX = pageWidth + SPINE;

  return (
    <View style={styles.wrap}>
      <GestureDetector gesture={swipe}>
        <Animated.View style={[{ width: spreadWidth, height }, body]}>
          {/* The spine, the binder's own material between the pages. */}
          <View
            style={[
              styles.spine,
              { left: pageWidth, width: SPINE, height, backgroundColor: theme.surfaceSelected },
            ]}
          />

          {/* The left page, flat — shown once the cover has landed on it. */}
          <Animated.View
            style={[styles.at, { left: 0 }, flatLeft]}
            pointerEvents={isOpen ? 'auto' : 'none'}>
            {page(baseLeft, 'left')}
          </Animated.View>

          <View style={[styles.at, { left: rightX }]}>
            {page(baseRight, 'right')}
            <Animated.View
              style={[StyleSheet.absoluteFill, { backgroundColor: theme.shadowInk }, shade]}
              pointerEvents="none"
            />
          </View>

          {turning && (
            <Animated.View
              style={[
                styles.at,
                {
                  left: turning === 'next' ? rightX : 0,
                  width: pageWidth,
                  height,
                  transformOrigin: turning === 'next' ? 'left' : 'right',
                },
                leafStyle,
              ]}
              pointerEvents="none">
              <Animated.View style={[StyleSheet.absoluteFill, leafFront]}>
                {turning === 'next' ? page(spread, 'right') : page(spread, 'left')}
              </Animated.View>
              <Animated.View style={[StyleSheet.absoluteFill, styles.flipped, leafBack]}>
                {turning === 'next' ? page(spread + 1, 'left') : page(spread - 1, 'right')}
              </Animated.View>
            </Animated.View>
          )}

          {/* The cover, over the right page, turning about the spine. */}
          <Animated.View
            style={[
              styles.at,
              { left: rightX, width: pageWidth, height, transformOrigin: 'left' },
              cover,
            ]}
            pointerEvents={isOpen ? 'none' : 'auto'}>
            <Animated.View style={[StyleSheet.absoluteFill, coverInside, styles.flipped]}>
              {page(spread, 'left')}
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, coverOutside]}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`Disc binder, ${countLabel(copies.length)}`}
                accessibilityHint="Opens the binder"
                disabled={copies.length === 0}
                onPress={() => setOpen(true)}
                scaleTo={0.98}>
                <Cover width={pageWidth} height={height} count={copies.length} />
              </PressableScale>
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      {isOpen ? (
        <View style={[styles.controls, { width: spreadWidth }]}>
          <PageButton
            icon="chevron-back"
            label="Previous pages"
            disabled={spread === 0 || !!turning}
            onPress={() => turn('prev')}
          />
          <Text variant="caption" color="textSecondary" style={styles.pages}>
            {pagesLabel(spread, spreads)}
          </Text>
          <PageButton
            icon="chevron-forward"
            label="Next pages"
            disabled={spread >= spreads - 1 || !!turning}
            onPress={() => turn('next')}
          />
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Close the binder"
            onPress={() => setOpen(false)}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            scaleTo={0.94}
            style={StyleSheet.flatten(styles.close)}>
            <Ionicons name="close" size={15} color={theme.textSecondary} />
            <Text variant="caption" color="textSecondary">
              Close
            </Text>
          </PressableScale>
        </View>
      ) : (
        copies.length > 0 && (
          <Text variant="caption" color="textMuted">
            Tap to open
          </Text>
        )
      )}
    </View>
  );
}

/**
 * The binder shut: a padded case, a stitched edge, a zip down the opening side
 * and its pull, and the count debossed on the face. All drawn — a photograph of
 * someone else's binder would be a costume, and this one holds *these* discs.
 */
function Cover({ width, height, count }: { width: number; height: number; count: number }) {
  const theme = useTheme();
  const teeth = Math.floor((height - 24) / 5);

  return (
    <View style={[styles.cover, { width, height, shadowColor: theme.shadowInk }]}>
      <LinearGradient
        colors={[theme.surfaceSelected, theme.surfaceElevated, theme.surface]}
        locations={[0, 0.45, 1]}
        style={[StyleSheet.absoluteFill, styles.coverShape]}
      />
      {/* The spine edge, a shade darker, where the cover folds. */}
      <View style={[styles.coverSpine, { backgroundColor: withAlpha(theme.shadowInk, 0.25) }]} />

      {/* The stitched border of a padded case. */}
      <View
        style={[styles.stitch, { borderColor: withAlpha(theme.text, 0.13) }]}
        pointerEvents="none"
      />

      {/* The zip, down the opening edge, and its pull near the top. */}
      <View style={styles.zip} pointerEvents="none">
        {Array.from({ length: teeth }, (_, index) => (
          <View
            key={index}
            style={[styles.tooth, { backgroundColor: withAlpha(theme.text, 0.16) }]}
          />
        ))}
      </View>
      <View
        style={[
          styles.pull,
          { backgroundColor: theme.surfaceSelected, borderColor: withAlpha(theme.text, 0.22) },
        ]}>
        <View style={[styles.pullHole, { backgroundColor: withAlpha(theme.shadowInk, 0.6) }]} />
      </View>

      {/* Debossed: a dark line with a faint light one under it, pressed into
          the padding rather than printed on it. */}
      <View style={styles.face} pointerEvents="none">
        <Ionicons name="disc-outline" size={34} color={withAlpha(theme.text, 0.2)} />
        <Text
          variant="label"
          style={[
            styles.deboss,
            {
              color: withAlpha(theme.text, 0.34),
              textShadowColor: withAlpha(theme.shadowInk, 0.9),
            },
          ]}>
          {countLabel(count).toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

function PageButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      scaleTo={0.9}
      style={StyleSheet.flatten([
        styles.pageButton,
        { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
        disabled && styles.disabled,
      ])}>
      <Ionicons name={icon} size={17} color={theme.text} />
    </PressableScale>
  );
}

function countLabel(count: number): string {
  return `${count} ${count === 1 ? 'game' : 'games'}`;
}

function pagesLabel(spreadIndex: number, spreads: number): string {
  return `Pages ${spreadIndex * 2 + 1}–${spreadIndex * 2 + 2} of ${spreads * 2}`;
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 14 },
  at: { position: 'absolute', top: 0 },
  spine: { position: 'absolute', top: 0 },
  /* A face drawn pre-turned, so the rotation brings it round the right way up. */
  flipped: { transform: [{ rotateY: '180deg' }] },
  cover: {
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
    /* It depicts an object, so it casts — well under the case's cast. */
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 4, height: 10 },
    elevation: 9,
  },
  coverShape: {
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  coverSpine: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 9 },
  stitch: {
    position: 'absolute',
    top: 9,
    bottom: 9,
    left: 15,
    right: 17,
    borderRadius: 9,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  zip: {
    position: 'absolute',
    top: 12,
    bottom: 12,
    right: 5,
    width: 5,
    justifyContent: 'space-between',
  },
  tooth: { height: 2, width: 5, borderRadius: 1 },
  pull: {
    position: 'absolute',
    right: 1,
    top: 30,
    width: 12,
    height: 30,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    paddingTop: 5,
  },
  pullHole: { width: 4, height: 8, borderRadius: 2 },
  face: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deboss: { letterSpacing: 1.6, textShadowOffset: { width: 0, height: -1 }, textShadowRadius: 0 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pages: { flex: 1, textAlign: 'center' },
  pageButton: {
    width: 34,
    height: 34,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  close: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 4 },
});
