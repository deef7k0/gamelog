import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';

/** Both marks' edge, so a checkbox and a radio in one form are the same size. */
const MARK = 20;

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
 * The dot on a single-choice row or card — a ring in the strong edge, or the
 * accent's ring holding the accent's dot. Like `<Checkbox>`, a drawing of the
 * state; the row it sits in is the control.
 *
 * Drawn in `onSurface`, the accent's legible form, rather than its fill: a thin
 * ring and a 10dp dot are closer to type than to a fill, and the house blue's
 * fill is only 3.29:1 on a selected card where its type twin is 5.07.
 */
export function RadioMark({ on, disabled = false }: { on: boolean; disabled?: boolean }) {
  const theme = useTheme();
  const accent = useAccent();

  return (
    <View
      style={[
        styles.radio,
        { borderColor: on ? accent.onSurface : theme.borderStrong },
        disabled && styles.disabled,
      ]}>
      {on && <View style={[styles.dot, { backgroundColor: accent.onSurface }]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  /* `md`: visibly soft on a 20dp box without drifting toward a circle, which is
     the radio's shape — the two marks must not be mistaken for each other. */
  box: {
    width: MARK,
    height: MARK,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radio: {
    width: MARK,
    height: MARK,
    borderRadius: MARK / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: MARK / 2, height: MARK / 2, borderRadius: MARK / 4 },
  disabled: { opacity: 0.5 },
});
