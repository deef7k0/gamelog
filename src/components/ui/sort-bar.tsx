import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Elevation, Radius, Spacing, TapTarget } from '@/constants/theme';
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
            <Text variant="caption" color={active ? 'text' : 'textSecondary'}>
              {option.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  /* `x12` (8), not `x8` (6): Material asks for 8dp between adjacent touch
     targets, and this row wraps — two rows of pills at 6dp put the gap below
     the floor in the one axis where a mis-tap picks a different sort order
     rather than a neighbouring one. */
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.x12 },
  pill: {
    ...Elevation.control,
    /*
     * The floor, read from the token rather than restated.
     *
     * These pills used to be exactly their content: `Spacing.x8` (6) twice plus
     * `Type.caption`'s 13dp line box, which is **25.67dp** — 58% of the iOS
     * floor and 53% of Android's. `theme.ts` warns that a hard-coded 44 in a
     * component is the bug `TapTarget` exists to prevent; this was the same bug
     * one rung lower, a primitive that never read the constant at all, and six
     * screens inherited it.
     *
     * `minHeight`, not `height`: a long label at a large system font size still
     * has to be allowed to grow. The padding stays for that case — it is what
     * sizes the pill once the text outgrows the floor.
     *
     * Vertical centring is already `alignItems` on the row's children by way of
     * the text being the only child; `justifyContent` centres it in the taller
     * box now that the box is taller than the text.
     */
    minHeight: TapTarget,
    justifyContent: 'center',
    paddingVertical: Spacing.x8,
    /* `x16` (10), up from `x12` (8). Same reason the chips moved: at 25dp tall
       a short label like "Any" or "90+" was still wider than high, and at 44 it
       is not. Ten each side keeps the four rating pills reading as a row of
       words rather than a row of squares. */
    paddingHorizontal: Spacing.x16,
    // `control`, not `pill` — these are buttons, and every button in the app is
    // the same rounded rectangle.
    borderRadius: Radius.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
