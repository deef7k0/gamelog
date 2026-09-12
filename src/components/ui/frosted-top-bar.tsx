import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { memo, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { MaxContentWidth, Spacing, TapTarget, withAlpha } from '@/constants/theme';
import { useTopBarInset } from '@/hooks/use-header-height';
import { useScreenChrome } from '@/hooks/use-screen-chrome';
import { useTheme } from '@/hooks/use-theme';

/**
 * Diameter of the disc, in dp.
 *
 * `TapTarget` exactly — 44 on iOS, 48 on Android. The glyph inside is the only
 * thing this control draws, so the circle *is* the touch area and there is no
 * reason for it to be any bigger or any smaller than the platform floor.
 */
const DISC = TapTarget;

/**
 * A floating circular back button, over the page.
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
   * @default 80 — a little softer than the bar's 90. At disc size there is far
   * less area to destroy detail across, and a heavier blur made the circle read
   * as an opaque grey button rather than as glass.
   */
  intensity?: number;
};

export const FrostedTopBar = memo(function FrostedTopBar({
  back = false,
  onBack,
  dismiss = false,
  right,
  intensity = 80,
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
    <View style={[styles.layer, { paddingTop: inset + Spacing.x8 }]} pointerEvents="box-none">
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
 * button. A bare `<IconButton>` beside this would be a rounded *rectangle* on a
 * surface fill — a different shape and a different material in the same row.
 */
export function TopBarDisc({ icon, label, onPress, intensity = 80, nudge = 0 }: TopBarDiscProps) {
  const theme = useTheme();
  const chrome = useScreenChrome();

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      scaleTo={0.9}
      style={StyleSheet.flatten(styles.disc)}>
      <BlurView
        intensity={intensity}
        tint="dark"
        style={styles.glass}
        {...(Platform.OS === 'android'
          ? {
              blurMethod: 'dimezisBlurView' as const,
              blurTarget: chrome?.blurTarget,
              blurReductionFactor: 4,
            }
          : null)}
      />

      {/* Over the blur, not under it — a blur preserves brightness, so a white
          glyph crossing a pale patch of key art is unreadable however much
          detail has been smeared away. 22% rather than the old bar's 30%: this
          only has to carry one glyph, and the lighter scrim is what keeps the
          disc reading as glass instead of as a grey button. */}
      <View
        style={[styles.scrim, { backgroundColor: withAlpha(theme.shadowInk, 0.22) }]}
        pointerEvents="none"
      />

      <Ionicons name={icon} size={22} color={theme.text} style={{ marginLeft: nudge }} />
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
    paddingHorizontal: Spacing.x16,
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
  glass: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
