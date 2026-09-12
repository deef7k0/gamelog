import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';

export type InfoCardProps = {
  /**
   * What the panel is about, in one or two words.
   *
   * Required, and that is the point of the component. Every panel on the game
   * page states its own subject, so the tab reads as a set of answers rather
   * than as a scroll of blocks you have to identify from their contents.
   */
  title: string;
  /** Right-hand furniture on the title row — a count, a chevron, a small link. */
  action?: React.ReactNode;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Drops the inner padding, for a card whose content reaches its own edges. */
  padded?: boolean;
};

/**
 * One panel of the game page: a titled card lit by the game's own hue.
 *
 * ## Why it is lighter than the page, not darker
 *
 * The Overview tab runs `<ScrollAmbience>` at full strength, so the page behind
 * these is already the game's colour. Every other grouped surface in this app
 * goes *down* from the page — `surface`, then `surfaceElevated` — because the
 * page is near-black and down is the only direction with room. Here it is the
 * other way round: the card has to lift off a lit backdrop, so it takes
 * `accent.card`, the lightest tinted step, carrying the most hue of the three.
 *
 * That is the opposite of the game page's action keys directly above it, which
 * are `accent.elevated` and read as recessed *into* the page. The two are not
 * inconsistent — a control you press sits down, a panel you read sits up — and
 * the contrast between them is most of what stops the masthead and the tab body
 * reading as one undifferentiated column.
 *
 * ## Why the corner is `cardLarge` and not `card`
 *
 * See `Radius.cardLarge`. The short version: these are panels, not list rows,
 * and a container must not share the corner of the buttons inside it.
 *
 * ## No border, no shadow
 *
 * `Elevation.card` casts against a near-black page and is close to invisible on
 * a lit one; a hairline would be a second edge on a surface that already has a
 * four-step luminance jump to the page. The fill *is* the edge, which is the
 * Material 3 argument for tonal surfaces and the reason the tint has to be as
 * strong as it is.
 */
export function InfoCard({ title, action, children, style, padded = true }: InfoCardProps) {
  const accent = useAccent();

  return (
    <View style={[styles.card, { backgroundColor: accent.card }, padded && styles.padded, style]}>
      <View style={[styles.head, !padded && styles.headInset]}>
        {/* `h4`, not the `h6` this started at. Small, white and bold is the
            brief, and `h6` is 11px with letter-spacing — a form-field caption,
            not a title, and unreadable as the name of a panel you are meant to
            scan past at arm's length. 14px bold is still the smallest heading in
            the scale that reads as a heading. Not `label` for the same reason:
            an all-caps tracked micro-line is a field label. */}
        <Text variant="h4" accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {action}
      </View>
      {children}
    </View>
  );
}

/**
 * The same panel, as one big button.
 *
 * For the cards that are a way *somewhere* rather than a thing to read — the
 * studio catalogues, "More information", "View all achievements". It is a
 * separate component rather than an `onPress` prop on `<InfoCard>` so a reader
 * of either one can tell at a glance whether it is pressable, and so the
 * accessible role is never conditional.
 */
export function InfoCardButton({
  title,
  action,
  children,
  style,
  accessibilityLabel,
  onPress,
}: Omit<InfoCardProps, 'padded'> & {
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const accent = useAccent();

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      scaleTo={0.98}
      style={StyleSheet.flatten([
        styles.card,
        styles.padded,
        { backgroundColor: accent.card },
        style,
      ])}>
      <View style={styles.head}>
        <Text variant="h4" style={styles.title}>
          {title}
        </Text>
        {action}
      </View>
      {children}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.cardLarge,
    gap: Spacing.x12,
    overflow: 'hidden',
  },
  padded: { padding: Spacing.x16 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.x8,
  },
  /* An unpadded card still needs its title inset — the padding was dropped for
     the *content* (a rail that runs to the edge), not for the heading. */
  headInset: { paddingHorizontal: Spacing.x16, paddingTop: Spacing.x16 },
  /* Shrinks rather than pushing a count or a chevron off the row. */
  title: { flexShrink: 1 },
});
