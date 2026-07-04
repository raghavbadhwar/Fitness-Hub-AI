## 2024-05-24 - O(N\*M) Array Filtering in Render Loops

**Learning:** In React components and hooks, mapping over a static list of keys (like days of a month) and filtering a large dataset (like workout sessions) inside the loop causes an O(N\*M) performance bottleneck, as the array is fully scanned on every iteration.
**Action:** Always precompute a hash map lookup table via a single-pass `reduce` (O(N)) before the loop, then access the pre-aggregated values by key (O(1)) during iteration.
