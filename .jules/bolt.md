## 2025-05-08 - [Debounce Frontend Searches]
**Learning:** React Native `TextInput` components connected to uncontrolled or expensive filter functions (like `searchFoods` or `searchExercises`) will block the main thread and cause typing lag if not debounced.
**Action:** Always implement a `useDebounce` hook for user input fields that trigger filtering on large datasets or trigger heavy computational paths within `useMemo`.
