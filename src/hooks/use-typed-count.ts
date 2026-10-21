import { useEffect, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

import { lettersShown } from '@/lib/typing';

/**
 * How many letters of `text` are on screen, typing in from mount, a letter at
 * a time on onboarding's clock (`lib/typing.ts`) — the owner's direction for a
 * review's quote: "the same letter by letter animation". Timed by the clock,
 * so a late frame shows two letters rather than falling behind.
 *
 * All of it at once when `enabled` is false and under Reduce Motion.
 */
export function useTypedCount(text: string, enabled: boolean): number {
  const reduceMotion = useReducedMotion();
  const animate = enabled && !reduceMotion;
  const [typed, setTyped] = useState(() => (animate ? 0 : text.length));

  useEffect(() => {
    if (!animate) return;
    const started = Date.now();
    let frame = requestAnimationFrame(function tick() {
      const next = lettersShown(text, Date.now() - started);
      setTyped(next);
      if (next < text.length) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [animate, text]);

  return animate ? typed : text.length;
}
