## 2024-05-18 - Missing Debounce in Rapid Text Filtering
**Learning:** Performing array filtering with string operations (`toLowerCase().includes()`) inline within a `useMemo` on every keystroke can block the React Native main thread, especially for non-trivial array lengths. This causes typing lag.
**Action:** Always wrap search input states that drive complex array filtering with a `useDebounce` hook to defer re-evaluation until the user has paused typing.
