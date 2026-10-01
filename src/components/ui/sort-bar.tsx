import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { useSelectable } from '@/components/ui/selectable';
import { Text } from '@/components/ui/text';
import {
  ControlHeight,
  Radius,
  SmallControlRowGap,
  SmallControlSlop,
  Spacing,
} from '@/constants/theme';

export type SortOption<T extends string> = { key: T; label: string };

export type SortBarProps<T extends string> = {
  options: readonly SortOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Announced to screen readers; the pills alone do not say what they sort. */
  accessibilityLabel?: string;
};

/**
 * A row of sort or filter pills, one selected.
 *
 * Wraps rather than scrolls horizontally. Every option stays on screen, so the
 * set of ways a list can be ordered is visible without discovering that the row
 * scrolls — and with four or five short labels it almost always fits on one
 * line anyway.
 *
 * The selected pill takes the app's one selected state (`useSelectable`) — the
 * accent's wash, the accent's edge, the label at full strength — so it is
 * blue on the Search tab and the game's own colour on its reviews sheet.
 * Unselected pills are the resting control surface, quiet enough that five of
 * them never out-shout the grid of cover art they are sorting.
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
  const selectable = useSelectable();

  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const active = option.key === value;
        const look = selectable(active);
        return (
          <PressableScale
            key={option.key}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.key)}
            scaleTo={0.94}
            hitSlop={SmallControlSlop}
            pressedColor={look.pressedColor}
            focusRing={look.focusRing}
            style={StyleSheet.flatten([styles.pill, look.style])}>
            <Text variant="bodySmall" color={look.label}>
              {option.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  /* Columns `x8` (8): Material asks for 8dp between adjacent touch targets.
     Rows `SmallControlRowGap` — exactly the two slops that meet across the gap,
     so when the row wraps, the touch boxes of two rows tile rather than
     overlap, and a tap between them can never pick the wrong sort order. */
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.x8,
    rowGap: SmallControlRowGap,
  },
  pill: {
    /*
     * Drawn at `ControlHeight.small` (36) and touched at the platform floor.
     *
     * These pills were once exactly their content — 25.67dp, 58% of the iOS
     * floor — and then grew to the full floor, which made a filter row a stack
     * of 48dp slabs around 10px words. `SmallControlSlop` is the third answer:
     * the drawn pill stays light and the touch box still reaches 44/48.
     * `minHeight`, not `height`, so a large system font can still grow it.
     */
    minHeight: ControlHeight.small,
    justifyContent: 'center',
    paddingVertical: Spacing.x4,
    paddingHorizontal: Spacing.x16,
    /* A pill: this filters, and filters are the pill family (DESIGN.md § 9). */
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
});
