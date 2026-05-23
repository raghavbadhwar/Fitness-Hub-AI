## 2024-05-24 - [Avoid multiple passes in Dashboard Stats]
**Learning:** Multiple array iteration methods (`.filter()`, `.reduce()`, nested `.map()`) can cause excessive array allocations and memory usage when processing large datasets like dashboard stats.
**Action:** Replace sequential array manipulations with a single-pass `O(N)` accumulation loop using pre-initialized hash maps for aggregate data collection to improve both speed and memory efficiency.
