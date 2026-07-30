import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Height of the native stack's title bar, excluding the status bar.
 *
 * The platform defaults, not a guess: UIKit's compact navigation bar is 44pt
 * and Material's top app bar is 56dp.
 */
const BAR_HEIGHT = Platform.select({ ios: 44, android: 56, default: 56 });

/**
 * Total height the stack header occupies, safe area included.
 *
 * Needed because the header is transparent app-wide (see `HeaderBackdrop`), so
 * it no longer pushes content down — every screen that is *not* leading with
 * hero artwork has to reserve the space itself, via `<Screen insetHeader>`.
 *
 * React Navigation ships a `useHeaderHeight` that reads the real measured
 * height, but Expo Router v57 vendors React Navigation inside its own build
 * output and re-exports no such hook, so reaching it would mean importing from
 * `expo-router/build/react-navigation/elements` — a private path that is not
 * covered by semver. The arithmetic below is what that hook computes for a
 * plain (non-large-title, non-search) header, which is the only kind this app
 * uses.
 */
export function useHeaderHeight(): number {
  const insets = useSafeAreaInsets();
  return insets.top + BAR_HEIGHT;
}
