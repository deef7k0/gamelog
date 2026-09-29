import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Radius, Spacing, TapTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * What stands in for a review whose author flagged it as spoiling something.
 *
 * ## It is a door, not a lid
 *
 * The obvious build is a tap-to-reveal: blur the text, uncover it in place. This
 * deliberately does not do that, and the reason is where the decision gets made.
 * A card in a feed is somewhere you are *scrolling past*; revealing there puts
 * the spoiler on a surface the reader is still moving through, next to four
 * other games they have not decided about. So the notice navigates to the
 * review's own page instead — the screen that exists to be read, where the
 * reader has arrived on purpose and nothing else is competing.
 *
 * The one exception is that page itself. There is nowhere further to send
 * somebody standing on the destination, so `onPress` there uncovers the prose
 * and the notice is the last thing they tap before reading it. See
 * `app/review/[id].tsx`.
 *
 * ## Why it fills the space the writing had
 *
 * A one-line warning would let the card shrink, which makes a flagged review
 * visibly *smaller* than an unflagged one — and in a list that reads as "this
 * one has less to say" rather than "this one is covered". `minHeight` holds
 * roughly the room the clamped excerpt would have taken, so a feed keeps its
 * rhythm and the notice reads as a panel over something rather than as a stub.
 *
 * ## The colour
 *
 * `danger`, aliased rather than invented — it already means "read this before
 * you act", which is exactly the claim. The eye-off glyph and the sentence both
 * say it too, so nothing here rests on hue alone.
 */
export function SpoilerNotice({
  onPress,
  /** Roughly the height the prose it replaces would have occupied. */
  minHeight = 96,
  label = 'This review contains spoilers',
  /** What a screen reader is told will happen. The two surfaces differ. */
  hint = 'Opens the full review',
}: {
  onPress: () => void;
  minHeight?: number;
  label?: string;
  hint?: string;
}) {
  const theme = useTheme();

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      scaleTo={0.99}
      pressedColor={theme.controlPressed}
      style={StyleSheet.flatten([styles.box, { minHeight, backgroundColor: theme.controlFill }])}>
      <Ionicons name="eye-off-outline" size={22} color={theme.danger} />
      <Text variant="bodySmall" color="textSecondary" style={styles.label}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  /*
   * Centred on both axes, which is what makes it read as a cover rather than as
   * a paragraph: running text starts at the left edge, and this deliberately
   * does not. `TapTarget` is the floor even when `minHeight` is passed something
   * smaller, so the control is never below the platform minimum.
   */
  box: {
    minHeight: TapTarget,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.x8,
    padding: Spacing.x16,
    borderRadius: Radius.card,
  },
  label: { textAlign: 'center' },
});
