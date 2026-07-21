## 2024-05-15 - Array Filtering in Loops

**Learning:** Repeatedly filtering an array inside a map loop creates an O(N\*M) bottleneck.
**Action:** Use a single-pass reduce over the array to build a hash map lookup table (O(N)), and map the keys to precomputed counts.
