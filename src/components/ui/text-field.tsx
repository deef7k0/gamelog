import Ionicons from '@expo/vector-icons/Ionicons';
import { forwardRef, useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Text } from '@/components/ui/text';
import { ControlHeight, Radius, Spacing, TapTarget, Type } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
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
   * `search` is the pill: fully rounded ends, the same 48dp as a field. Used
   * where the field *is* the screen's primary control rather than one row of a
   * form.
   */
  variant?: 'field' | 'search';
};

/** The focus ring's width, outside the field's own edge — `PressableScale`'s. */
const RING_WIDTH = 3;

/**
 * A text field: a label above, and a recessed well with a 1px edge.
 *
 * The fill is `input`, *darker* than a card — a field is a well you type into,
 * not an object sitting on the page — and on the page itself, where the two
 * fills are nearly the same, the edge is what draws it. The corner is
 * `Radius.input`, squarer than a button's, so a field and the button that
 * submits it read as two kinds of object; a text area takes the rounder
 * `inputArea` because it is taller, and the search bar is a pill.
 *
 * **Focus is lit in the accent**: the edge goes to `accent.edge` and a 3dp ring
 * in `accent.ring` appears outside it, so the field you are typing into is
 * never in doubt. An error wins over focus — the edge stays red while you fix
 * it, because the message under the field is still true until you have.
 */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  {
    label,
    error,
    hint,
    icon,
    trailing,
    variant = 'field',
    style,
    multiline,
    editable,
    onFocus,
    onBlur,
    ...rest
  },
  ref
) {
  const theme = useTheme();
  const accent = useAccent();
  const [focused, setFocused] = useState(false);
  const search = variant === 'search';
  const disabled = editable === false;

  const edge = error ? theme.danger : focused ? accent.edge : theme.border;

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
      selectionColor={accent.onSurface}
      cursorColor={accent.onSurface}
      multiline={multiline}
      editable={editable}
      accessibilityLabel={label ?? rest.placeholder}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={[
        styles.input,
        search && styles.search,
        multiline && styles.multiline,
        icon != null && styles.withIcon,
        { color: disabled ? theme.textMuted : theme.text },
        style,
      ]}
      {...rest}
    />
  );

  return (
    <View style={styles.wrapper}>
      {label && (
        <Text variant="fieldLabel" color={disabled ? 'textSecondary' : 'text'}>
          {label}
        </Text>
      )}

      <View
        style={[
          styles.shell,
          search && styles.shellSearch,
          multiline && styles.shellArea,
          {
            backgroundColor: theme.input,
            borderColor: edge,
          },
          focused && !error
            ? {
                outlineColor: accent.ring,
                outlineWidth: RING_WIDTH,
                outlineStyle: 'solid',
                outlineOffset: 0,
              }
            : null,
        ]}>
        {icon && <Ionicons name={icon} size={18} color={theme.textMuted} style={styles.icon} />}
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
  /* `x12` (8) between the label, the well and the hint: close enough that the
     three read as one field, far enough that the label is not the well's lid. */
  wrapper: { gap: Spacing.x12 },
  /* No shadow: an input is a recess, and a recess does not cast. The 1px edge
     is always drawn — transparent is never used — so focusing a field changes
     its colour and never its size. */
  shell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.input,
    borderWidth: 1,
  },
  shellSearch: { borderRadius: Radius.pill, minHeight: ControlHeight.medium },
  shellArea: { borderRadius: Radius.inputArea, alignItems: 'stretch' },
  icon: { paddingLeft: Spacing.x24 },
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
    paddingHorizontal: Spacing.x24,
    paddingVertical: Spacing.x12,
    /* `fieldText` carries no `lineHeight`, deliberately: on Android a
       lineHeight on a TextInput clips descenders and fights the vertical
       centring the min-height is doing. The border's 2dp come off the floor so
       the whole field is `ControlHeight.medium`, not two more. */
    ...Type.fieldText,
    minHeight: ControlHeight.medium - 2,
  },
  /* Vertically centred rather than top-padded: a pill with a single line of
     text in it should have that line on its midline. */
  search: { paddingVertical: 0 },
  withIcon: { paddingLeft: Spacing.x12 },
  multiline: {
    minHeight: 120,
    textAlignVertical: 'top',
    paddingTop: Spacing.x16,
    paddingBottom: Spacing.x16,
  },
});
