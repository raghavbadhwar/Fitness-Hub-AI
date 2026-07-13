## 2024-07-13 - O(N\*M) Loop Optimization

**Learning:** Repeatedly filtering an array inside a loop mapping over a static set of keys results in O(N\*M) complexity.
**Action:** Precompute a hash map lookup table via a single-pass `reduce` over the array (O(N)), and map the keys to their precomputed values.
