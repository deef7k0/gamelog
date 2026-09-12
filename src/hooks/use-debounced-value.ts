import { useEffect, useState } from 'react';

/**
 * Delay propagating a rapidly-changing value.
 *
 * Used for search input so we issue one request per pause in typing rather than
 * one per keystroke.
 *
 * The rationale here used to be Steam's store rate limit; Steam left the search
 * path at the IGDB cutover and the number stayed. What justifies 350 now is the
 * Edge Function round trip in front of IGDB — and the caller is expected to show
 * that this window is *live*, because a screen that sits inert for a third of a
 * second after a keystroke reads as one that did not register it.
 */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
