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
   * `search` centres a single line on the field's midline. Same shape and fill
   * as every other field — a search bar is a field you type into.
   */
  variant?: 'field' | 'search';
};

/**
 * The edge a field wears while focused or in error, and the width it is always
 * drawn at — transparent at rest, so focusing a field changes its colour and
 * never its size.
 */
const EDGE = 1.5;

/**
 * A text field: a label above, a hint or error below, and between them a soft
 * grey well with no border.
 *
 * **The owner's reference, measured.** SimpMusic's "Display name" field: 54dp
 * tall, 18dp corners, a fill of its `onSurfaceVariant` at 8% (#0F0F0F on black)
 * and nothing drawn around it — the fill alone is the field. Text areas and the
 * search bar are the same object; a multi-line field just grows.
 *
 * **Focus is the accent's edge**, as the reference marks the box you are typing
 * into, drawn in `accent.onSurface` so it holds on any page. An error wins over
 * focus — the edge stays red while you fix it, because the message under the
 * field is still true until you have.
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

  const edge = error ? theme.danger : focused ? accent.onSurface : 'transparent';

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
          multiline && styles.shellArea,
          { backgroundColor: theme.input, borderColor: edge },
        ]}>
        {icon && <Ionicons name={icon} size={18} color={theme.textMuted} style={styles.icon} />}
        {field}
        {trailing && <View style={styles.trailing}>{trailing}</View>}
      </View>

      {(error || hint) && (
        <Text variant="bodySmall" color={error ? 'danger' : 'textSecondary'}>
          {error ?? hint}
        </Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  /* 8 between the label, the well and the hint — the reference's spacing. */
  wrapper: { gap: Spacing.x12 },
  /* No shadow and no resting border: the fill is the whole field. The edge is
     always there at `EDGE` and only its colour changes. */
  shell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.input,
    borderWidth: EDGE,
  },
  shellArea: { alignItems: 'stretch' },
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
       centring the min-height is doing. The edge's two widths come off the
       floor so the whole field is `ControlHeight.field`, not three more. */
    ...Type.fieldText,
    minHeight: ControlHeight.field - EDGE * 2,
  },
  /* Vertically centred rather than top-padded: a single line of text should
     sit on the field's midline. */
  search: { paddingVertical: 0 },
  withIcon: { paddingLeft: Spacing.x12 },
  multiline: {
    minHeight: 120,
    textAlignVertical: 'top',
    paddingTop: Spacing.x20,
    paddingBottom: Spacing.x20,
  },
});
