## 2024-05-20 - Adding debouncing to search inputs

**Learning:** In React Native/Expo applications, synchronous search filtering on large data sets (like food items or exercises) directly tied to `onChangeText` can cause noticeable typing lag, as the filtering blocks the main UI thread during typing.
**Action:** Always implement a `useDebounce` hook for search inputs that filter large lists, allowing the user to type smoothly and delaying the expensive filter operation until typing pauses.
