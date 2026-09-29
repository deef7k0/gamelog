import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { Radius, withAlpha } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';

/** The checkbox's edge. */
const BOX = 20;

/**
 * The radio's diameter — the reference's 34dp, on a selection card. Dense
 * lists pass a smaller `size`; the check scales with it.
 */
export const RADIO_SIZE = 34;

/**
 * The box on a checkbox row. Not pressable on its own: the *row* is the control
 * and carries `accessibilityRole="checkbox"`, and this is its state drawn.
 *
 * Unchecked is an empty rounded square in the strong edge; checked fills with
 * the accent and holds a check in the accent's ink — white on the house blue
 * (5.01:1), near-black on a game's light Material 3 fill. The tick is the
 * carrier that is not a colour.
 */
export function Checkbox({ checked, disabled = false }: { checked: boolean; disabled?: boolean }) {
  const theme = useTheme();
  const accent = useAccent();

  return (
    <View
      style={[
        styles.box,
        checked
          ? { backgroundColor: accent.color, borderColor: accent.color }
          : { backgroundColor: 'transparent', borderColor: theme.borderStrong },
        disabled && styles.disabled,
      ]}>
      {checked && <Ionicons name="checkmark" size={15} color={accent.ink} />}
    </View>
  );
}

/**
 * The circle at the **leading** edge of a single-choice card or row — the
 * owner's reference, SimpMusic's Server options, measured.
 *
 * 34dp. Unchosen, it is an empty ring in the page's own light grey at 22%.
 * Chosen, the ring fills with the accent at 18% and holds a check in the
 * accent — a check rather than a dot, because a dot in a ring is the platform
 * radio and this is a larger, softer mark that reads at arm's length.
 *
 * Drawn in `onSurface`, the accent's legible form, rather than its fill: a
 * check is closer to type than to a fill, and the house blue's fill is only
 * 3.29:1 on a selected card where its type twin is 5.07.
 *
 * Like `<Checkbox>`, a drawing of the state; the row it sits in is the control.
 */
export function RadioMark({
  on,
  disabled = false,
  size = RADIO_SIZE,
}: {
  on: boolean;
  disabled?: boolean;
  size?: number;
}) {
  const theme = useTheme();
  const accent = useAccent();

  return (
    <View
      style={[
        styles.radio,
        { width: size, height: size, borderRadius: size / 2 },
        on
          ? { backgroundColor: withAlpha(accent.onSurface, 0.18), borderColor: 'transparent' }
          : { backgroundColor: 'transparent', borderColor: withAlpha(theme.text, 0.22) },
        disabled && styles.disabled,
      ]}>
      {on && <Ionicons name="checkmark" size={Math.round(size * 0.47)} color={accent.onSurface} />}
    </View>
  );
}

const styles = StyleSheet.create({
  /* `md`: visibly soft on a 20dp box without drifting toward a circle, which is
     the radio's shape — the two marks must not be mistaken for each other. */
  box: {
    width: BOX,
    height: BOX,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radio: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
});
