import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { TapTarget, withAlpha } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
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
 * A round button holding one glyph — close, more, add, remove, up, down.
 *
 * A circle, because a glyph with no word beside it is the music player's
 * transport key rather than a form button: the same resting surface and 1px edge
 * as a secondary `<Button>`, with equal sides and no corners. Drawn at 40 or 32
 * and touched at the platform floor's height — the slop makes up the
 * difference, so a row of these stays light without a thumb missing one.
 *
 * `active` lights it in the accent — wash, edge and glyph — the same three
 * carriers every selected control in the app uses. `plain` exists for icons
 * inside an already-bordered container — a row's up/down/remove controls —
 * where a second outline around each glyph would turn a tidy row into a grid of
 * circles.
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
  const accent = useAccent();
  const { box, glyph } = SIZES[size];
  /* Vertical only. These sit in rows — up, down, remove — and sideways slop
     would overlap a neighbour and hand its tap to whichever was drawn last. */
  const slop = Math.max(0, (TapTarget - box) / 2);
  const hitSlop = { top: slop, bottom: slop };

  const plain = tone === 'plain';
  const danger = tone === 'danger';

  const color = disabled
    ? theme.textMuted
    : danger
      ? theme.danger
      : active
        ? accent.onSurface
        : plain
          ? theme.textSecondary
          : theme.text;

  const fill = plain ? 'transparent' : active ? accent.wash : theme.surfaceElevated;
  const edge = plain
    ? 'transparent'
    : danger
      ? withAlpha(theme.danger, 0.3)
      : active
        ? accent.edge
        : theme.border;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected: active }}
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}
      scaleTo={0.9}
      pressedColor={plain ? theme.pressed : active ? accent.ring : theme.surfaceSelected}
      focusRing={accent.ring}
      style={StyleSheet.flatten([
        styles.base,
        { width: box, height: box, borderRadius: box / 2 },
        { backgroundColor: fill, borderColor: edge },
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
    borderWidth: 1,
  },
  /* The glyph goes to `textMuted` as well, so a disabled key is not told apart
     by opacity alone. */
  inert: { opacity: 0.6 },
});
