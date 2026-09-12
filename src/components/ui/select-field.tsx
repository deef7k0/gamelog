import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Elevation, Radius, Spacing, TapTarget, Type } from '@/constants/theme';
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
 * legacy value. Selection still follows the house rule — one surface step
 * lighter, a stronger edge and brighter ink, never a colour.
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
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const selected = options.find((option) => option.value === value) ?? null;

  function choose(next: string) {
    onChange(next);
    setOpen(false);
  }

  return (
    <View style={styles.wrapper}>
      {label && (
        <Text variant="bodySmall" color="textSecondary">
          {label}
        </Text>
      )}

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${label ?? 'Select'}. ${selected?.label ?? 'Not set'}`}
        accessibilityHint="Opens a list of choices"
        onPress={() => setOpen(true)}
        scaleTo={0.98}
        style={StyleSheet.flatten([
          styles.shell,
          Elevation.card,
          { backgroundColor: theme.input },
        ])}>
        {selected?.icon && (
          <Ionicons name={selected.icon} size={16} color={selected.tint ?? theme.textSecondary} />
        )}
        <Text
          variant="body"
          numberOfLines={1}
          style={[styles.value, { color: selected ? theme.text : theme.textMuted }]}>
          {selected?.label ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={theme.textMuted} />
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
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => choose(option.value)}
                  style={[
                    styles.option,
                    {
                      backgroundColor: isSelected ? theme.surfaceSelected : theme.surfaceElevated,
                      borderColor: isSelected ? theme.borderStrong : theme.border,
                    },
                  ]}>
                  {option.icon && (
                    <Ionicons
                      name={option.icon}
                      size={18}
                      color={option.tint ?? (isSelected ? theme.text : theme.textSecondary)}
                    />
                  )}
                  <Text
                    variant="body"
                    numberOfLines={1}
                    style={[
                      styles.optionLabel,
                      { color: isSelected ? theme.text : theme.textSecondary },
                    ]}>
                    {option.label}
                  </Text>

                  {/* A value carried in from an older, unconstrained record.
                      Kept and marked rather than dropped: silently deleting
                      what someone typed is the one outcome worse than a typo. */}
                  {option.foreign && (
                    <Text variant="caption" color="textMuted">
                      SAVED
                    </Text>
                  )}

                  {isSelected && <Ionicons name="checkmark" size={18} color={theme.text} />}
                </Pressable>
              );
            })}

            {clearable && value !== '' && (
              <Pressable
                accessibilityRole="button"
                onPress={() => choose('')}
                style={[styles.option, styles.clear, { borderColor: theme.border }]}>
                <Ionicons name="close" size={18} color={theme.textMuted} />
                <Text variant="body" color="textMuted" style={styles.optionLabel}>
                  Clear
                </Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.x8 },
  shell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    minHeight: TapTarget,
    paddingHorizontal: Spacing.x16,
    paddingVertical: Spacing.x12,
    borderRadius: Radius.input,
  },
  value: { flex: 1 },

  scrim: { flex: 1 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
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
    paddingHorizontal: Spacing.x16,
    paddingVertical: Spacing.x12,
    borderRadius: Radius.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
  optionLabel: { flex: 1 },
  clear: { backgroundColor: 'transparent' },
});
