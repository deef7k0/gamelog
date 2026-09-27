import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Radius } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';

/** Edge of a round action. Past both tap floors. */
export const ROUND_ACTION = 48;

/**
 * A round control beside the title of the one game a screen is about.
 *
 * Not `<IconButton>`: that primitive is a `Radius.control` rounded rectangle
 * with a hairline edge, which is the app's shape for a control in a toolbar or a
 * form. These are transport keys for the artwork above them — the same argument
 * `<Button shape="pill">` makes on the game page — and the circle is what says
 * so.
 *
 * **Two screens have them, in pairs, and nowhere else**: Surprise Me (bookmark
 * and skip) and a review (like and share). Both are one game's square art with
 * its title underneath; a circle anywhere else would be a fourth control shape.
 */
export function RoundAction({
  icon,
  label,
  onPress,
  selected = false,
  busy = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  selected?: boolean;
  busy?: boolean;
}) {
  const accent = useAccent();
  const theme = useTheme();

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, busy, disabled: busy }}
      disabled={busy}
      onPress={onPress}
      scaleTo={0.9}
      style={StyleSheet.flatten([
        styles.round,
        busy && styles.busy,
        {
          /* M3's filled-tonal → filled pair, the same one the game page's action
             row uses. A saved bookmark or a like is a *state*, so it lights; skip
             and share are acts and stay tonal however many times they are
             pressed. */
          backgroundColor: selected ? accent.m3.primaryContainer : accent.m3.surfaceContainerHigh,
        },
      ])}>
      <Ionicons
        name={icon}
        size={22}
        /* Measured against the fill directly behind it rather than against the
           page — the fill is the only thing under the glyph. */
        color={selected ? accent.m3.onPrimaryContainer : theme.text}
      />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  /* Circular, and the one shape in the app allowed to be: these are the
     transport controls for the card above them, not form buttons, and the round
     key is what the reference — and every music player — uses to say so. */
  round: {
    width: ROUND_ACTION,
    height: ROUND_ACTION,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  busy: { opacity: 0.5 },
});
