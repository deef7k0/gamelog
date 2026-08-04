import { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type TextFieldProps = TextInputProps & {
  label?: string;
  /** Shown below the field in the danger colour; also flags the border. */
  error?: string | null;
  hint?: string;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, hint, style, multiline, ...rest },
  ref
) {
  const theme = useTheme();

  return (
    <View style={styles.wrapper}>
      {label && <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>}

      <TextInput
        ref={ref}
        placeholderTextColor={theme.textMuted}
        multiline={multiline}
        style={[
          styles.input,
          multiline && styles.multiline,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: error ? theme.danger : theme.border,
            color: theme.text,
          },
          style,
        ]}
        {...rest}
      />

      {(error || hint) && (
        <Text style={[styles.footnote, { color: error ? theme.danger : theme.textMuted }]}>
          {error ?? hint}
        </Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.two },
  label: { fontSize: 13, fontFamily: FontFamily.semibold },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three - 2,
    fontSize: 16,
    minHeight: 48,
  },
  multiline: {
    minHeight: 120,
    textAlignVertical: 'top',
    paddingTop: Spacing.three - 2,
  },
  footnote: { fontSize: 13 },
});
