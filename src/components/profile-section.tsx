import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Card } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { BOX } from '@/constants/profile-layout';
import { Spacing, TapTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The two shapes a section of the Profile tab takes, both from the owner's
 * reference for the screen — a Letterboxd-style profile, which alternates them:
 *
 * ```
 * ┌ Favourites ───────── Edit ┐     a box: the title inside it, a hairline,
 * │ ─────────────────────────  │     then what it holds
 * │ [▮▮]  [▮▮]  [▮▮]  [▮▮]     │
 * └────────────────────────────┘
 * ┌ Ada's games ──────────── › ┐     a box whose title is the way into the
 * │ ─────────────────────────  │     screen it gives a glimpse of
 * │ ▮▮▮▮▮▮[ ▮▮▮▮▮▮▮ ]▮▮▮▮▮▮   │
 * └────────────────────────────┘
 *
 * Wall                              open: the title on the page, a rule under
 * ─────────────────────────────     it, then what belongs to it
 * ```
 *
 * A box is for what the profile holds whole — the four favourites, the
 * library, the pinned song, each in its own. An open section is for what runs
 * on down the page under its heading: the wall.
 *
 * **The library has a box of its own.** It stood on the page under a heading,
 * a door beside the favourites' box; the owner had it put in a card, and for
 * one pass it shared the favourites' — two sections in one box. The owner saw
 * that and had it "detached": a card each. The shell (`<ProfileBox>`) and what
 * goes in it (`<ProfileBoxSection>`) are still two pieces, because the widgets
 * render their section and the profile decides what is boxed with what.
 *
 * They replaced one shape used three times — a hairline across the top of each
 * widget and a small heading under it — which made the favourites, the shelf
 * and the song read as one list of three rows.
 *
 * **In the app's own materials, as the owner asked** ("the same material 3
 * feeling… adapt all of that into the current app language"). The box is the
 * app's `<Card>`: `surface`, the card corner and the card shadow, where the
 * reference's is a flat slate panel. Its insides are the reference's, measured
 * and then tightened a little for the covers' sake (`BOX`).
 */

/** A box on the Profile tab: the card, round the section it holds. */
export function ProfileBox({ children }: { children: ReactNode }) {
  return (
    /* `padded={false}`: the card's own inset is the app's 15 and this box's is
       its own. The layout is on a view inside it, because a `<Card>`'s `style`
       lands on its shell and arranges nothing. */
    <Card padded={false}>
      <View style={styles.box}>{children}</View>
    </Card>
  );
}

export type ProfileBoxSectionProps = {
  title: string;
  /** At the far end of the title's line: "Edit", a credit mark. */
  action?: ReactNode;
  /**
   * Where the section leads, when what it holds is a glimpse of something with
   * a screen of its own. The title's line becomes the way there and ends in a
   * chevron, in place of an `action`.
   */
  href?: Href;
  /** What the title's link is called, when it is one. */
  accessibilityLabel?: string;
  children: ReactNode;
};

/** One titled part of a box: its title, a hairline, and what it holds. */
export function ProfileBoxSection({
  title,
  action,
  href,
  accessibilityLabel,
  children,
}: ProfileBoxSectionProps) {
  const theme = useTheme();

  return (
    <View>
      <SectionHead
        title={title}
        action={action}
        href={href}
        accessibilityLabel={accessibilityLabel}
      />
      <View style={[styles.rule, { backgroundColor: theme.border }]} />
      {children}
    </View>
  );
}

/**
 * The heading of an open section: its title on the page and a rule under it.
 * What follows is the caller's, and runs on down the page.
 *
 * The rule is `borderStrong`, a step up from the hairline inside a box: this
 * one stands on the page with nothing round it, and it is what says a section
 * starts here.
 */
export function ProfileSectionHeader({ title }: { title: string }) {
  const theme = useTheme();

  return (
    <View>
      <SectionHead title={title} />
      <View style={[styles.rule, { backgroundColor: theme.borderStrong }]} />
    </View>
  );
}

/**
 * A section's first line: the title, and at its far end either what the caller
 * put there or — when the section leads somewhere — a chevron, with the whole
 * line the way through. The reference's "Recent Activity ›".
 */
function SectionHead({
  title,
  action,
  href,
  accessibilityLabel,
}: {
  title: string;
  action?: ReactNode;
  href?: Href;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();

  const heading = (
    <Text variant="h5" numberOfLines={1} accessibilityRole="header" style={styles.title}>
      {title}
    </Text>
  );

  if (!href) {
    return (
      <View style={styles.head}>
        {heading}
        {action}
      </View>
    );
  }

  return (
    <Link href={href} asChild>
      <PressableScale
        accessibilityRole="link"
        accessibilityLabel={accessibilityLabel ?? title}
        hitSlop={HEADER_SLOP}
        scaleTo={0.98}
        style={StyleSheet.flatten(styles.head)}>
        {heading}
        <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
      </PressableScale>
    </Link>
  );
}

/** One line of 14 is 19dp; the slop above and below it reaches the tap floor. */
const HEADER_SLOP = {
  top: Math.ceil((TapTarget - 19) / 2),
  bottom: Math.ceil((TapTarget - 19) / 2),
  left: Spacing.x8,
  right: Spacing.x8,
};

const styles = StyleSheet.create({
  box: { padding: BOX.padding },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  /* Takes the line, so whatever follows it sits at the far end. */
  title: { flex: 1 },
  /* The same two intervals inside a box and on the page, so a boxed section and
     an open one under it keep one rhythm from title to content. */
  rule: {
    height: StyleSheet.hairlineWidth,
    marginTop: BOX.ruleTop,
    marginBottom: BOX.ruleBottom,
  },
});
