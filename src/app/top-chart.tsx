import { useRef } from 'react';
import { StyleSheet, type ScrollView } from 'react-native';

import { TopChart } from '@/components/search/top-chart';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { PageScrollView } from '@/components/ui/page-scroll';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';

/**
 * The Top 1000, on a screen of its own — the owner's direction (2026-10-21):
 * "Move the top games chart into its own screen. Make a widget, like a button
 * for opening the chart." Search's Discover shows the button
 * (`<TopChartEntry>`, the top three fanned); this is where it leads.
 *
 * The chart is `<TopChart standalone>`: the bar carries its name, so the
 * chart opens on the line that says what ranks it, the GameLog / Critics
 * pills, twenty rows and the pager. A page turned from the pager at the foot
 * comes back to the top of the screen.
 */
export default function TopChartScreen() {
  const scroll = useRef<ScrollView>(null);

  return (
    <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back title="Top 1000" />}>
      <PageScrollView ref={scroll} contentContainerStyle={styles.content}>
        <TopChart standalone onTurn={() => scroll.current?.scrollTo({ y: 0, animated: false })} />
      </PageScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: Spacing.x12, paddingBottom: Spacing.x48 },
});
