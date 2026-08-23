import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { memo, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import {
  MaxContentWidth,
  Motion,
  Spacing,
  TapTarget,
  TopBarHeight,
  withAlpha,
} from '@/constants/theme';
import { useTopBarInset } from '@/hooks/use-header-height';
import { useScreenChrome } from '@/hooks/use-screen-chrome';
import { useTheme } from '@/hooks/use-theme';

/**
 * How far the page has to scroll before the bar is allowed to hide.
 *
 * Roughly one bar's worth. Under it the bar is pinned open, so the top of every
 * page opens with its title showing no matter how the last screen was left.
 */
const REVEAL_ZONE = TopBarHeight;

/**
 * Dead zone, in dp, around the last committed scroll position.
 *
 * A finger resting on a list still emits scroll events of a pixel or two in
 * alternating directions; without this the bar flickers open and shut while
 * nothing is really moving.
 */
const SCROLL_THRESHOLD = 8;

/** Out fast enough to feel like it got out of the way, not so fast it vanishes. */
const HIDE = { duration: Motion.normal, easing: Easing.out(Easing.quad) };
/** Back quicker than it left: reaching for the bar should feel instant. */
const SHOW = { duration: Motion.fast, easing: Easing.out(Easing.quad) };

export type FrostedTopBarProps = {
  /** The page's name. Omit on screens that lead with artwork carrying its own title. */
  title?: string;
  /** One quiet line under the title — a greeting, a count, an author. */
  subtitle?: string;
  /**
   * Show the back chevron.
   *
   * A chevron, never a word and never a glyph typed as text: `chevron-back` is
   * the same shape both platforms use, and it points at the edge you came from.
   */
  back?: boolean;
  /** Overrides the default `router.back()`. For a modal that should dismiss. */
  onBack?: () => void;
  /** Swaps the chevron for a close cross. Modals dismiss, they do not go back. */
  dismiss?: boolean;
  /** Controls on the right — a bell, a menu, a share. Lay them out yourself. */
  right?: ReactNode;
  /**
   * The scroll offset the bar hides against, from `useTopBarScroll()`.
   *
   * Omit on a screen that does not scroll — with no offset to watch, the bar
   * simply stays put.
   */
  scrollY?: SharedValue<number>;
  /**
   * @default true
   *
   * Set `false` on a screen whose bar holds something you must always be able
   * to reach, even though the page scrolls.
   */
  hideOnScroll?: boolean;
  /**
   * Blur strength, 1–100.
   *
   * @default 90 — heavy enough that fine detail is gone and only colour blobs
   * survive, which is the whole look. Below ~60 the content underneath stays
   * legible through the bar and the title has to fight it.
   */
  intensity?: number;
};

/**
 * The app's top bar: a sheet of frosted glass over the page.
 *
 * Not a surface with a background colour. It is a translucent layer that blurs
 * whatever the page has put behind it — Home's spotlight gradient, a game's key
 * art, a collection's mosaic — so the colour of the screen reads *through* the
 * chrome instead of being cut off by it. That is why the page's own ambience
 * belongs in `<Screen backdrop>` and never in the bar: the bar has nothing of
 * its own to show, it only softens what is already there.
 *
 * ## Three layers, in this order
 *
 * 1. **The blur.** `expo-blur` at intensity 90, `tint="dark"`.
 * 2. **A dark scrim** at 30%, over the blur. The blur alone preserves the
 *    *brightness* of what it samples, so a title crossing a pale patch of
 *    artwork still loses. The scrim is what makes the bar legible over anything.
 * 3. **The content row**, padded down by the safe-area inset so it clears the
 *    status bar while the glass itself runs to the very top of the display.
 *
 * ## Android needs a target
 *
 * On iOS and the web a translucent layer samples what is behind it for free. On
 * Android nothing does, and `expo-blur` on SDK 57 is explicit about it: a
 * `<BlurView>` with `blurMethod: 'dimezisBlurView'` and no `blurTarget` falls
 * back to `'none'` — a flat translucent slab, no blur at all, with a console
 * warning. The target is the page content, wrapped by `<Screen>` in
 * `<BlurTargetView>` and passed here through `useScreenChrome()`. Outside a
 * `<Screen>` the bar still renders; it just loses the blur on Android.
 *
 * ## Hide on scroll
 *
 * Scroll down and the bar translates up by its full height and is gone; scroll
 * up and it comes straight back. Everything runs in a worklet off `scrollY`, so
 * a scrolling page re-renders nothing — see `hooks/use-screen-chrome`. The two
 * guards that make it feel right rather than twitchy are `SCROLL_THRESHOLD` (a
 * dead zone around the last committed position) and `REVEAL_ZONE` (the bar is
 * pinned open near the top of the page).
 *
 * @example
 * ```tsx
 * const { scrollY, onScroll } = useTopBarScroll();
 *
 * <Screen
 *   edges={['bottom']}
 *   insetHeader
 *   topBar={<FrostedTopBar title="Library" back scrollY={scrollY} />}>
 *   <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16}>…</Animated.ScrollView>
 * </Screen>
 * ```
 */
export const FrostedTopBar = memo(function FrostedTopBar({
  title,
  subtitle,
  back = false,
  onBack,
  dismiss = false,
  right,
  scrollY,
  hideOnScroll = true,
  intensity = 90,
}: FrostedTopBarProps) {
  const theme = useTheme();
  const router = useRouter();
  const inset = useTopBarInset();
  const chrome = useScreenChrome();

  const height = inset + TopBarHeight;

  const translateY = useSharedValue(0);
  /** What the bar is currently animating *towards*, so a repeat is a no-op. */
  const hidden = useSharedValue(false);
  /** The last offset that moved the bar. The dead zone is measured from here. */
  const anchor = useSharedValue(0);

  useAnimatedReaction(
    () => (hideOnScroll && scrollY ? scrollY.get() : 0),
    (y) => {
      'worklet';
      if (!hideOnScroll || !scrollY) return;

      /* Pinned open across the first screenful, and across the rubber band above
         it — a bounce at the top reads as "scrolling down" to the delta below,
         and hiding the bar because someone over-pulled would be absurd. */
      if (y <= REVEAL_ZONE) {
        anchor.set(y);
        if (hidden.get()) {
          hidden.set(false);
          translateY.set(withTiming(0, SHOW));
        }
        return;
      }

      const delta = y - anchor.get();
      if (Math.abs(delta) < SCROLL_THRESHOLD) return;
      anchor.set(y);

      const next = delta > 0;
      if (next === hidden.get()) return;

      hidden.set(next);
      translateY.set(withTiming(next ? -height : 0, next ? HIDE : SHOW));
    },
    [hideOnScroll, scrollY, height]
  );

  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.get() }] }));

  function goBack() {
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
  }

  const showLeading = back || dismiss;

  return (
    <Animated.View style={[styles.bar, { height }, slide]}>
      <BlurView
        intensity={intensity}
        tint="dark"
        style={StyleSheet.absoluteFill}
        {...(Platform.OS === 'android'
          ? {
              blurMethod: 'dimezisBlurView' as const,
              blurTarget: chrome?.blurTarget,
              /* 4 is the default and divides `intensity` down to a radius that
                 lands near iOS's. Anything higher gives back the fine detail the
                 heavy blur exists to destroy. */
              blurReductionFactor: 4,
            }
          : null)}
      />

      {/* Over the blur, not under it. A blur preserves brightness — without this
          a white title crossing a pale patch of key art is unreadable however
          much detail has been smeared away. */}
      <View
        style={[styles.scrim, { backgroundColor: withAlpha(theme.shadowInk, 0.3) }]}
        pointerEvents="none"
      />

      <View style={[styles.row, { paddingTop: inset }]}>
        {showLeading && (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={dismiss ? 'Close' : 'Go back'}
            onPress={goBack}
            scaleTo={0.9}
            hitSlop={Spacing.x8}
            style={styles.leading}>
            <Ionicons name={dismiss ? 'close' : 'chevron-back'} size={26} color={theme.text} />
          </PressableScale>
        )}

        <View style={styles.titles}>
          {!!title && (
            <Text variant={subtitle ? 'h2' : 'h3'} numberOfLines={1}>
              {title}
            </Text>
          )}
          {!!subtitle && (
            <Text variant="bodySmall" color="textSecondary" numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>

        {!!right && <View style={styles.trailing}>{right}</View>}
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  /*
   * Absolute and immersive: the glass starts at y=0, behind the status bar, and
   * the content row is pushed clear of it by the safe-area inset instead. A bar
   * that began below the notch would draw a hard line across the top of every
   * screen — the same seam `<Screen backdrop>` exists to avoid.
   *
   * No `backgroundColor`. The blur and the scrim are the entire surface; adding
   * one would make it opaque and there would be nothing left to blur.
   */
  bar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    paddingHorizontal: Spacing.x12,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  /* Square and `TapTarget` wide, with the chevron optically nudged left so the
     glyph — not its bounding box — lines up with the content below. */
  leading: {
    width: TapTarget,
    height: TapTarget,
    marginLeft: -Spacing.x8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Shrinks rather than pushing the row wide: a long game title truncates
     instead of shoving the trailing controls off the right edge. */
  titles: { flex: 1, justifyContent: 'center' },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
});
