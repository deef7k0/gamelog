import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useScreenChrome } from '@/hooks/use-screen-chrome';

/** Within this of the top, the field is always out. */
const REVEAL_TOP = 12;

/** How far the page must travel one way before the field changes its mind. */
const TRAVEL = 24;

/** The fold, each way: SimpMusic's expand / shrink, on a gentle ease-out. */
const FOLD_MS = 240;

/**
 * Search's field, folding away as the page is read and coming back on the way
 * up — the owner's direction (2026-10-15): "make it so the search bar is hidden
 * when the user scrolls and only the tabs are visible. Simpmusic does this very
 * same thing for their home screen topbar."
 *
 * Read from SimpMusic's `HomeScreen.kt`: its top bar sits in an
 * `AnimatedVisibility(visible = isScrollingUp)` with `expandVertically` /
 * `shrinkVertically`, over the chip row, which never moves. So here: reading
 * down folds the field's height to nothing (the tabs rise into its place and
 * stay), and scrolling back up — or reaching the top — unfolds it. The page
 * has to travel `TRAVEL` one way before the field changes its mind, so a finger
 * resting on the glass does not make it flicker.
 *
 * **Where the offset comes from.** Every list Search can show is the page's
 * scroller (`ui/page-scroll`), which writes its offset to the `scrollY`
 * `<Screen>` publishes; this reads it on the UI thread, so the fold never waits
 * on JavaScript. A list that mounts — another tab, a new query — says it is at
 * its top, which brings the field back.
 *
 * `pinned` holds it out: while the field has the focus there is a keyboard
 * under the reader's thumbs and nothing to hide it for. Under Reduce Motion
 * it folds and unfolds at once. Must be drawn inside `<Screen>`.
 */
export function CollapsingField({ pinned, children }: { pinned: boolean; children: ReactNode }) {
  const scrollY = useScreenChrome()?.scrollY;
  const reduceMotion = useReducedMotion();
  const duration = reduceMotion ? 0 : FOLD_MS;

  const height = useSharedValue(0);
  const shown = useSharedValue(1);
  const progress = useSharedValue(1);
  const anchor = useSharedValue(0);
  const held = useSharedValue(pinned);

  useEffect(() => {
    held.set(pinned);
    if (pinned && shown.get() === 0) {
      shown.set(1);
      progress.set(withTiming(1, { duration, easing: Easing.out(Easing.cubic) }));
    }
  }, [pinned, held, shown, progress, duration]);

  useAnimatedReaction(
    () => scrollY?.get() ?? 0,
    (y) => {
      const show = (next: number) => {
        if (shown.get() === next) return;
        shown.set(next);
        progress.set(withTiming(next, { duration, easing: Easing.out(Easing.cubic) }));
      };

      if (held.get() || y <= REVEAL_TOP) {
        anchor.set(y);
        show(1);
        return;
      }

      const travel = y - anchor.get();
      if (travel > TRAVEL) {
        anchor.set(y);
        show(0);
      } else if (travel < -TRAVEL) {
        anchor.set(y);
        show(1);
      } else if ((shown.get() === 0 && travel > 0) || (shown.get() === 1 && travel < 0)) {
        /* Still going the way it already went: the anchor follows, so turning
           round is measured from where the turn happened. */
        anchor.set(y);
      }
    },
    [duration]
  );

  const fold = useAnimatedStyle(() => {
    const full = height.get();
    const amount = progress.get();
    /* Unmeasured, it is simply as tall as it is. */
    return full > 0 ? { height: full * amount, opacity: amount } : { opacity: amount };
  });

  return (
    <Animated.View style={[styles.clip, fold]}>
      <View onLayout={(event) => height.set(event.nativeEvent.layout.height)}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
});
