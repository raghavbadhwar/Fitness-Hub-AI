## 2025-06-14 - Optimize array length checks in dashboard stats

**Learning:** Checking the length of an intermediate array created by `.filter()` (e.g. `array.filter(condition).length`) results in unnecessary memory allocation for the full intermediate array, contributing to increased O(N) execution time, especially on large datasets.
**Action:** Replace `.filter(condition).length` with a `.reduce((acc, curr) => condition ? acc + 1 : acc, 0)` counter or a standard `for...of` loop with a counter to prevent intermediate array allocations.
