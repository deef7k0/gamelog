import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { Section, SectionCard, type SectionMoreProps } from '@/components/ui/section';

export type InfoCardProps = {
  /**
   * What the section is about, in one or two words.
   *
   * Required, and that is the point of the component. Every section of the game
   * page states its own subject, so the tab reads as a set of answers rather
   * than as a scroll of blocks you have to identify from their contents.
   */
  title: string;
  /** A quiet fact at the right end of the heading — a count, a starting price. */
  action?: ReactNode;
  /** The heading's way onward: the reference's More. */
  more?: SectionMoreProps;
  /** A More that owns what it opens, such as a sheet's trigger. See `<SectionHeader>`. */
  moreSlot?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Drops the card's inner padding, for content that reaches its own edges. */
  padded?: boolean;
};

/**
 * One section of a game's page that is words and figures rather than pictures:
 * a heading, and under it a card holding what the heading names.
 *
 * ## SimpMusic's artist page, where this came from
 *
 * The owner's reference ends on "Description" — a bold white heading over an
 * `ElevatedCard` holding the text — and that is the shape of every section here
 * that has no artwork: the heading stands on the page and the card sits under
 * it (see `<Section>` and `<SectionCard>` for the measurements). A section that
 * *is* artwork — screenshots, a series, the events — has no card at all: its
 * heading sits over a rail of the art (`<ArtRail>`), as "Singles" and "Albums"
 * do. The title used to be inside a `cardLarge` panel of the page's own tone;
 * the heading moved out and the card took the reference's corner and colour.
 *
 * Every screen that uses this is about one game — its page, its additional
 * information, its Similar tab — so all of them changed together.
 */
export function InfoCard({
  title,
  action,
  more,
  moreSlot,
  children,
  style,
  padded = true,
}: InfoCardProps) {
  return (
    <Section title={title} action={action} more={more} moreSlot={moreSlot}>
      <SectionCard padded={padded} style={style}>
        {children}
      </SectionCard>
    </Section>
  );
}

/**
 * The same section when it is a way *somewhere*: your copy, the additional
 * information, the achievements, the community's picks.
 *
 * The heading carries the reference's More, and the card — which says what is
 * there — is the same door, so either is the way in. A separate component
 * rather than a prop so a reader can tell at a glance whether a section opens
 * something, and the accessible role is never conditional.
 */
export function InfoCardButton({
  title,
  action,
  children,
  style,
  accessibilityLabel,
  onPress,
  moreLabel,
}: Omit<InfoCardProps, 'padded' | 'more' | 'moreSlot'> & {
  accessibilityLabel: string;
  onPress: () => void;
  /** The More's word, when the way onward has a name of its own. */
  moreLabel?: string;
}) {
  return (
    <Section title={title} action={action} more={{ label: moreLabel, accessibilityLabel, onPress }}>
      <SectionCard onPress={onPress} accessibilityLabel={accessibilityLabel} style={style}>
        {children}
      </SectionCard>
    </Section>
  );
}
