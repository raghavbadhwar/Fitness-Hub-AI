## 2024-05-20 - React Native TextInput lag during rapid typing

**Learning:** In React Native, updating state synchronously on `onChangeText` and immediately using that state to filter large arrays or trigger heavy re-renders (like long lists) causes noticeable lag and dropped keystrokes during rapid typing, as the JavaScript thread gets blocked.
**Action:** Always wrap the search query state with a `useDebounce` hook before passing it to expensive `useMemo` filtering functions or list renderers, ensuring the UI remains responsive while the user is typing.
