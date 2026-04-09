import { useState, useEffect } from 'react';

/**
 * Returns a debounced version of `value` that only updates after `delay` ms of inactivity.
 * Use for search inputs so the query key (and fetch) only changes after the user pauses typing.
 */
export function useDebounce(value, delay = 400) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
