import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SortOption<T extends string> = { key: T; label: string };

export type SortBarProps<T extends string> = {
  options: readonly SortOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Announced to screen readers; the pills alone do not say what they sort. */
  accessibilityLabel?: string;
};

/**
 * A row of sort pills, one selected.
 *
 * Wraps rather than scrolls horizontally. Every option stays on screen, so the
 * set of ways a list can be ordered is visible without discovering that the row
 * scrolls — and with four or five short labels it almost always fits on one
 * line anyway.
 *
 * `accessibilityRole="radio"` because that is what this is: a single choice
 * from a fixed set, not a set of toggles. Screen readers then read "selected"
 * on the active one instead of leaving five identical unlabelled buttons.
 */
export function SortBar<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel = 'Sort',
}: SortBarProps<T>) {
  const theme = useTheme();

  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const active = option.key === value;
        return (
          <PressableScale
            key={option.key}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.key)}
            scaleTo={0.94}
            style={StyleSheet.flatten([
              styles.pill,
              {
                /*
                 * Selection is a step up in lightness, not a change of colour:
                 * one fill lighter, one border brighter, full-strength label.
                 * Five pills in a row all wearing an accent would out-shout the
                 * grid of cover art they are sorting.
                 */
                backgroundColor: active ? theme.surfaceSelected : theme.surfaceElevated,
                borderColor: active ? theme.borderStrong : theme.border,
              },
            ])}>
            <Text variant="micro" color={active ? 'text' : 'textSecondary'}>
              {option.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.x8 },
  pill: {
    paddingVertical: Spacing.x8,
    paddingHorizontal: Spacing.x12,
    // `control`, not `pill` — these are buttons, and every button in the app is
    // the same rounded rectangle.
    borderRadius: Radius.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
