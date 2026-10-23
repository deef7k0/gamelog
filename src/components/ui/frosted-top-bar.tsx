import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { createContext, memo, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { MarqueeText } from '@/components/ui/marquee-text';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { MaxContentWidth, Spacing, withAlpha } from '@/constants/theme';
import {
  BAR_SLIDE,
  BAR_SPRING,
  FROST,
  TOP_BAR_DISC,
  TOP_BAR_DISC_ROOM,
  TOP_BAR_EDGE,
  TOP_BAR_GLYPH,
  TOP_BAR_KEY,
  TOP_BAR_KEY_FILL,
  TOP_BAR_ROW,
  TOP_BAR_SIDE,
  TOP_BAR_TITLE_GAP,
  TOP_BAR_TITLE_INSET,
  discShift,
  isScrolled,
  revealOffset,
} from '@/constants/top-bar';
import { useTopBarInset } from '@/hooks/use-header-height';
import { useScreenChrome } from '@/hooks/use-screen-chrome';
import { useTheme } from '@/hooks/use-theme';

const DISC = TOP_BAR_DISC;

/*
 * The glass, as far as it can be had without a shader.
 *
 * SimpMusic's button is Kyant's liquid glass (`LiquidGlassContainer.kt`,
 * `drawInteractiveGlass`): what is behind it blurred by 8dp and bent through a
 * lens, darkened by a scrim of black, and edged with a rim of light that falls
 * from one side. The lens is a `RuntimeShader`; this app has no Skia, and a
 * circle 48 across is too small for refraction to be what anyone sees. What
 * reads as that button is the other three, and those are drawn:
 *
 *  - **The rim**: one dp of gradient round the edge, bright where the light
 *    lands (top left), nearly gone across the middle, lifting again at the far
 *    side. A uniform hairline is the outline of a button; a rim that changes
 *    round its circle is the edge of a piece of glass.
 *  - **The scrim**: 27% black — the reference's `lerp(0.12, 0.5, …)` at the
 *    mid luminance its static surfaces are drawn with.
 *  - **The sheen**: a faint light across the top-left of the pane, where the
 *    reference's highlight sits.
 *
 * White at fixed alphas, written out: these are light on glass, not a colour
 * of the app's, and they are the same over every page. Every stop that fades
 * ends on white at zero — Android interpolates a gradient unpremultiplied, and
 * a fade to `transparent` goes grey on the way.
 */
const RIM =
  'linear-gradient(135deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.12) 34%, rgba(255,255,255,0.06) 62%, rgba(255,255,255,0.22) 100%)';
const SHEEN = 'linear-gradient(135deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0) 58%)';
/** How dark the pane is over whatever is behind it. */
const PANE_SCRIM = 0.27;

/** Compose's `FastOutSlowInEasing`, the default of the reference's `tween(300)`. */
const FROST_EASING = Easing.bezier(...FROST.easing);

/**
 * A page that opens on artwork and does not say how tall its header is: this
 * much of the display, which is the least any of them opens with (a game's
 * hero is 38%).
 */
const DEFAULT_HEADER = 0.38;

/**
 * How a control is drawn where it is: a disc of glass over artwork, or a bare
 * glyph in the bar. `<TopBarDisc>` reads it, so a screen writes its right-hand
 * controls once and they are right in both.
 */
const TopBarForm = createContext<'disc' | 'bar'>('disc');

/**
 * The top bar — SimpMusic's, at the owner's direction: its size, how it
 * looks, and what it does as the page scrolls. `constants/top-bar.ts` has the
 * numbers and says where in the reference's source each was read.
 *
 * ## What it is
 *
 * A row 64 high under the status bar: a back chevron, the page's name in the
 * title step, the page's controls at the far end. **It is never a fixed
 * opaque strip.** It floats over the page with nothing behind it, and turns to
 * frosted glass — the page blurred, washed with the page's own colour — when
 * there is something under it to frost. Which of two ways it does that is
 * decided by the page:
 *
 *  - **A page that opens on a list or a form** (`<Screen insetHeader>`). The
 *    bar is there from the start, clear while the page is at its very top and
 *    frost the moment it is not; the two cross-fade over 300ms. The page uses
 *    a page scroller (`ui/page-scroll`) so the bar can tell.
 *  - **A page that opens on artwork** (no `insetHeader`). At rest there is no
 *    bar: a disc of glass in each corner, 48 across and 12 in, and they are
 *    part of the artwork — they scroll away with it. Once the header has gone
 *    under where the bar would be, the bar comes in from above, already frost,
 *    carrying the page's name. Tell it how tall the header is (`header`).
 *
 * Home's is a third, `<FoldingTopBar>` below.
 *
 * ## What this replaced
 *
 * For a long while there was no bar: only the disc, on every screen, pinned.
 * The bar before *that* was a full-width sheet of frost fixed across the top —
 * 111dp of an 844pt display, blurring the top of every piece of key art in an
 * app whose subject is artwork — and the disc was the answer to it. This is
 * the reference's answer to the same problem, and it keeps what the disc won:
 * nothing is drawn over artwork except two small circles, and a list page
 * gives up no more than it did. What it gives back is the page's name, which
 * no pushed screen had carried since.
 *
 * So **a screen's heading is its bar's `title`**, and a page that opens on a
 * list no longer prints a heading of its own under it.
 *
 * ## Android still needs a target
 *
 * A `<BlurView>` with a dimezis `blurMethod` and no `blurTarget` silently
 * falls back to a flat translucent slab. The target is the page content,
 * wrapped by `<Screen>` in `<BlurTargetView>` and passed here through
 * `useScreenChrome()`. Outside a `<Screen>` this still renders; it just loses
 * the blur on Android, and never frosts.
 *
 * @example
 * ```tsx
 * <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back title="Settings" />}>
 *   <PageScrollView>…</PageScrollView>
 * </Screen>
 * ```
 */
export type FrostedTopBarProps = {
  /**
   * Show the back control.
   *
   * A chevron, never a word and never a glyph typed as text: `chevron-back` is
   * the same shape both platforms use, and it points at the edge you came from.
   */
  back?: boolean;
  /** Overrides the default `router.back()`. For a modal that should dismiss. */
  onBack?: () => void;
  /** Swaps the chevron for a close cross. Modals dismiss, they do not go back. */
  dismiss?: boolean;
  /**
   * The page's name, on one line.
   *
   * In the bar from the start on a list or a form. On a page that opens on
   * artwork it is in the bar that comes in once the artwork has gone — the
   * page said its own name in its header until then.
   */
  title?: string;
  /**
   * Controls at the far end — a menu, an add, a torch — as `<TopBarDisc>`s.
   * Each is a disc of glass over artwork and a bare glyph in the bar.
   */
  right?: ReactNode;
  /**
   * How tall the page's header is, from the top of the page, when it opens on
   * artwork: the bar comes in as the header's foot reaches the bar's.
   *
   * @default 38% of the display
   */
  header?: number;
  /**
   * Centre the title on the screen instead of starting it after the chevron.
   * Somebody else's profile, whose bar mirrors your own tab's.
   */
  centerTitle?: boolean;
  /**
   * Which kind this is, for the rare page whose inset does not say: `'art'`
   * for discs over artwork, `'bar'` for a bar from the start.
   *
   * @default by the page — `'bar'` under `<Screen insetHeader>`, else `'art'`
   */
  variant?: 'bar' | 'art';
  /**
   * A disc's blur strength, 1–100.
   *
   * @default 60 — the reference blurs what is behind its button by 8dp, light
   * enough that shapes still show through it; that is what makes it glass
   * rather than a grey button.
   */
  intensity?: number;
};

export const FrostedTopBar = memo(function FrostedTopBar({
  back = false,
  onBack,
  dismiss = false,
  title,
  right,
  header,
  centerTitle = false,
  variant,
  intensity = 60,
}: FrostedTopBarProps) {
  const router = useRouter();
  const chrome = useScreenChrome();

  function goBack() {
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
  }

  const showLeading = back || dismiss;
  if (!showLeading && !right && !title) return null;

  const leading = showLeading
    ? {
        icon: dismiss ? ('close' as const) : ('chevron-back' as const),
        label: dismiss ? 'Close' : 'Go back',
        onPress: goBack,
        /* Optically nudged: `chevron-back` is drawn with its mass to the right
           of its own box, so a centred glyph sits visibly right of the middle. */
        nudge: dismiss ? 0 : -1,
      }
    : null;

  const kind = variant ?? (chrome && !chrome.insetHeader ? 'art' : 'bar');

  return kind === 'art' ? (
    <ArtBar leading={leading} title={title} right={right} header={header} intensity={intensity} />
  ) : (
    <PlainBar leading={leading} title={title} right={right} centerTitle={centerTitle} />
  );
});

type Leading = { icon: IconName; label: string; onPress: () => void; nudge: number } | null;
type IconName = keyof typeof Ionicons.glyphMap;

/**
 * A value that changes on every render, for animated styles to depend on.
 *
 * Reanimated keeps a settled animated value in a registry the native side
 * empties after two seconds, and a render after that puts the view back at
 * its first frame (CLAUDE.md § Gotchas). The usual answer is to restate the
 * resting pose as a plain style, which needs a pose React can name; "frosted
 * or not" and "discs carried off by 340dp" are the page's scroll offset, which
 * React never hears. So every style here reads this, and a render re-applies
 * them all the frame after — the copy showcase's remedy.
 *
 * **Re-applies only what differs from the last value.** Reanimated compares a
 * style with the one before it key by key and sends nothing when every key is
 * identical — and an opacity that settled at 1 is identical. A transform is an
 * array, never the same object twice, so every style here carries one, if only
 * a transform by nothing; and the one value that is a prop and not a style,
 * the blur's strength, is moved by a hundredth on alternate renders instead
 * (`<Frost>`).
 */
export function usePulse(): SharedValue<number> {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.set(pulse.get() + 1);
  });
  return pulse;
}

/** The page's scroll offset, or a still zero outside a `<Screen>`. */
function usePageOffset(): SharedValue<number> {
  const still = useSharedValue(0);
  return useScreenChrome()?.scrollY ?? still;
}

/**
 * The bar of a page that opens on a list or a form: there from the start,
 * clear at the top of the page, frost under way (`NotificationScreen.kt`).
 */
function PlainBar({
  leading,
  title,
  right,
  centerTitle,
}: {
  leading: Leading;
  title?: string;
  right?: ReactNode;
  centerTitle: boolean;
}) {
  const theme = useTheme();
  const chrome = useScreenChrome();
  const inset = useTopBarInset();
  const scrollY = usePageOffset();
  const pulse = usePulse();
  const frost = useSharedValue(0);

  /* A fade, so it runs unchanged under Reduce Motion: nothing here moves. */
  useAnimatedReaction(
    () => isScrolled(scrollY.get()),
    (scrolled, was) => {
      if (scrolled === was) return;
      frost.set(withTiming(scrolled ? 1 : 0, { duration: FROST.ms, easing: FROST_EASING }));
    }
  );

  return (
    /* Not `box-none`: once the page is under the bar, a tap on the bar must
       not reach a row the frost is hiding. At the top of the page there is
       nothing under it to reach — the page kept this room clear. */
    <View style={[styles.layer, { height: inset + TOP_BAR_ROW }]}>
      <Frost progress={frost} pulse={pulse} tint={chrome?.background ?? theme.background} />
      <BarRow inset={inset} leading={leading} right={right}>
        <BarTitle title={title} leading={!!leading} centre={centerTitle} />
      </BarRow>
    </View>
  );
}

/**
 * The bar of a page that opens on artwork (`AlbumScreen.kt`): discs of glass
 * that leave with the art, and a frosted bar that comes in once it has gone.
 */
function ArtBar({
  leading,
  title,
  right,
  header,
  intensity,
}: {
  leading: Leading;
  title?: string;
  right?: ReactNode;
  header?: number;
  intensity: number;
}) {
  const theme = useTheme();
  const chrome = useScreenChrome();
  const inset = useTopBarInset();
  const scrollY = usePageOffset();
  const pulse = usePulse();
  const reduceMotion = useReducedMotion();
  const { height: display } = useWindowDimensions();

  const barHeight = inset + TOP_BAR_ROW;
  const revealAt = revealOffset(header ?? Math.round(display * DEFAULT_HEADER), barHeight);
  /* The discs' foot: carried this far, they are off the top of the display. */
  const discLimit = inset + TOP_BAR_DISC_ROOM;

  /* The pinned bar: 0 away, 1 in. */
  const shown = useSharedValue(0);
  /* The same thing where React can read it — for what may be touched and what
     a screen reader is offered, neither of which a worklet can say. */
  const [pinned, setPinned] = useState(false);

  useAnimatedReaction(
    () => {
      const offset = scrollY.get();
      return isScrolled(offset) && offset >= revealAt;
    },
    (past, was) => {
      if (past === was || (was === null && !past)) return;
      const to = past ? 1 : 0;
      /* The slide is movement and is left out under Reduce Motion (the style
         below); the fade is kept, at the frost's own pace. */
      shown.set(
        reduceMotion
          ? withTiming(to, { duration: FROST.ms, easing: FROST_EASING })
          : withSpring(to, BAR_SPRING)
      );
      runOnJS(setPinned)(past);
    },
    [revealAt, reduceMotion]
  );

  const discsStyle = useAnimatedStyle(() => {
    pulse.get();
    return {
      /* Gone as the bar arrives, for the page whose header is so short that
         the discs are still in sight when it does. */
      opacity: 1 - shown.get(),
      transform: [{ translateY: discShift(scrollY.get(), discLimit) }],
    };
  });

  const barStyle = useAnimatedStyle(() => {
    pulse.get();
    const away = 1 - shown.get();
    return { transform: [{ translateY: reduceMotion ? 0 : -away * barHeight * BAR_SLIDE }] };
  });

  const contentStyle = useAnimatedStyle(() => {
    pulse.get();
    return { opacity: shown.get(), transform: [{ translateY: 0 }] };
  });

  return (
    <>
      {/*
        `box-none`, and it is the whole reason the discs can float.

        The row spans the width so the right-hand controls can sit at the far
        edge, but it draws nothing and must not intercept taps — a transparent
        full-width strip over the top of the page would swallow every press on
        the artwork beneath it.
      */}
      <Animated.View
        style={[styles.layer, { paddingTop: inset + TOP_BAR_EDGE }, discsStyle]}
        pointerEvents={pinned ? 'none' : 'box-none'}
        accessibilityElementsHidden={pinned}
        importantForAccessibility={pinned ? 'no-hide-descendants' : 'auto'}>
        <View style={styles.discRow} pointerEvents="box-none">
          {leading ? <GlassDisc {...leading} intensity={intensity} /> : <View />}
          {!!right && <View style={styles.discs}>{right}</View>}
        </View>
      </Animated.View>

      {/*
        The whole bar is moved, and nothing above the blur is faded: a blur
        inside a view that is itself fading is not a blur on iOS until the fade
        ends. So the frost fades by its own strength and the row by its own
        opacity, and only the transform is shared.
      */}
      <Animated.View
        style={[styles.layer, { height: barHeight }, barStyle]}
        pointerEvents={pinned ? 'auto' : 'none'}
        accessibilityElementsHidden={!pinned}
        importantForAccessibility={pinned ? 'auto' : 'no-hide-descendants'}>
        <Frost progress={shown} pulse={pulse} tint={chrome?.background ?? theme.background} />
        <Animated.View style={contentStyle}>
          <BarRow inset={inset} leading={leading} right={right}>
            {/* The reference's `basicMarquee`: a game's or a collection's name
                is not ours to shorten. Mounted only while the bar is in — a
                marquee is a loop, and this one would run behind the artwork. */}
            <View style={[styles.title, { marginLeft: leading ? TOP_BAR_TITLE_GAP : TITLE_ALONE }]}>
              {pinned && !!title && (
                <MarqueeText text={title} variant="h3" accessibilityRole="header" />
              )}
            </View>
          </BarRow>
        </Animated.View>
      </Animated.View>
    </>
  );
}

/**
 * A top bar for a root tab, which has nothing to go back to — Home's: its row
 * at the top of the page, clear at the top and the page's colour under way
 * like any other.
 *
 * **It stays where it is.** It folded away while the page was read downward
 * and came back on the way up (`HomeScreen.kt`'s `isScrollingUp`); the owner
 * had that removed (2026-10-14): "Make the home top bar stay at the top, it
 * should not move with the scroll." The name is kept so its one caller did not
 * change.
 *
 * The row is the caller's — Home's is SimpMusic's own header (`<HomeHeader>`):
 * the avatar, the chips and Create. It is `height` high, 64 unless the caller
 * says otherwise (Home's is the reference's 56), and the page keeps the inset
 * and that row clear at its top.
 */
export function FoldingTopBar({
  children,
  height = TOP_BAR_ROW,
}: {
  children: ReactNode;
  height?: number;
}) {
  const theme = useTheme();
  const chrome = useScreenChrome();
  const inset = useTopBarInset();
  const scrollY = usePageOffset();
  const pulse = usePulse();
  const frost = useSharedValue(0);

  /* A fade, so it runs unchanged under Reduce Motion: nothing here moves. */
  useAnimatedReaction(
    () => isScrolled(scrollY.get()),
    (scrolled, was) => {
      if (scrolled === was) return;
      frost.set(withTiming(scrolled ? 1 : 0, { duration: FROST.ms, easing: FROST_EASING }));
    }
  );

  return (
    <View style={[styles.layer, { height: inset + height }]} pointerEvents="box-none">
      <Frost progress={frost} pulse={pulse} tint={chrome?.background ?? theme.background} />
      <View style={[styles.foldRow, { marginTop: inset, height }]} pointerEvents="box-none">
        {children}
      </View>
    </View>
  );
}

/**
 * What the bar is over the page: the page's own colour, solid, faded in by
 * `progress` — clear at the top of a page, and a band of the page under it
 * once there is something under it.
 *
 * **No blur.** The bar was frost — the page behind it blurred, with its colour
 * washed over the blur (the reference's `barBlurStyle`) — and the owner had
 * the blur removed (2026-10-14). The bar is the colour the reference itself
 * draws where it cannot blur. `tint` is the page's colour (`<Screen
 * background>`), so a game's page has a bar in the game's tone.
 *
 * Every style here reads `pulse` and carries a transform — see `usePulse`.
 */
function Frost({
  progress,
  pulse,
  tint,
}: {
  progress: SharedValue<number>;
  pulse: SharedValue<number>;
  tint: string;
}) {
  const wash = useAnimatedStyle(() => {
    pulse.get();
    return { opacity: progress.get(), transform: [{ translateY: 0 }] };
  });

  return (
    <View style={styles.fill} pointerEvents="none">
      <Animated.View style={[styles.fill, { backgroundColor: tint }, wash]} />
    </View>
  );
}

/** The bar's row: a control, the title, the page's controls. */
function BarRow({
  inset,
  leading,
  right,
  children,
}: {
  inset: number;
  leading: Leading;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <TopBarForm.Provider value="bar">
      <View style={[styles.row, { marginTop: inset }]}>
        {leading && <BarKey {...leading} />}
        {children}
        {!!right && <View style={styles.keys}>{right}</View>}
      </View>
    </TopBarForm.Provider>
  );
}

function BarTitle({
  title,
  leading,
  centre,
}: {
  title?: string;
  leading: boolean;
  centre: boolean;
}) {
  if (centre) {
    return (
      <>
        <View style={styles.title} />
        {!!title && (
          <View style={styles.centred} pointerEvents="none">
            <Text variant="h3" numberOfLines={1} accessibilityRole="header">
              {title}
            </Text>
          </View>
        )}
      </>
    );
  }

  return (
    <View style={[styles.title, { marginLeft: leading ? TOP_BAR_TITLE_GAP : TITLE_ALONE }]}>
      {!!title && (
        /* `h3`: the reference's `titleMedium`, 18 — "a sheet's or a screen's
           title" in this app's scale. */
        <Text variant="h3" numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
      )}
    </View>
  );
}

export type TopBarDiscProps = {
  icon: IconName;
  /** Required: the glyph is the only content, so there is no label to fall back on. */
  label: string;
  onPress: () => void;
  intensity?: number;
  /** Horizontal optical correction for glyphs whose mass is off-centre. */
  nudge?: number;
};

/**
 * A control at the top of a page: a disc of glass with a glyph in it over
 * artwork, and the bare glyph once it is in the bar.
 *
 * Exported so a screen's right-hand controls are the same object as its back
 * control in both places. A bare `<IconButton>` beside this would be a filled
 * grey circle — a different material in the same row.
 */
export function TopBarDisc(props: TopBarDiscProps) {
  const form = useContext(TopBarForm);
  return form === 'bar' ? <BarKey {...props} /> : <GlassDisc {...props} />;
}

/**
 * A control in the bar: Material 3's icon button, as the reference's bars use
 * it — a 24dp glyph, nothing behind it until it is held, 48 to touch.
 */
function BarKey({ icon, label, onPress, nudge = 0 }: TopBarDiscProps) {
  const theme = useTheme();

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      scaleTo={0.9}
      hitSlop={(TOP_BAR_KEY - TOP_BAR_KEY_FILL) / 2}
      /* Held, the 40dp circle M3 calls the state layer. It rests on white at
         nothing so there is a colour for the press to ease in from. */
      pressedColor={theme.controlPressed}
      style={StyleSheet.flatten([styles.key, { backgroundColor: withAlpha(theme.text, 0) }])}>
      <Ionicons name={icon} size={TOP_BAR_GLYPH} color={theme.text} style={{ marginLeft: nudge }} />
    </PressableScale>
  );
}

/** One disc of glass with a glyph in it. */
function GlassDisc({ icon, label, onPress, intensity = 60, nudge = 0 }: TopBarDiscProps) {
  const theme = useTheme();
  const chrome = useScreenChrome();

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      scaleTo={0.9}
      style={StyleSheet.flatten(styles.disc)}>
      {/* The rim. It fills the disc; the pane over it is one dp smaller all
          round, so one dp of this is what shows. */}
      <View style={[styles.fill, { experimental_backgroundImage: RIM }]} pointerEvents="none" />

      <View style={styles.pane} pointerEvents="none">
        <BlurView
          intensity={intensity}
          tint="dark"
          style={styles.fill}
          {...(Platform.OS === 'android'
            ? {
                blurMethod: 'dimezisBlurView' as const,
                blurTarget: chrome?.blurTarget,
                blurReductionFactor: 4,
              }
            : null)}
        />

        {/* Over the blur, not under it — a blur preserves brightness, so a
            white glyph crossing a pale patch of key art is unreadable however
            much detail has been smeared away. */}
        <View style={[styles.fill, { backgroundColor: withAlpha(theme.shadowInk, PANE_SCRIM) }]} />
        <View style={[styles.fill, { experimental_backgroundImage: SHEEN }]} />
      </View>

      <Ionicons name={icon} size={24} color={theme.text} style={{ marginLeft: nudge }} />
    </PressableScale>
  );
}

/** The title's start when no control is in front of it, less the row's own padding. */
const TITLE_ALONE = TOP_BAR_TITLE_INSET - TOP_BAR_SIDE;

const styles = StyleSheet.create({
  /*
   * Absolute, so it reserves no space and the page runs underneath it — which
   * is what gives the frost something to frost. A page that does not open on
   * artwork takes the room back with `<Screen insetHeader>`.
   */
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  row: {
    height: TOP_BAR_ROW,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: TOP_BAR_SIDE,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  foldRow: {
    height: TOP_BAR_ROW,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  title: { flex: 1, minWidth: 0, justifyContent: 'center' },
  /* Centred on the screen, not on what is left between the controls: inset at
     both ends by one control, so a long name stops short of either. */
  centred: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: TOP_BAR_SIDE + TOP_BAR_KEY + TOP_BAR_TITLE_GAP,
    right: TOP_BAR_SIDE + TOP_BAR_KEY + TOP_BAR_TITLE_GAP,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keys: { flexDirection: 'row', alignItems: 'center' },
  key: {
    width: TOP_BAR_KEY_FILL,
    height: TOP_BAR_KEY_FILL,
    borderRadius: TOP_BAR_KEY_FILL / 2,
    margin: (TOP_BAR_KEY - TOP_BAR_KEY_FILL) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    /* The reference's 12, not the page's 15: the disc is in the corner of the
       display, not on the page's margin. */
    paddingHorizontal: TOP_BAR_EDGE,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  discs: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    alignItems: 'center',
    justifyContent: 'center',
    /* The glass has to be clipped to the circle; without this the blur renders
       as its own square behind a round scrim. */
    overflow: 'hidden',
  },
  /* The pane: the disc less the one dp of rim, and clipped to its own circle
     for the reason the disc is. */
  pane: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    borderRadius: (DISC - 2) / 2,
    overflow: 'hidden',
  },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
