import { useEffect } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

/**
 * A value that changes on every render, for animated styles to depend on.
 *
 * Reanimated keeps a settled animated value in a registry the native side
 * empties after two seconds, and a render after that puts the view back at
 * its first frame (CLAUDE.md § Gotchas). The usual answer is to restate the
 * resting pose as a plain style, which needs a pose React can name; "frosted
 * or not" and "discs carried off by 340dp" are the page's scroll offset, which
 * React never hears. So every style here reads this, and a render re-applies
 * them all the frame after — the copy showcase's remedy.
 *
 * **Re-applies only what differs from the last value.** Reanimated compares a
 * style with the one before it key by key and sends nothing when every key is
 * identical — and an opacity that settled at 1 is identical. A transform is an
 * array, never the same object twice, so every style here carries one, if only
 * a transform by nothing; and the one value that is a prop and not a style,
 * the blur's strength, is moved by a hundredth on alternate renders instead
 * (`<Frost>`).
 */
export function usePulse(): SharedValue<number> {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.set(pulse.get() + 1);
  });
  return pulse;
}
