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
 * The app's button.
 *
 * One shape for every control: a slightly-lifted rectangle with a hairline
 * outline at `Radius.control`. Variants change the *value* — how light the fill
 * is — never the hue, because a coloured button next to a game's cover art
 * competes with the artwork the screen exists to show.
 *
 *  - `primary`   near-white fill, dark label. One per screen at most.
 *  - `secondary` raised dark fill with an outline. The default for everything.
 *  - `ghost`     outline only, no fill. For actions that must not draw the eye.
 *  - `danger`    secondary's shape with a red label and a red-tinted edge.
 *
 * `danger` is deliberately *not* a red slab. A filled red button is the loudest
 * thing that can appear on a dark screen, and this app's destructive action is
 * "delete a collection", which does not warrant outshouting the cover art beside
 * it. Red type on a dark fill is unmistakable without dominating.
 *
 * Press feedback is a scale sink plus a fill step, both of which survive on
 * near-black where an opacity change is invisible.
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

  const border = {
    primary: theme.primary,
    secondary: theme.border,
    ghost: theme.border,
    danger: `${theme.danger}55`,
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
        { backgroundColor: background, borderColor: border },
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
    borderWidth: StyleSheet.hairlineWidth,
  },
  medium: {
    paddingVertical: Spacing.three - 1,
    paddingHorizontal: Spacing.four,
    minHeight: 46,
  },
  small: {
    paddingVertical: Spacing.two - 1,
    paddingHorizontal: Spacing.three,
    minHeight: 34,
  },
  fullWidth: { alignSelf: 'stretch' },
  /* Dimmed rather than hidden — a disabled control still has to be readable
     enough to explain why it is there. */
  inert: { opacity: 0.45 },
  content: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  label: { fontSize: 15, fontFamily: FontFamily.semibold },
  labelSmall: { fontSize: 13 },
  count: {
    minWidth: 22,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countLabel: { fontSize: 11, fontFamily: FontFamily.semibold },
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
