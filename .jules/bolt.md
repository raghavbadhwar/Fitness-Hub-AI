## 2024-05-18 - Avoid repeated array filtering in loops

**Learning:** In the `WorkoutContext.tsx` file, getting weekly and 30-day volume involved a loop over days that repeatedly filtered the entire `sessions` array inside the loop, resulting in O(N\*M) operations.
**Action:** When aggregating properties from an array across a static set of keys (e.g., looping over days to count matching items), avoid repeatedly filtering the source array inside the loop. Instead, do a single-pass `reduce` over the array to build a hash map lookup table (O(N)), and then map the keys to their precomputed counts.
