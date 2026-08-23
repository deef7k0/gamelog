import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TopBarHeight } from '@/constants/theme';
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
 * Total height the floating top bar occupies, inset included.
 *
 * Needed because `<FrostedTopBar>` is `position: absolute` — it draws over the
 * page and pushes nothing down. Screens that open on artwork want exactly that;
 * every other screen reserves the space back with `<Screen insetHeader>`, which
 * is the only caller that should need this number directly.
 *
 * The bar is one height on both platforms, so there is no `Platform.select` on
 * the row itself any more: the native stack header this replaced was 44pt on iOS
 * and 56dp on Android, and matching those would have made the same title sit at
 * two different heights for no reason once the bar stopped being native.
 */
export function useHeaderHeight(modal?: boolean): number {
  return useTopBarInset(modal) + TopBarHeight;
}
