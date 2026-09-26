import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Radius, Spacing, TapTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type Choice<T extends string> = {
  value: T;
  label: string;
  /** Read out after the label; shown under it when `withHints` is set. */
  hint?: string;
};

export type ChoiceChipsProps<T extends string> = {
  label: string;
  choices: readonly Choice<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
  /** Tapping the chosen one clears it. On by default: these are optional facts. */
  clearable?: boolean;
  /** Print each hint under its label — for scales whose words need defining. */
  withHints?: boolean;
};

/**
 * One choice from a short, fixed vocabulary, as a wrapping row of controls.
 *
 * For the forms that describe a copy or a release — completeness, condition,
 * region, photo kind — where every choice should be visible at once, which a
 * `<SelectField>` sheet would hide behind a tap. Selection follows the app's
 * rule (CLAUDE.md): one surface step lighter and the stronger edge, never a hue,
 * because none of these values is data with a colour of its own.
 *
 * Rounded rectangles, not pills: these are controls, and the pill is kept for
 * metadata you cannot press.
 */
export function ChoiceChips<T extends string>({
  label,
  choices,
  value,
  onChange,
  clearable = true,
  withHints = false,
}: ChoiceChipsProps<T>) {
  const theme = useTheme();

  return (
    <View style={styles.field}>
      <Text variant="label" color="textMuted" accessibilityRole="header">
        {label}
      </Text>
      <View style={styles.row} accessibilityRole="radiogroup">
        {choices.map((choice) => {
          const selected = value === choice.value;
          return (
            <PressableScale
              key={choice.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={choice.label}
              accessibilityHint={choice.hint}
              onPress={() => onChange(selected && clearable ? null : choice.value)}
              scaleTo={0.96}
              style={StyleSheet.flatten([
                styles.chip,
                withHints && styles.chipWide,
                {
                  backgroundColor: selected ? theme.surfaceSelected : theme.surfaceElevated,
                  borderColor: selected ? theme.borderStrong : theme.border,
                },
              ])}>
              <Text variant="bodySmall" color={selected ? 'text' : 'textSecondary'}>
                {choice.label}
              </Text>
              {withHints && choice.hint && (
                <Text variant="caption" color="textMuted">
                  {choice.hint}
                </Text>
              )}
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.x8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.x8 },
  chip: {
    justifyContent: 'center',
    minHeight: TapTarget,
    paddingHorizontal: Spacing.x12,
    paddingVertical: Spacing.x4,
    borderRadius: Radius.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
  /* Two per row, so a hint has room to be a sentence rather than a fragment. */
  chipWide: { flexBasis: '47%', flexGrow: 1, paddingVertical: Spacing.x8, gap: 1 },
  unavailable: { opacity: 0.45 },
});

export type MultiChoiceChipsProps<T extends string> = {
  label: string;
  choices: readonly Choice<T>[];
  value: readonly T[];
  onChange: (value: T[]) => void;
  /** The most that can be on at once. Further taps do nothing until one is off. */
  max: number;
};

/**
 * Several choices from a fixed vocabulary, up to a limit — the same object as
 * `<ChoiceChips>`, with checkboxes rather than a radio group.
 *
 * The limit is stated in the label ("2 of 4") rather than discovered by a tap
 * that silently does nothing: once the fourth is on, the rest dim and announce
 * themselves as unavailable, which is the whole explanation a reader needs.
 */
export function MultiChoiceChips<T extends string>({
  label,
  choices,
  value,
  onChange,
  max,
}: MultiChoiceChipsProps<T>) {
  const theme = useTheme();
  const full = value.length >= max;

  return (
    <View style={styles.field}>
      <Text variant="label" color="textMuted" accessibilityRole="header">
        {`${label} · ${value.length} of ${max}`}
      </Text>
      <View style={styles.row}>
        {choices.map((choice) => {
          const selected = value.includes(choice.value);
          const unavailable = full && !selected;
          return (
            <PressableScale
              key={choice.value}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected, disabled: unavailable }}
              accessibilityLabel={choice.label}
              accessibilityHint={unavailable ? `Up to ${max}. Untick one first.` : choice.hint}
              disabled={unavailable}
              onPress={() =>
                onChange(
                  selected
                    ? value.filter((entry) => entry !== choice.value)
                    : [...value, choice.value]
                )
              }
              scaleTo={0.96}
              style={StyleSheet.flatten([
                styles.chip,
                unavailable && styles.unavailable,
                {
                  backgroundColor: selected ? theme.surfaceSelected : theme.surfaceElevated,
                  borderColor: selected ? theme.borderStrong : theme.border,
                },
              ])}>
              <Text variant="bodySmall" color={selected ? 'text' : 'textSecondary'}>
                {choice.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}
