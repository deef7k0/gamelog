import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, StyleSheet, Text, View, type PressableProps } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Elevation, Radius, Spacing, TapTarget, Type, withAlpha } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import { readableInk, saturate } from '@/lib/color';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'large' | 'medium' | 'small';
type Shape = 'control' | 'pill';
type Tone = 'default' | 'vivid';

/**
 * The saturation floor `tone="vivid"` lifts a primary fill to.
 *
 * `accent.color` is M3's `primary` — the seed's hue at tone 60, with chroma
 * clamped to 48–72 so a fill is never neon. That is the right ceiling for a
 * colour that might appear several times on a page, and it is one step quieter
 * than the single button a screen is *about* wants to be: measured on real
 * seeds, a muted cover lands its primary around 0.45 HSL saturation, which on a
 * near-black page reads closer to slate than to the game's colour.
 *
 * 0.72 is a floor rather than a set point, so `saturate()` leaves an already
 * vivid extraction — DOOM's red at 0.84, a gold cover at 1.00 — exactly where it
 * was and only lifts the ones that arrived muted. It is deliberately short of
 * the 0.78 this was first set to: the only seed the two really disagree about is
 * a mid-green, which 0.78 takes to `#1AD156` — a neon that stops looking like
 * the game's colour and starts looking like a highlighter.
 *
 * Hue and HSL lightness are preserved, but relative luminance is not exactly, so
 * the ink is recomputed against the fill that actually ships rather than
 * inherited from `accent.ink`. Measured across eight real seeds at this floor:
 * ink-on-fill 5.45–8.87:1, fill-on-page 4.85–7.90:1. Nothing here is close to a
 * line, which is the point of lifting saturation rather than tone.
 */
const VIVID_FLOOR = 0.72;

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  variant?: Variant;
  size?: Size;
  /**
   * `control` — `Radius.control`, the shared shape almost every button takes.
   * `pill` — fully rounded ends.
   *
   * **An exception, and a narrow one.** The app's rule is that every interactive
   * rectangle is `Radius.control` and the pill belongs to things that are *not*
   * controls — chips, progress tracks, badges. That rule is what keeps buttons
   * reading as one family, and it still holds everywhere this prop is not
   * passed.
   *
   * It exists for the game page's action cluster, which is a deliberate
   * Material-3-shaped transport control: one wide filled action with a row of
   * tonal icon buttons under it. There the pill is the *point* — it is what
   * separates that cluster from a form and makes it read as a set of controls
   * for the object above them. Reach for it only where the whole cluster is
   * shaped that way, never for a single button on an ordinary screen.
   */
  shape?: Shape;
  /**
   * How loud a `primary` fill is allowed to be. Ignored by every other variant.
   *
   * `default` is `accent.color` — M3's `primary`, which is tuned to be usable
   * wherever the accent appears.
   *
   * `vivid` lifts that fill's saturation to `VIVID_FLOOR`. **For the one button
   * a screen exists for, and nothing else.** The game page's "Write a review" is
   * the case it was added for: it sits above a row of tonal keys built from the
   * same palette, on a page filled with the same palette's darkest tone, and at
   * the shared primary it was the loudest thing on the page by a margin too
   * small to be obvious. A second vivid button anywhere would spend the one
   * signal this has.
   */
  tone?: Tone;
  loading?: boolean;
  /** Stretch to fill the parent's cross axis. */
  fullWidth?: boolean;
  /** Leading glyph. Sits inside the label group, not pinned to the edge. */
  icon?: keyof typeof Ionicons.glyphMap;
  /**
   * Trailing count, in a recessed pill — "Messages 18".
   *
   * A darker inset rather than a coloured badge: the number is context for the
   * label, not an alert. Anything that genuinely demands attention uses a
   * `danger` dot instead, which is why this one is deliberately quiet.
   */
  count?: number | null;
  /**
   * Which depth tier to cast at. `control` everywhere by default.
   *
   * Exists for one situation and should not spread past it: a `primary` button
   * on a screen whose *background carries the same hue as its fill*. On a game
   * page the ambient gradient is read out of the box art and the accent is read
   * out of the same art, so the button and the page behind it are the same
   * colour and the edge between them stops existing. There is no fill or ink
   * change available — both are already the accent by design — so the separation
   * has to come from depth.
   *
   * `raised` is the answer rather than `overlay`: the game case casts the
   * heaviest shadow in the app on purpose, and an interface tier that reached
   * for the ceiling would start competing with it. Ghost keeps `none` whatever
   * is passed — Android needs an opaque background to draw a shadow against.
   */
  elevation?: keyof typeof Elevation;
};

/**
 * The app's button. Three styles, and no outlines.
 *
 *  - `primary`   filled with **the screen's accent**. The one thing on a screen
 *                you are most likely to want. At most one per screen.
 *  - `secondary` filled `surfaceElevated`. The default for everything else.
 *  - `ghost`     no fill at all. For an action that must not draw the eye —
 *                "Cancel", a tertiary link.
 *  - `danger`    secondary's shape with a red label.
 *
 * **`primary` is the accent, not the blue.** On most of the app those are the
 * same thing. On a game's own screens the accent is that game's identity hue,
 * so "Log this game" on a Doom page is ember and on a Celeste page is sky — the
 * single loudest element on the screen, carrying the colour of the thing the
 * screen is about. The label follows: `readableInk` puts near-black on every
 * hue in the ramp, because white on a mid-chroma hue is the one pairing in this
 * palette that reliably fails.
 *
 * Filled, not outlined. An outline is a fourth signal in a system that already
 * separates by surface step, and a screen of outlined rectangles reads as a form
 * rather than as a set of choices. `danger` is deliberately not a red slab: a
 * filled red button is the loudest thing a dark screen can show, and "delete a
 * collection" does not warrant outshouting the cover art beside it.
 *
 * 46px tall so the tap target clears 44 on its own, without padding tricks.
 * Press feedback is a 0.98 scale sink, which survives on near-black where an
 * opacity change is invisible.
 */
export function Button({
  title,
  variant = 'primary',
  size = 'medium',
  shape = 'control',
  tone = 'default',
  loading = false,
  fullWidth = false,
  icon,
  count,
  disabled,
  elevation = 'control',
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const accent = useAccent();
  const isInert = disabled || loading;
  const small = size === 'small';
  const large = size === 'large';

  /* The fill first, then the label measured against it — in that order, because
     a vivid lift moves the fill and `accent.ink` was chosen for the unlifted
     one. See `VIVID_FLOOR`. */
  const primaryFill = tone === 'vivid' ? saturate(accent.color, VIVID_FLOOR) : accent.color;

  const background = {
    primary: primaryFill,
    secondary: theme.surfaceElevated,
    ghost: 'transparent',
    danger: theme.surfaceElevated,
  }[variant];

  const foreground = {
    primary: tone === 'vivid' ? readableInk(primaryFill) : accent.ink,
    secondary: theme.text,
    ghost: theme.text,
    danger: theme.danger,
  }[variant];

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isInert, busy: loading }}
      accessibilityLabel={count != null ? `${title}, ${count}` : title}
      disabled={isInert}
      scaleTo={0.97}
      style={StyleSheet.flatten([
        styles.base,
        small ? styles.small : large ? styles.large : styles.medium,
        shape === 'pill' && styles.pill,
        /* Ghost has no fill, so it stays flat — Android's elevation needs an
           opaque background to draw against, and a floating transparent
           rectangle would read as a bug rather than as depth. */
        variant === 'ghost' ? Elevation.none : Elevation[elevation],
        { backgroundColor: background },
        fullWidth && styles.fullWidth,
        isInert && styles.inert,
      ])}
      {...rest}>
      {/* Keep the label mounted while loading so the button does not resize. */}
      {loading && (
        <View style={styles.spinner}>
          <ActivityIndicator size="small" color={foreground} />
        </View>
      )}

      <View style={[styles.content, { opacity: loading ? 0 : 1 }]}>
        {icon && <Ionicons name={icon} size={small ? 15 : large ? 20 : 17} color={foreground} />}

        <Text
          style={[
            styles.label,
            small && styles.labelSmall,
            large && styles.labelLarge,
            { color: foreground },
          ]}
          numberOfLines={1}>
          {title}
        </Text>

        {count != null && (
          <View
            style={[
              styles.count,
              {
                // On a filled primary the recess has to go *darker*; everywhere
                // else it goes lighter. Same idea, opposite direction — and the
                // ink is what decides which, since an identity-hued button is
                // light enough to need a dark recess where the blue needed a
                // pale one.
                backgroundColor:
                  variant === 'primary' ? withAlpha(foreground, 0.14) : theme.surfaceSelected,
              },
            ]}>
            <Text style={[styles.countLabel, { color: foreground }]}>{count}</Text>
          </View>
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.control,
  },
  /* Exactly `TapTarget`, not a magic 46. The padding above shrank with the
     spacing ladder, so the floor is what sets the height now — and the floor is
     the one number in here that must not move. */
  medium: {
    paddingVertical: Spacing.x12,
    paddingHorizontal: Spacing.x20,
    minHeight: TapTarget,
  },
  /* Still 36, not less: `small` is a size, not an excuse to shrink to nothing.
     The saving comes from padding, not from height. */
  small: {
    paddingVertical: Spacing.x8,
    paddingHorizontal: Spacing.x16,
    minHeight: 36,
  },
  /* 60, for the one action a screen is *about*. Well past the tap floor, which
     is not the point — the point is that it has to out-weigh a row of tonal
     controls sitting directly under it and still read as the thing you came to
     press. */
  large: {
    paddingVertical: Spacing.x16,
    paddingHorizontal: Spacing.x24,
    minHeight: 60,
  },
  pill: { borderRadius: Radius.pill },
  fullWidth: { alignSelf: 'stretch' },
  /* Dimmed rather than hidden — a disabled control still has to be readable
     enough to explain why it is there. */
  inert: { opacity: 0.45 },
  content: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  label: { ...Type.button },
  /* Only the size steps down — the family comes from `label` above. */
  labelSmall: { fontSize: Type.bodySmall.fontSize, lineHeight: Type.bodySmall.lineHeight },
  /* `h3`'s size on `button`'s family: the hero has to hold the middle of a 60dp
     slab without the word floating in it. */
  labelLarge: { fontSize: Type.h3.fontSize, lineHeight: Type.h3.lineHeight },
  count: {
    minWidth: 22,
    paddingHorizontal: Spacing.x4,
    paddingVertical: 1,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countLabel: { ...Type.h6 },
  spinner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
