## 2025-05-01 - Debouncing State Updates for Local Search

**Learning:** When using controlled TextInput components connected to local filtering (e.g., filtering a local array using `includes()`), triggering the filter function and React state updates on every keystroke causes significant re-renders. While the filtering operation itself may be fast, blocking the main thread during typing degrades UX, particularly on mobile devices.
**Action:** Always wrap the filtering query state in a `useDebounce` hook (e.g., `delay = 300ms`) and use the debounced value in the `useMemo` dependency array for the filtered list. This preserves input responsiveness while batching the computationally expensive list rendering.
