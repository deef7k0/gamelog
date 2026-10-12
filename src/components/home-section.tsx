import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { FontFamily, Spacing, TapTarget, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type HomeSectionProps = {
  title: string;
  /**
   * Words set before the title in the regular weight, so the title is the
   * bold part: "Similar to **Hades**". For a heading whose subject is a name
   * the page did not choose — the bold is where the reader's eye lands.
   */
  lead?: string;
  /** Optional one-line explanation of what the section is showing and why. */
  subtitle?: string;
  /** Where the section leads. Omit to render the heading without a chevron. */
  seeAll?: Href;
  /**
   * A small control at the far end of the heading's line — the period on
   * "Beloved by the community". In place of the chevron, never beside it.
   */
  trailing?: ReactNode;
  /**
   * The band's content.
   *
   * Optional, for the one case where the host owns the rows: a band whose items
   * are a `FlatList`'s own data cannot nest them here, so it uses this for the
   * heading and lets the list render underneath.
   */
  children?: ReactNode;
};

/**
 * A band of a page: a heading on the page, and under it what the heading
 * names — a row of games, news, the genres, collections, a studio's grid.
 *
 * The heading is the owner's reference for a section (2026-10-09, Letterboxd's
 * home), in this app's type:
 *
 * - **`h4`**, one line. It was `h2` (20), chosen to win against a rail of
 *   180dp covers directly under it; a row's covers are 123 now, and 20 over
 *   them was shouting.
 * - **A chevron, not "See all".** A heading that leads somewhere is the link —
 *   the whole line — and ends in a quiet chevron.
 * - **A row of games has no subtitle**: the covers under it explain it. The
 *   line is for what is not a row of covers — a grid of ten genres does not
 *   explain itself.
 *
 * **On the page, not in a card.** For one build every row of games sat in a
 * rounded panel with its heading inside, as the reference's do; the owner saw
 * it on a phone and had the cards removed. This is what a row stands under.
 *
 * Separation between sections is set by the page (`Spacing.x32`, 32dp) rather
 * than here, so a section never decides its own distance from its neighbours.
 */
export function HomeSection({
  title,
  lead,
  subtitle,
  seeAll,
  trailing,
  children,
}: HomeSectionProps) {
  const theme = useTheme();

  const text = (
    <View style={styles.headText}>
      <Text variant="h4" accessibilityRole="header">
        {lead && <Text variant="h4" style={styles.lead}>{`${lead} `}</Text>}
        {title}
      </Text>
      {subtitle && (
        <Text variant="bodySmall" color="textMuted">
          {subtitle}
        </Text>
      )}
    </View>
  );

  return (
    <View style={styles.section}>
      {seeAll ? (
        <Link href={seeAll} asChild>
          <PressableScale
            accessibilityRole="link"
            accessibilityLabel={`See all ${(lead ? `${lead} ${title}` : title).toLowerCase()}`}
            hitSlop={HEAD_SLOP}
            scaleTo={0.98}
            style={StyleSheet.flatten(styles.head)}>
            {text}
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </PressableScale>
        </Link>
      ) : (
        <View style={styles.head}>
          {text}
          {trailing}
        </View>
      )}

      {children}
    </View>
  );
}

/** One line of `h4` is 21dp; the slop above and below it reaches the tap floor. */
const HEAD_SLOP = {
  top: Math.ceil(Math.max(0, TapTarget - Type.h4.lineHeight) / 2),
  bottom: Math.ceil(Math.max(0, TapTarget - Type.h4.lineHeight) / 2),
  left: 0,
  right: 0,
};

const styles = StyleSheet.create({
  /* `x12` between the heading and what it heads: the cards under it are twelve
     apart from each other, and the heading is the first of that column. */
  section: { gap: Spacing.x12 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    paddingHorizontal: Spacing.x16,
  },
  headText: { flex: 1, gap: 2 },
  /* The heading's size in the regular family: Android synthesises no weight
     for a custom font, so the lighter half is a family, not a `fontWeight`. */
  lead: { fontFamily: FontFamily.regular },
});
