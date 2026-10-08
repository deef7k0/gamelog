import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { memo, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { MaxContentWidth, Spacing, withAlpha } from '@/constants/theme';
import { useTopBarInset } from '@/hooks/use-header-height';
import { useScreenChrome } from '@/hooks/use-screen-chrome';
import { useTheme } from '@/hooks/use-theme';

/**
 * Diameter of the disc, in dp: 48 on both platforms.
 *
 * The owner's reference, SimpMusic — its album screen's back button is
 * `LiquidGlassIconButton(…, Modifier.size(48.dp))`. It was `TapTarget`, 44 on
 * iOS and 48 on Android; one size now, and at or over the floor on both.
 */
export const TOP_BAR_DISC = 48;
const DISC = TOP_BAR_DISC;

/**
 * How far a disc sits from the corner it is in, on both axes: the reference's
 * `padding(12.dp)` under the status bar. With the disc that is the 60 of
 * `TopBarHeight`, which is what a screen reserves for it.
 */
export const TOP_BAR_EDGE = 12;

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

/**
 * A floating circular back button, over the page — SimpMusic's, at its size
 * and in its corner (`AlbumScreen.kt`): a 48dp disc of glass, 12 from the edge
 * and 12 under the status bar, holding a back chevron. Controls at the other
 * end of the row are the same disc.
 *
 * ## What this replaced, and why
 *
 * A full-width sheet of frosted glass with a title on it, pinned across the top
 * of every screen. It was a good bar and it cost too much: `inset + 56` is about
 * **111dp of a 844pt display — 13%** — permanently occupied by a strip whose
 * entire content was one word and one chevron. It also blurred and scrimmed the
 * top of every piece of key art in the app, which on a page whose subject *is*
 * artwork is the chrome dimming the content to make room for a label naming the
 * content.
 *
 * A disc says the same thing in 44dp. The page keeps its full height, the
 * artwork is uninterrupted, and the affordance is exactly where a thumb reaches
 * for it.
 *
 * **The cost, stated plainly: screens no longer carry a title.** Wayfinding now
 * comes from what the page opens with — a game's own case and name, a
 * collection's mosaic, a profile's banner — which on every artwork-led screen
 * was already saying it louder than the bar was. On the handful of screens that
 * lead with a list rather than art, this is a genuine loss and the page is
 * expected to state its own heading in the content.
 *
 * ## Still glass, and more of it
 *
 * The blur is the same `expo-blur` layer at the same intensity; only the shape
 * changed. The scrim over it is lighter than the bar's 30% — a disc floating on
 * artwork wants to read as glass rather than as a hole punched in the page, and
 * with only a glyph to keep legible it can afford the transparency the
 * full-width bar could not.
 *
 * ## Android still needs a target
 *
 * Unchanged from the bar: a `<BlurView>` with `blurMethod: 'dimezisBlurView'`
 * and no `blurTarget` silently falls back to a flat translucent slab. The target
 * is the page content, wrapped by `<Screen>` in `<BlurTargetView>` and passed
 * here through `useScreenChrome()`. Outside a `<Screen>` this still renders; it
 * just loses the blur on Android.
 *
 * @example
 * ```tsx
 * <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back />}>
 * ```
 */
export type FrostedTopBarProps = {
  /**
   * Show the back disc.
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
   * Controls on the right — a bell, a menu, a share.
   *
   * Lay them out yourself, but give them the same disc: `<TopBarDisc>` is
   * exported for exactly that, so the two ends of the row read as one family.
   */
  right?: ReactNode;
  /**
   * Blur strength, 1–100.
   *
   * @default 60 — the reference blurs what is behind its button by 8dp, light
   * enough that shapes still show through it; that is what makes it glass
   * rather than a grey button. It was 80.
   */
  intensity?: number;
};

export const FrostedTopBar = memo(function FrostedTopBar({
  back = false,
  onBack,
  dismiss = false,
  right,
  intensity = 60,
}: FrostedTopBarProps) {
  const router = useRouter();
  const inset = useTopBarInset();

  function goBack() {
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
  }

  const showLeading = back || dismiss;
  if (!showLeading && !right) return null;

  return (
    /*
     * `box-none`, and it is the whole reason this can float.
     *
     * The row spans the width so the right-hand controls can sit at the far
     * edge, but it draws nothing and must not intercept taps — a transparent
     * full-width strip over the top of the page would swallow every press on
     * the artwork beneath it. `box-none` lets the discs stay tappable while the
     * row itself is not there as far as the touch system is concerned.
     */
    <View style={[styles.layer, { paddingTop: inset + TOP_BAR_EDGE }]} pointerEvents="box-none">
      <View style={styles.row} pointerEvents="box-none">
        {showLeading ? (
          <TopBarDisc
            icon={dismiss ? 'close' : 'chevron-back'}
            label={dismiss ? 'Close' : 'Go back'}
            onPress={goBack}
            intensity={intensity}
            /* Optically nudged: `chevron-back` is drawn with its mass to the
               right of its own box, so a centred glyph sits visibly right of
               the circle's middle. */
            nudge={-1}
          />
        ) : (
          <View />
        )}

        {!!right && <View style={styles.trailing}>{right}</View>}
      </View>
    </View>
  );
});

export type TopBarDiscProps = {
  icon: keyof typeof Ionicons.glyphMap;
  /** Required: the glyph is the only content, so there is no label to fall back on. */
  label: string;
  onPress: () => void;
  intensity?: number;
  /** Horizontal optical correction for glyphs whose mass is off-centre. */
  nudge?: number;
};

/**
 * One disc of glass with a glyph in it.
 *
 * Exported so a screen's right-hand controls are the same object as its back
 * button. A bare `<IconButton>` beside this would be a filled grey circle — a
 * different material in the same row.
 */
export function TopBarDisc({ icon, label, onPress, intensity = 60, nudge = 0 }: TopBarDiscProps) {
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

const styles = StyleSheet.create({
  /*
   * Absolute, so it reserves no space and the page runs underneath it. Screens
   * that do not open on artwork pair it with `<Screen insetHeader>`, exactly as
   * they did with the bar.
   */
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  row: {
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
  trailing: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
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
