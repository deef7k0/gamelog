import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { useSelectable } from '@/components/ui/selectable';
import { Text } from '@/components/ui/text';
import { ControlHeight, Elevation, Radius, Spacing, TapTarget, Type } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';

export type SelectOption = {
  value: string;
  label: string;
  /** Optional leading glyph, drawn at the option's own tint. */
  icon?: keyof typeof Ionicons.glyphMap;
  tint?: string;
  /** Marks a value that is not in the canonical set — see `<SelectField>`. */
  foreign?: boolean;
};

export type SelectFieldProps = {
  label?: string;
  /** The current value, or empty for none. */
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** Shown when nothing is chosen. */
  placeholder?: string;
  /** Title of the sheet. Defaults to `label`. */
  sheetTitle?: string;
  hint?: string;
  /** Offer a "Clear" row. On by default — most fields of this kind are optional. */
  clearable?: boolean;
};

/**
 * A field you choose from, not one you type into.
 *
 * Built because free text was letting a record say anything: "Played on" was a
 * `<TextField>`, so a log could claim a platform the game never shipped on, or a
 * word that is not a platform at all. Those strings are read back on the case's
 * printed back and in every feed row, where a typo is indistinguishable from a
 * fact.
 *
 * A sheet rather than the app's usual row of pills for one reason: this control
 * lives in a two-column row beside "Hours played", where a wrapping pill row
 * would blow the column apart, and it has to hold up to seven platforms plus a
 * legacy value.
 *
 * The field is a `<TextField>`'s twin — same label, same recessed well, same
 * edge and corner — with a chevron where the typing would be, so a form reads
 * as one set of fields whichever kind each one is. The sheet is the app's menu
 * surface: rounded top, hairline edge, rows that light in the accent (wash,
 * edge and a check) when chosen.
 */
export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select',
  sheetTitle,
  hint,
  clearable = true,
}: SelectFieldProps) {
  const theme = useTheme();
  const accent = useAccent();
  const selectable = useSelectable();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const selected = options.find((option) => option.value === value) ?? null;

  function choose(next: string) {
    onChange(next);
    setOpen(false);
  }

  return (
    <View style={styles.wrapper}>
      {label && <Text variant="fieldLabel">{label}</Text>}

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${label ?? 'Select'}. ${selected?.label ?? 'Not set'}`}
        accessibilityHint="Opens a list of choices"
        onPress={() => setOpen(true)}
        scaleTo={0.98}
        pressedColor={theme.surface}
        focusRing={accent.ring}
        style={StyleSheet.flatten([
          styles.shell,
          /* The sheet is this field's focus: while it is open, the edge says
             which field it belongs to. */
          { backgroundColor: theme.input, borderColor: open ? accent.edge : theme.border },
        ])}>
        {selected?.icon && (
          <Ionicons name={selected.icon} size={16} color={selected.tint ?? theme.textSecondary} />
        )}
        <Text
          variant="fieldText"
          numberOfLines={1}
          style={[styles.value, { color: selected ? theme.text : theme.textMuted }]}>
          {selected?.label ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={theme.textSecondary} />
      </PressableScale>

      {hint && (
        <Text variant="bodySmall" color="textMuted">
          {hint}
        </Text>
      )}

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent>
        {/* Tapping the scrim closes, which is the gesture every sheet in every
            app on the phone already answers to. */}
        <Pressable
          style={[styles.scrim, { backgroundColor: theme.scrim }]}
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => setOpen(false)}
        />

        <View
          style={[
            styles.sheet,
            Elevation.overlay,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              paddingBottom: insets.bottom + Spacing.x16,
            },
          ]}>
          <View style={[styles.grabber, { backgroundColor: theme.borderStrong }]} />

          <Text variant="h4" style={styles.sheetTitle}>
            {sheetTitle ?? label ?? 'Select'}
          </Text>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}>
            {options.map((option) => {
              const isSelected = option.value === value;
              const look = selectable(isSelected);
              return (
                <PressableScale
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => choose(option.value)}
                  scaleTo={0.99}
                  pressedColor={look.pressedColor}
                  focusRing={look.focusRing}
                  style={StyleSheet.flatten([styles.option, look.style])}>
                  {option.icon && (
                    <Ionicons
                      name={option.icon}
                      size={18}
                      color={option.tint ?? (isSelected ? theme.text : theme.textSecondary)}
                    />
                  )}
                  <Text
                    variant="body"
                    color={look.label}
                    numberOfLines={1}
                    style={styles.optionLabel}>
                    {option.label}
                  </Text>

                  {/* A value carried in from an older, unconstrained record.
                      Kept and marked rather than dropped: silently deleting
                      what someone typed is the one outcome worse than a typo. */}
                  {option.foreign && (
                    <Text variant="caption" color="textSecondary">
                      SAVED
                    </Text>
                  )}

                  {isSelected && <Ionicons name="checkmark" size={18} color={accent.onSurface} />}
                </PressableScale>
              );
            })}

            {clearable && value !== '' && (
              <PressableScale
                accessibilityRole="button"
                onPress={() => choose('')}
                scaleTo={0.99}
                pressedColor={theme.pressed}
                focusRing={accent.ring}
                style={StyleSheet.flatten([
                  styles.option,
                  styles.clear,
                  { borderColor: theme.border },
                ])}>
                <Ionicons name="close" size={18} color={theme.textMuted} />
                <Text variant="body" color="textMuted" style={styles.optionLabel}>
                  Clear
                </Text>
              </PressableScale>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  /* The same rhythm as `<TextField>`, so the two sit in one row without their
     labels or their wells disagreeing by a pixel. */
  wrapper: { gap: Spacing.x12 },
  shell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    minHeight: ControlHeight.medium,
    paddingHorizontal: Spacing.x24,
    paddingVertical: Spacing.x12,
    borderRadius: Radius.input,
    borderWidth: 1,
  },
  value: { flex: 1 },

  scrim: { flex: 1 },
  /* The menu surface: rounded top, hairline edge on the three sides that meet
     the page. */
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    paddingHorizontal: Spacing.x16,
    paddingTop: Spacing.x12,
    gap: Spacing.x12,
    /* Never taller than half the screen: this is a short list attached to one
       field, and a sheet that fills the display reads as a new screen. */
    maxHeight: '55%',
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: Radius.pill,
  },
  sheetTitle: { ...Type.h4 },
  list: { flexGrow: 0 },
  listContent: { gap: Spacing.x8, paddingBottom: Spacing.x8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    minHeight: TapTarget,
    paddingHorizontal: Spacing.x24,
    paddingVertical: Spacing.x12,
    borderRadius: Radius.card,
    borderWidth: 1,
  },
  optionLabel: { flex: 1 },
  clear: { backgroundColor: 'transparent' },
});
