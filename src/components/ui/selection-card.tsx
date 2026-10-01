import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { useSelectable } from '@/components/ui/selectable';
import { RadioMark, RADIO_SIZE } from '@/components/ui/selection-marks';
import { Text } from '@/components/ui/text';
import { Radius, Spacing, TapTarget } from '@/constants/theme';

/** The radio on a `compact` row: small enough for a list, still clearly a mark. */
const COMPACT_RADIO = 26;

export type SelectionCardProps = {
  title: string;
  /** A sentence under the title — what the choice means. */
  hint?: string | null;
  selected: boolean;
  onPress: () => void;
  /**
   * `radio` (the default) for one-of-many. `checkbox` for a card that toggles
   * on its own.
   */
  role?: 'radio' | 'checkbox';
  /** Something the title carries before it — a status glyph, a platform mark. */
  leading?: ReactNode;
  /** Something at the trailing edge — a "SAVED" tag, a count. */
  trailing?: ReactNode;
  /**
   * `card` (the default) is outlined at rest, as the reference's options are.
   * `row` is bare until chosen — for a long picker, where thirty outlined cards
   * stacked would be a wall of boxes around the words.
   */
  frame?: 'card' | 'row';
  /** A single line and a smaller circle, for a picker's rows. */
  compact?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

/**
 * One choice, drawn as the owner's reference draws it — SimpMusic's Server
 * options, taken from its code rather than traced from a screenshot:
 *
 *  - a row, `Radius.card` (16) corners, 15dp of padding and 13 between parts;
 *  - **the circle first**, 34dp, on the leading edge (`<RadioMark>`);
 *  - the name in `optionTitle`, and what it means under it in `bodySmall`;
 *  - at rest, only an outline; chosen, the accent's wash inside and its edge
 *    around, the name up to full strength — the app's one selected state
 *    (`useSelectable`).
 *
 * The one implementation for every single-choice list with words to it: a
 * report's reasons, a copy's condition, a collection's type, the progress
 * choices, a release, a select field's options. A new one uses this.
 */
export function SelectionCard({
  title,
  hint,
  selected,
  onPress,
  role = 'radio',
  leading,
  trailing,
  frame = 'card',
  compact = false,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
}: SelectionCardProps) {
  const look = useSelectable()(selected);
  const bare = frame === 'row' && !selected;

  return (
    <PressableScale
      accessibilityRole={role}
      accessibilityState={
        role === 'radio' ? { selected, disabled } : { checked: selected, disabled }
      }
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint ?? hint ?? undefined}
      disabled={disabled}
      onPress={onPress}
      scaleTo={0.985}
      pressedColor={look.pressedColor}
      focusRing={look.focusRing}
      style={StyleSheet.flatten([
        styles.card,
        compact && styles.compact,
        bare ? { backgroundColor: 'transparent', borderColor: 'transparent' } : look.style,
        disabled && styles.disabled,
      ])}>
      <RadioMark on={selected} size={compact ? COMPACT_RADIO : RADIO_SIZE} />

      <View style={styles.text}>
        <View style={styles.titleRow}>
          {leading}
          <Text
            variant="optionTitle"
            color={look.label}
            numberOfLines={compact ? 1 : 2}
            style={styles.title}>
            {title}
          </Text>
        </View>
        {hint ? (
          /* `textSecondary`, never `textMuted`: the quiet step is under AA on
             an accent-washed card, and this has to be read to be chosen. */
          <Text variant="bodySmall" color="textSecondary">
            {hint}
          </Text>
        ) : null}
      </View>

      {trailing}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    padding: Spacing.x16,
    borderRadius: Radius.card,
    borderWidth: 1,
  },
  /* A picker row: a line of text, a smaller circle, still past the tap floor. */
  compact: {
    minHeight: TapTarget + Spacing.x8,
    paddingVertical: Spacing.x8,
    gap: Spacing.x12,
  },
  text: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  title: { flexShrink: 1 },
  disabled: { opacity: 0.45 },
});
