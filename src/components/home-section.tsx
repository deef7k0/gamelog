import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Lifts "See all" from 36dp to 48 without growing the heading row.
 *
 * Slop rather than padding because the row's height is set by the title beside
 * it: adding 6dp of padding here would push every band's heading apart to fix a
 * touch problem that has nothing to do with spacing.
 */
const SEE_ALL_SLOP = { top: 6, bottom: 6, left: 8, right: 8 };

export type HomeSectionProps = {
  title: string;
  /** Optional one-line explanation of what the section is showing and why. */
  subtitle?: string;
  /** Where "See all" goes. Omit to render the heading without one. */
  seeAll?: Href;
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
 * One band of the Home page: a heading, an optional "See all", and its content.
 *
 * Home is a stack of unrelated things — a chart, some reviews, three news
 * items, two release rails, some collections — and the only thing keeping it
 * from reading as a jumble is that every band announces itself the same way.
 * That is this component's whole job, which is why it takes no styling props:
 * a section that wants to look different is a section that will make Home look
 * assembled by two people.
 *
 * Separation between sections is set by the page (`Spacing.x64`, 48dp) rather
 * than here, so a section never decides its own distance from its neighbours.
 */
export function HomeSection({ title, subtitle, seeAll, children }: HomeSectionProps) {
  const theme = useTheme();

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <View style={styles.headText}>
          {/* `h2`, not `h4`. A section heading has to win against the artwork
              directly under it, and at 14px bold it was losing to every cover
              on the page — the bands read as a continuous scroll with labels
              rather than as separate sections. 19px bold is the step where the
              heading reads first. */}
          <Text variant="h2" accessibilityRole="header">
            {title}
          </Text>
          {subtitle && (
            <Text variant="bodySmall" color="textMuted">
              {subtitle}
            </Text>
          )}
        </View>

        {seeAll && (
          <Link href={seeAll} asChild>
            <PressableScale
              accessibilityRole="link"
              accessibilityLabel={`See all ${title.toLowerCase()}`}
              hitSlop={SEE_ALL_SLOP}
              scaleTo={0.96}
              style={styles.seeAll}>
              <Text variant="bodySmall" color="primaryText">
                See all
              </Text>
              <Ionicons name="chevron-forward" size={14} color={theme.primaryText} />
            </PressableScale>
          </Link>
        )}
      </View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.x12 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.x12,
    paddingHorizontal: Spacing.x16,
  },
  headText: { flex: 1, gap: 2 },
  /* The padding alone does NOT clear the floor, which is what the note here
     used to claim. `bodySmall` is a 16dp line box, not 18, and `Spacing.x12` is
     10, not 12 — so this measured 36dp against 44 (iOS) and 48 (Android), on
     every band heading in the app. `SEE_ALL_SLOP` is what actually clears it;
     the padding is spacing. */
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x4,
    paddingVertical: Spacing.x12,
    paddingLeft: Spacing.x12,
  },
});
