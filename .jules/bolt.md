
## 2024-07-16 - O(N*M) nested filter performance optimization
**Learning:** In `artifacts/api-server/src/routes/admin.ts`, iterating a static set of keys (e.g. days of the week) and repeatedly running `Array.prototype.filter` on a larger array (e.g. `allClasses`) inside the loop introduces a hidden O(N*M) performance penalty.
**Action:** When aggregating or counting items against a static set of keys, do a single-pass `reduce` over the large array to build a hash map lookup table (O(N)), and then map the keys to their precomputed counts. This drastically improves performance, especially as the number of items grows.
