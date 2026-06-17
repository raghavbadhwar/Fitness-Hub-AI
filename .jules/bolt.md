
## 2024-05-23 - Prevent array allocations in loops
**Learning:** Using `.filter().length` creates full intermediate arrays which wastes memory and slows down execution time. Multiple map/filter passes cause O(N^2) or multiple O(N) operations.
**Action:** Prefer single-pass O(N) accumulation loops and `.reduce((acc, val) => cond ? acc + 1 : acc, 0)` to calculate counts without creating intermediate arrays.
