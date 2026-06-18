## 2025-02-27 - Avoid intermediate array allocations in data processing
**Learning:** Chaining `.filter().length` and nesting `.filter()` inside `.map()` creates expensive intermediate arrays and O(N^2) complexity in Node.js, which is detrimental to dashboard data aggregation.
**Action:** Prefer single-pass O(N) accumulation loops and hash map lookups over chained array operations, and use `.reduce` for element counting to avoid allocating new arrays in memory.
