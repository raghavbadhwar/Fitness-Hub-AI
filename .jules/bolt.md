## 2024-05-24 - Missing Debounce

**Learning:** Found an opportunity to use useDeferredValue or debounce in search inputs (nutrition.tsx and workout.tsx) which currently filter very large arrays (`INDIAN_FOODS` has ~1900 entries, `EXERCISES` has ~1200 entries) synchronously on every keystroke.
**Action:** Add debounce to text inputs when filtering large arrays to prevent blocking the main thread during typing.
