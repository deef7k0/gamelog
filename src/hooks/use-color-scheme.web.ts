import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */

/** No external store to watch — we only care about server vs client snapshot. */
const subscribe = () => () => {};

export function useColorScheme() {
  const colorScheme = useRNColorScheme();

  // useSyncExternalStore gives a different value during static render (false)
  // than after hydration (true), without a setState-in-effect round trip.
  const hasHydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );

  return hasHydrated ? colorScheme : 'light';
}
