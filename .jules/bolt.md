## 2024-07-25 - [Optimize nested array filtering]

**Learning:** When aggregating properties from an array across a static set of keys (e.g., looping over days to count matching items), repeatedly filtering the source array inside the loop results in O(N\*M) operations.
**Action:** Instead, do a single-pass `reduce` over the array to build a hash map lookup table (O(N)), and then map the keys to their precomputed counts.
