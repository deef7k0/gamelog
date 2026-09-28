import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, StyleSheet, Text, View, type PressableProps } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import {
  ControlHeight,
  Elevation,
  Radius,
  SmallControlSlop,
  Spacing,
  Type,
  withAlpha,
} from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import { mix, readableInk, saturate } from '@/lib/color';

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

/** How far a vivid fill deepens toward its ink while held — `PRESSED_DEPTH`'s twin. */
const VIVID_PRESSED_DEPTH = 0.14;

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  variant?: Variant;
  size?: Size;
  /**
   * `control` — `Radius.control`, the shared shape every button takes: a soft
   * stadium at the medium height, a true pill at the small one.
   * `pill` — fully rounded ends at every height.
   *
   * It exists for the game page's action cluster, which is a deliberate
   * Material-3-shaped transport control: one wide filled action with a row of
   * tonal icon buttons under it. At `large` (60dp) `control` would draw a
   * rounded rectangle, and the cluster's primary key has to close into a true
   * pill to match the ends of the keys under it. Reach for it only where the
   * whole cluster is shaped that way.
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
   * Which depth tier to cast at. **`none` by default** — a control in this
   * language is drawn by its fill and its 1px edge, not by a shadow.
   *
   * Exists for one situation and should not spread past it: a `primary` button
   * on a screen whose *background carries the same hue as its fill*. On a game
   * page the page is read out of the box art and the accent is read out of the
   * same art, so the button and the page behind it are the same colour and the
   * edge between them stops existing. There is no fill or ink change available —
   * both are already the accent by design — so the separation has to come from
   * depth. The game page's review button passes `raised`, and nothing else
   * passes anything. Ghost keeps `none` whatever is passed — Android needs an
   * opaque background to draw a shadow against.
   */
  elevation?: keyof typeof Elevation;
};

/**
 * The app's button. Four variants, one family.
 *
 *  - `primary`   filled with **the screen's accent** — the house blue on the
 *                house screens, the game's own colour on a game's. The one thing on a
 *                screen you are most likely to want. At most one per screen.
 *  - `secondary` the dark surface with a 1px edge. The default for everything
 *                else: "Cancel", "Retry", "Change settings".
 *  - `ghost`     no fill and no edge. For an action that must not draw the eye —
 *                a tertiary link. It gains a faint fill only while held.
 *  - `danger`    a subtle red: a red wash, a red edge, a red label. Destructive
 *                actions must not look like safe ones, and must not outshout the
 *                artwork beside them either — so a tint, never a red slab.
 *
 * **Every state is drawn, not faded.** Held, a fill goes one step *deeper*
 * (`accent.pressed`, `surfaceSelected`) and the button sinks 3%. Focused from a
 * keyboard, it wears the accent's ring. Disabled, it drops to the resting
 * control surface with muted type — distinguishable from enabled without
 * relying on opacity, and still readable enough to say why it is there.
 *
 * **`primary` is the accent, not a fixed colour.** On a game's own screens the
 * accent is that game's Material 3 `primary`, so "Log this game" on a DOOM page
 * is red — the single loudest element on the screen, carrying the colour of the
 * thing the screen is about. The label follows: `accent.ink` is measured
 * against the fill.
 *
 * 48dp tall (60 when large, 36 when small — lifted to the tap floor by slop),
 * `Radius.control`.
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
  elevation = 'none',
  hitSlop,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const accent = useAccent();
  const isInert = disabled || loading;
  /* Loading keeps the button's own colours — it is working, not unavailable —
     so only a genuinely disabled button takes the inert treatment. */
  const unavailable = !!disabled && !loading;
  const small = size === 'small';
  const large = size === 'large';

  /* The fill first, then the label measured against it — in that order, because
     a vivid lift moves the fill and `accent.ink` was chosen for the unlifted
     one. See `VIVID_FLOOR`. */
  const vivid = tone === 'vivid';
  const primaryFill = vivid ? saturate(accent.color, VIVID_FLOOR) : accent.color;
  const primaryInk = vivid ? readableInk(primaryFill) : accent.ink;

  const look = unavailable
    ? {
        background: variant === 'ghost' ? 'transparent' : theme.surfaceElevated,
        edge: variant === 'ghost' ? 'transparent' : theme.border,
        foreground: theme.textMuted,
        pressed: undefined,
      }
    : {
        primary: {
          background: primaryFill,
          /* Transparent rather than the fill: the background paints under the
             border, so the edge deepens with the fill while held instead of
             staying behind as a lighter 1px ring. */
          edge: 'transparent',
          foreground: primaryInk,
          pressed: vivid ? mix(primaryFill, primaryInk, VIVID_PRESSED_DEPTH) : accent.pressed,
        },
        secondary: {
          background: theme.surfaceElevated,
          edge: theme.border,
          foreground: theme.text,
          pressed: theme.surfaceSelected,
        },
        ghost: {
          background: 'transparent',
          edge: 'transparent',
          foreground: theme.text,
          pressed: theme.pressed,
        },
        danger: {
          background: withAlpha(theme.danger, 0.1),
          edge: withAlpha(theme.danger, 0.3),
          foreground: theme.danger,
          pressed: withAlpha(theme.danger, 0.18),
        },
      }[variant];

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isInert, busy: loading }}
      accessibilityLabel={count != null ? `${title}, ${count}` : title}
      disabled={isInert}
      scaleTo={0.97}
      pressedColor={look.pressed}
      focusRing={accent.ring}
      /* A small button is drawn at 36 and touched at the platform floor. */
      hitSlop={hitSlop ?? (small ? SmallControlSlop : undefined)}
      style={StyleSheet.flatten([
        styles.base,
        small ? styles.small : large ? styles.large : styles.medium,
        shape === 'pill' && styles.pill,
        /* Ghost has no fill, so it stays flat — Android's elevation needs an
           opaque background to draw against, and a floating transparent
           rectangle would read as a bug rather than as depth. */
        variant === 'ghost' || unavailable ? Elevation.none : Elevation[elevation],
        { backgroundColor: look.background, borderColor: look.edge },
        fullWidth && styles.fullWidth,
      ])}
      {...rest}>
      {/* Keep the label mounted while loading so the button does not resize. */}
      {loading && (
        <View style={styles.spinner}>
          <ActivityIndicator size="small" color={look.foreground} />
        </View>
      )}

      <View style={[styles.content, { opacity: loading ? 0 : 1 }]}>
        {icon && (
          <Ionicons name={icon} size={small ? 15 : large ? 20 : 17} color={look.foreground} />
        )}

        <Text
          style={[
            styles.label,
            small && styles.labelSmall,
            large && styles.labelLarge,
            { color: look.foreground },
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
                // ink is what decides which, since a light accent needs a dark
                // recess where a dark fill needs a pale one.
                backgroundColor:
                  variant === 'primary' && !unavailable
                    ? withAlpha(look.foreground, 0.14)
                    : theme.surfaceSelected,
              },
            ]}>
            <Text style={[styles.countLabel, { color: look.foreground }]}>{count}</Text>
          </View>
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  /* A 1px edge on every variant, transparent where the variant has none, so
     switching variant or state never moves the label by a pixel. */
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.control,
    borderWidth: 1,
  },
  /* 48 on both platforms — past iOS's 44 and exactly Android's 48, so the
     drawn height and the touch floor are the same number. */
  medium: {
    paddingVertical: Spacing.x12,
    paddingHorizontal: Spacing.x32,
    minHeight: ControlHeight.medium,
  },
  /* 36 drawn, the tap floor through `SmallControlSlop`. `small` is for a button
     inside a row or a card, where a 48dp slab would outweigh what it acts on. */
  small: {
    paddingVertical: Spacing.x4,
    paddingHorizontal: Spacing.x20,
    minHeight: ControlHeight.small,
  },
  /* 60, for the one action a screen is *about*. Well past the tap floor, which
     is not the point — the point is that it has to out-weigh a row of tonal
     controls sitting directly under it and still read as the thing you came to
     press. */
  large: {
    paddingVertical: Spacing.x16,
    paddingHorizontal: Spacing.x32,
    minHeight: ControlHeight.large,
  },
  pill: { borderRadius: Radius.pill },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  label: { ...Type.button },
  /* Only the size steps down — the family comes from `label` above. */
  labelSmall: { fontSize: Type.body.fontSize, lineHeight: Type.body.lineHeight },
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
