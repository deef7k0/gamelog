import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, StyleSheet, Text, View, type PressableProps } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'medium' | 'small';

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  variant?: Variant;
  size?: Size;
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
};

/**
 * The app's button. Three styles, and no outlines.
 *
 *  - `primary`   filled accent blue, white label. The one thing on a screen you
 *                are most likely to want. At most one per screen.
 *  - `secondary` filled `surfaceElevated`. The default for everything else.
 *  - `ghost`     no fill at all. For an action that must not draw the eye —
 *                "Cancel", a tertiary link.
 *  - `danger`    secondary's shape with a red label.
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
  loading = false,
  fullWidth = false,
  icon,
  count,
  disabled,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const isInert = disabled || loading;
  const small = size === 'small';

  const background = {
    primary: theme.primary,
    secondary: theme.surfaceElevated,
    ghost: 'transparent',
    danger: theme.surfaceElevated,
  }[variant];

  const foreground = {
    primary: theme.onPrimary,
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
        small ? styles.small : styles.medium,
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
        {icon && <Ionicons name={icon} size={small ? 15 : 17} color={foreground} />}

        <Text
          style={[styles.label, small && styles.labelSmall, { color: foreground }]}
          numberOfLines={1}>
          {title}
        </Text>

        {count != null && (
          <View
            style={[
              styles.count,
              {
                // On a near-white primary fill the recess has to go *darker*;
                // everywhere else it goes lighter. Same idea, opposite direction.
                backgroundColor:
                  variant === 'primary' ? `${theme.onPrimary}1A` : theme.surfaceSelected,
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
  medium: {
    paddingVertical: Spacing.x12,
    paddingHorizontal: Spacing.x20,
    minHeight: 46,
  },
  /* Still 40, not 34: `small` is a size, not an excuse to go under the tap
     target. The saving comes from padding, not from height. */
  small: {
    paddingVertical: Spacing.x8,
    paddingHorizontal: Spacing.x16,
    minHeight: 40,
  },
  fullWidth: { alignSelf: 'stretch' },
  /* Dimmed rather than hidden — a disabled control still has to be readable
     enough to explain why it is there. */
  inert: { opacity: 0.45 },
  content: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  label: { fontSize: 15, fontFamily: FontFamily.semibold },
  labelSmall: { fontSize: 13 },
  count: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countLabel: { fontSize: 12, fontFamily: FontFamily.semibold },
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
