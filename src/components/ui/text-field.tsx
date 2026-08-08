import Ionicons from '@expo/vector-icons/Ionicons';
import { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type TextFieldProps = TextInputProps & {
  label?: string;
  /** Shown below the field in the danger colour; also flags the outline. */
  error?: string | null;
  hint?: string;
  /** Leading glyph inside the field — a magnifier on a search bar. */
  icon?: keyof typeof Ionicons.glyphMap;
  /**
   * `search` is the tall pill: 56px, fully rounded ends, no outline. Used where
   * the field *is* the screen's primary control rather than one row of a form.
   */
  variant?: 'field' | 'search';
};

/**
 * A filled input. No outline unless it is in error.
 *
 * The fill is `input` (#202020), which is *darker* than a card — an input is a
 * well you type into, not an object sitting on the page, and inverting that
 * relationship is what makes a form read as a form.
 */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, hint, icon, variant = 'field', style, multiline, ...rest },
  ref
) {
  const theme = useTheme();
  const search = variant === 'search';

  const field = (
    <TextInput
      ref={ref}
      placeholderTextColor={theme.textMuted}
      multiline={multiline}
      style={[
        styles.input,
        search && styles.search,
        multiline && styles.multiline,
        icon != null && styles.withIcon,
        { color: theme.text },
        style,
      ]}
      {...rest}
    />
  );

  return (
    <View style={styles.wrapper}>
      {label && <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>}

      <View
        style={[
          styles.shell,
          search && styles.shellSearch,
          {
            backgroundColor: theme.input,
            borderColor: error ? theme.danger : 'transparent',
            borderWidth: error ? 1 : 0,
          },
        ]}>
        {icon && <Ionicons name={icon} size={20} color={theme.textMuted} style={styles.icon} />}
        {field}
      </View>

      {(error || hint) && (
        <Text style={[styles.footnote, { color: error ? theme.danger : theme.textMuted }]}>
          {error ?? hint}
        </Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.x8 },
  label: { fontSize: 13, fontFamily: FontFamily.medium },
  shell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.input,
    overflow: 'hidden',
  },
  shellSearch: { height: 56 },
  icon: { paddingLeft: Spacing.x16 },
  input: {
    flex: 1,
    paddingHorizontal: Spacing.x16,
    paddingVertical: Spacing.x12,
    fontSize: 15,
    fontFamily: FontFamily.regular,
    minHeight: 48,
  },
  /* Vertically centred rather than top-padded: a 56px bar with a single line of
     text in it should have that line on its midline. */
  search: { paddingVertical: 0, minHeight: 56 },
  withIcon: { paddingLeft: Spacing.x12 },
  multiline: {
    minHeight: 120,
    textAlignVertical: 'top',
    paddingTop: Spacing.x12,
  },
  footnote: { fontSize: 13, fontFamily: FontFamily.regular },
});
