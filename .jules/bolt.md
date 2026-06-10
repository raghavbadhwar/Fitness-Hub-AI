## 2024-05-14 - Replace O(N^2) Array Methods with Single-Pass Accumulation
**Learning:** Using `dayNames.map(...)` combined with `allClasses.filter(...).length` to compute daily statistics on a dataset causes an O(N*M) loop execution, which leads to excessive array allocations and performance degradation on large datasets.
**Action:** Prefer single-pass O(N) loops with pre-initialized lookup maps or hash tables for accumulating statistics over large datasets rather than chaining multiple functional array methods.
