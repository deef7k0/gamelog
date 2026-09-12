import Ionicons from '@expo/vector-icons/Ionicons';
import { forwardRef, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Text } from '@/components/ui/text';
import { Elevation, Radius, Spacing, TapTarget, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type TextFieldProps = TextInputProps & {
  label?: string;
  /** Shown below the field in the danger colour; also flags the outline. */
  error?: string | null;
  hint?: string;
  /** Leading glyph inside the field — a magnifier on a search bar. */
  icon?: keyof typeof Ionicons.glyphMap;
  /**
   * A control inside the field's trailing edge — a progress glyph, a clear
   * button.
   *
   * Inside rather than beside, because both of the things that go here are
   * *about the field's own contents*: a spinner beside the input would read as
   * the page loading, and a clear button beside it would read as clearing the
   * form. It also gives Android somewhere to put the affordance iOS gets free
   * from `clearButtonMode`, which does nothing on Android at all.
   */
  trailing?: ReactNode;
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
  { label, error, hint, icon, trailing, variant = 'field', style, multiline, ...rest },
  ref
) {
  const theme = useTheme();
  const search = variant === 'search';

  /*
   * The visible `label` is a *sibling* `<Text>`, and React Native has no
   * `htmlFor` to tie the two together — so a labelled field was announced with
   * no name at all, and a label-less one lost its placeholder as its name the
   * moment it held any text. Falling back through label → placeholder gives
   * every field a name that survives being filled in; an explicit
   * `accessibilityLabel` from the caller still wins.
   */
  const field = (
    <TextInput
      ref={ref}
      placeholderTextColor={theme.textMuted}
      multiline={multiline}
      accessibilityLabel={label ?? rest.placeholder}
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
      {label && (
        <Text variant="bodySmall" color="textSecondary">
          {label}
        </Text>
      )}

      <View
        style={[
          styles.shell,
          /* The gentlest tier, deliberately. An input is a recess you type into,
             so it gets just enough lift to join the layering without pretending
             to float the way a button does. */
          Elevation.card,
          search && styles.shellSearch,
          {
            backgroundColor: theme.input,
            borderColor: error ? theme.danger : 'transparent',
            borderWidth: error ? 1 : 0,
          },
        ]}>
        {icon && <Ionicons name={icon} size={20} color={theme.textMuted} style={styles.icon} />}
        {field}
        {trailing && <View style={styles.trailing}>{trailing}</View>}
      </View>

      {(error || hint) && (
        <Text variant="bodySmall" color={error ? 'danger' : 'textMuted'}>
          {error ?? hint}
        </Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.x8 },
  shell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.input,
    /* No `overflow: 'hidden'` on purpose: it would clip the Android elevation,
       and nothing in here (a glyph and a TextInput, both inset by padding)
       needs clipping to the corner radius. See DESIGN.md § 6.3. */
  },
  shellSearch: { height: 48 },
  icon: { paddingLeft: Spacing.x16 },
  /* Sized to the floor even though its contents are a 20dp glyph: whatever the
     caller puts here is tappable often enough that it must not be the one
     control on the screen a thumb cannot land on. */
  trailing: {
    minWidth: TapTarget,
    minHeight: TapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    paddingHorizontal: Spacing.x16,
    paddingVertical: Spacing.x12,
    /* Size and family only, deliberately no `lineHeight`: on Android a
       lineHeight on a TextInput clips descenders and fights the vertical
       centring the 44/48 min-heights are doing. */
    fontSize: Type.body.fontSize,
    fontFamily: Type.body.fontFamily,
    minHeight: TapTarget,
  },
  /* Vertically centred rather than top-padded: a 48px bar with a single line of
     text in it should have that line on its midline. */
  search: { paddingVertical: 0, minHeight: 48 },
  withIcon: { paddingLeft: Spacing.x12 },
  multiline: {
    minHeight: 104,
    textAlignVertical: 'top',
    paddingTop: Spacing.x12,
  },
});
