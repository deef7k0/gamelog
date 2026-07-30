import { useEffect, useState } from 'react';

/**
 * Delay propagating a rapidly-changing value.
 *
 * Used for search input so we issue one request per pause in typing rather than
 * one per keystroke — Steam's store API is rate limited.
 */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
