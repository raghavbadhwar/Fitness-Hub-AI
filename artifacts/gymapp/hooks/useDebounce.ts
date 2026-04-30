import { useState, useEffect } from "react";

// ⚡ Bolt Optimization:
// Debounces a value so it only updates after a specified delay has passed without the value changing.
// 🎯 Why: Prevents expensive operations (like filtering large lists) from running on every keystroke.
// 📊 Impact: Significantly reduces main-thread blocking and re-renders during text input, improving responsiveness.
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
