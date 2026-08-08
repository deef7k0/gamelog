import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type HomeSectionProps = {
  title: string;
  /** Optional one-line explanation of what the section is showing and why. */
  subtitle?: string;
  /** Where "See all" goes. Omit to render the heading without one. */
  seeAll?: Href;
  children: ReactNode;
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
 * 24px between sections, set by the page rather than here, so a section never
 * decides its own separation from its neighbours.
 */
export function HomeSection({ title, subtitle, seeAll, children }: HomeSectionProps) {
  const theme = useTheme();

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text variant="section">{title}</Text>
          {subtitle && (
            <Text variant="caption" color="textMuted">
              {subtitle}
            </Text>
          )}
        </View>

        {seeAll && (
          <Link href={seeAll} asChild>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`See all ${title.toLowerCase()}`}
              scaleTo={0.96}
              style={styles.seeAll}>
              <Text variant="caption" color="primary">
                See all
              </Text>
              <Ionicons name="chevron-forward" size={14} color={theme.primary} />
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
  /* Padded to clear 44 on the cross axis without the row growing: the label is
     18px tall, so the padding is doing the tap-target work. */
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x4,
    paddingVertical: Spacing.x12,
    paddingLeft: Spacing.x12,
  },
});
