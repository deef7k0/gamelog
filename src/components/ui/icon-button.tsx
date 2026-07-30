import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type IconButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  /** Required: there is no label to fall back on. */
  accessibilityLabel: string;
  onPress?: () => void;
  size?: 'medium' | 'small';
  /** `danger` tints the glyph and edge; `plain` drops the fill and outline. */
  tone?: 'default' | 'danger' | 'plain';
  active?: boolean;
  disabled?: boolean;
};

const SIZES = {
  medium: { box: 40, glyph: 19 },
  small: { box: 32, glyph: 16 },
} as const;

/**
 * A square button holding one glyph.

 * The same rectangle as `<Button>` — same radius, same fill, same hairline —
 * with equal sides, so an overflow "…" or an "add" sitting at the end of a row
 * of labelled buttons reads as one of them rather than as a loose icon. It is
 * square rather than round on purpose: a circle would be a third control shape
 * and the family only has one.
 *
 * `plain` exists for icons inside an already-bordered container — a row's
 * up/down/remove controls — where a second outline around each glyph would turn
 * a tidy row into a grid of boxes.
 */
export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  size = 'medium',
  tone = 'default',
  active = false,
  disabled = false,
}: IconButtonProps) {
  const theme = useTheme();
  const { box, glyph } = SIZES[size];

  const plain = tone === 'plain';

  const color = tone === 'danger' ? theme.danger : active ? theme.text : theme.textSecondary;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected: active }}
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.9}
      style={StyleSheet.flatten([
        styles.base,
        { width: box, height: box },
        plain
          ? styles.plain
          : {
              backgroundColor: active ? theme.surfaceSelected : theme.surfaceElevated,
              borderColor: tone === 'danger' ? `${theme.danger}55` : theme.border,
              borderWidth: StyleSheet.hairlineWidth,
            },
        disabled && styles.inert,
      ])}>
      <Ionicons name={icon} size={glyph} color={color} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.control,
  },
  plain: { backgroundColor: 'transparent', borderWidth: 0 },
  inert: { opacity: 0.35 },
});
