import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { ROUND_ACTION } from '@/components/ui/round-action';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';

/** How wide a key's column is: room for the longest word under it at one line. */
export const STAGE_KEY_WIDTH = 76;

/**
 * One of the keys under the copy's stage: a round key with its word under it.
 *
 * Each is the keyed twin of a gesture — turn it over, open it, take the disc
 * out — for a thumb that would rather press than drag, and for a screen reader,
 * which cannot drag at all. The round key is `<RoundAction>`'s object, the
 * Material 3 tonal key that a screen about one game puts under its artwork;
 * what differs is the word. A review's two keys are a heart and a share arrow,
 * which need no caption. "Turn over", "Open" and "Take out" are this screen's
 * own verbs and no glyph says them alone.
 *
 * **A key that cannot act now is dimmed, never removed**, so the row does not
 * re-centre under a thumb as the case opens and shuts. A key the copy can never
 * use — "Open" on a cartridge — is simply not drawn; the screen decides that.
 *
 * `selected` is a state the key has put the copy in: open, or disc out. It
 * lights with `primaryContainer`, as a saved bookmark does.
 */
export function StageKey({
  icon,
  word,
  label,
  onPress,
  selected = false,
  disabled = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  /** The word under the key. One or two, short. */
  word: string;
  /** What it does, in full, for a screen reader. */
  label: string;
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
}) {
  const accent = useAccent();
  const theme = useTheme();

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      scaleTo={0.94}
      style={StyleSheet.flatten([styles.key, disabled && styles.dimmed])}>
      <View
        style={[
          styles.round,
          {
            backgroundColor: selected ? accent.m3.primaryContainer : accent.m3.surfaceContainerHigh,
          },
        ]}>
        <Ionicons
          name={icon}
          size={22}
          color={selected ? accent.m3.onPrimaryContainer : theme.text}
        />
      </View>
      <Text variant="caption" numberOfLines={1} style={{ color: accent.quietInk }}>
        {word}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  key: { width: STAGE_KEY_WIDTH, alignItems: 'center', gap: Spacing.x4 + 2 },
  round: {
    width: ROUND_ACTION,
    height: ROUND_ACTION,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimmed: { opacity: 0.38 },
});
