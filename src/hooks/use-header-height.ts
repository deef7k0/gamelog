import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TOP_BAR_DISC_ROOM, TOP_BAR_ROW } from '@/constants/top-bar';
import { useScreenChrome } from '@/hooks/use-screen-chrome';

/**
 * How far the top bar's content row sits below the top of the page.
 *
 * The status bar inset on an ordinary screen — the bar runs edge to edge and
 * pushes its own content clear of the notch.
 *
 * **Zero inside a modal on iOS.** A sheet-presented modal starts *below* the
 * status bar, so it has no notch to clear; adding the window inset there would
 * leave a status-bar-sized band of empty glass above the title. Android presents
 * modals full-screen and keeps the inset. `<Screen modal>` is what flags it, and
 * it reaches here through the chrome context so a screen never has to state it
 * twice.
 *
 * The `modal` argument is for `<Screen>` alone, which sits *above* its own
 * provider and so cannot read the context it is about to publish. Everyone else
 * omits it.
 */
export function useTopBarInset(modal?: boolean): number {
  const insets = useSafeAreaInsets();
  const chrome = useScreenChrome();
  const isModal = modal ?? chrome?.modal ?? false;
  return isModal && Platform.OS === 'ios' ? 0 : insets.top;
}

/**
 * Total height the top bar occupies, inset included.
 *
 * Needed because `<FrostedTopBar>` is `position: absolute` — it draws over the
 * page and pushes nothing down, so that a list has something to slide under
 * and the frost something to frost. A page that opens on a list or a form
 * reserves the space back with `<Screen insetHeader>`, which is the only
 * caller that should need this number directly.
 *
 * The row is 64 on both platforms — Material 3's bar, as the reference draws
 * it (`TOP_BAR_ROW`). A page that opens on artwork has no bar at rest and
 * wants `useDiscRoom()` instead.
 */
export function useHeaderHeight(modal?: boolean): number {
  return useTopBarInset(modal) + TOP_BAR_ROW;
}

/**
 * How much of its top a page that opens on artwork keeps clear for the glass
 * discs, inset included: the disc and its distance from the corner.
 *
 * Four dp less than `useHeaderHeight()`. The review's art, Surprise Me's card,
 * the soundtrack's disc and a copy's stage were all laid out under the discs,
 * and those pages still have discs — so they kept this number when the bar's
 * row became 64, and none of them moved.
 */
export function useDiscRoom(modal?: boolean): number {
  return useTopBarInset(modal) + TOP_BAR_DISC_ROOM;
}
