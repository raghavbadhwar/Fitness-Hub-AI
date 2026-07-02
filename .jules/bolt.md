## 2024-07-02 - Array Filtering in Loops

**Learning:** Calling `.filter().length` repeatedly inside a loop (like `map`) over a static set of keys creates an O(N\*M) performance bottleneck, especially as the data set grows.
**Action:** Always use a single-pass `.reduce()` to build an O(N) hash map lookup table before the loop, and query the map inside the loop for O(1) lookups.
