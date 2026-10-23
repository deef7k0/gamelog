import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { usePulse } from '@/components/ui/frosted-top-bar';
import { TabBar, type TabBarProps } from '@/components/ui/tab-bar';
import { useHeaderHeight } from '@/hooks/use-header-height';
import { useScreenChrome } from '@/hooks/use-screen-chrome';

/**
 * A page's tabs, held under its top bar once the page has scrolled them up to
 * it — the game page's, from the critique of 2026-10-21: deep in a long
 * Overview, Similar and Soundtrack were a long thumb's scroll back up.
 *
 * The page keeps drawing its own `<TabBar>` in the flow, where it always was,
 * and measures where it sits (`at`, its top in the scroller's content). This
 * is a second copy, laid over the page directly under the bar's row, that
 * appears the moment the first reaches that line — so it takes over exactly
 * where the first one is and nothing jumps. On the page's own colour, solid,
 * so what scrolls under it is hidden; the bar above it is frost.
 *
 * It reads the page's offset on the UI thread (`scrollY`), so a scroll costs
 * no renders. Hidden, it is moved off the screen as well as faded, so it never
 * takes a touch meant for the page under it. Its style reads `pulse` and
 * carries a transform, as the bar's do, so a render re-applies it — an
 * animated style's end value can otherwise be lost (CLAUDE.md, § Gotchas).
 *
 * Must be rendered under the `<Screen>` whose page it pins, after the page's
 * scroller, so it draws over it.
 */
export function PinnedTabBar<T extends string>({
  at,
  background,
  ...tabs
}: TabBarProps<T> & {
  /** The in-flow tab bar's top, in the page scroller's content; null until measured. */
  at: number | null;
  /** The page's colour. */
  background: string;
}) {
  const chrome = useScreenChrome();
  const headerHeight = useHeaderHeight();
  const pulse = usePulse();
  const scrollY = chrome?.scrollY;

  const shown = useAnimatedStyle(() => {
    pulse.get();
    const pinned = at !== null && !!scrollY && scrollY.get() >= at - headerHeight;
    return {
      opacity: pinned ? 1 : 0,
      transform: [{ translateY: pinned ? 0 : -4000 }],
    };
  });

  return (
    /* Hidden from assistive tech: the in-flow tabs are always reachable by
       swiping, and a second tablist would be read twice. */
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.pinned, { top: headerHeight, backgroundColor: background }, shown]}>
      <TabBar {...tabs} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pinned: { position: 'absolute', left: 0, right: 0 },
});
