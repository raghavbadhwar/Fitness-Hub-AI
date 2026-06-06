## 2026-06-06 - Array Counting Optimization

**Learning:** Using `.filter(condition).length` creates a full intermediate array in memory just to count elements. This is inefficient for large arrays.
**Action:** Use a counter loop or `.reduce((acc, curr) => condition ? acc + 1 : acc, 0)` to avoid unnecessary array allocations.
