## 2024-07-07 - Avoid Repeated O(N) Array Filtering Inside Mappings

**Learning:** When aggregating properties from an array across a static set of keys (like a week's days), placing `.filter()` inside a map loop causes O(N\*M) performance degradation. This is particularly noticeable in dashboard endpoints with large datasets (like all gym classes).
**Action:** Always precompute a hash map lookup table via a single-pass loop (O(N)), and then map the keys to their precomputed counts to ensure linear performance.
