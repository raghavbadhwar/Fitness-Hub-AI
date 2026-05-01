import { useState, useEffect } from "react";

/**
 * ⚡ Bolt Optimization: useDebounce hook
 * Delays updating the returned value until after the specified delay has passed
 * since the last time it was called.
 * Impact: Essential for preventing expensive operations (like filtering large lists or API calls)
 * from running on every single keystroke in text inputs.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
