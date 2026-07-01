## 2026-07-01 - Optimize Array Aggregations and Counting

**Learning:** Using `.filter()` inside a loop results in O(N\*M) operations which severely degrades performance on large datasets. Additionally, using `.filter().length` creates unnecessary full intermediate arrays in memory.
**Action:** Always use a single-pass `.reduce()` to build a hash map lookup table (O(N)) for aggregations over a static set of keys. For counting, use `.reduce()` as a counter instead of `.filter(condition).length` to avoid intermediate memory allocation.
