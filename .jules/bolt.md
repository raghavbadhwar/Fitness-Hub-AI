## 2026-06-26 - Prevent Intermediate Array Allocation When Counting

**Learning:** When determining the count of elements that match a condition using `.filter(condition).length`, an unnecessary intermediate array is fully allocated in memory. This degrades performance and increases memory pressure, particularly on large arrays like member lists.

**Action:** Replace `.filter(condition).length` with `.reduce((acc, curr) => condition ? acc + 1 : acc, 0)` to iterate in a single pass without allocating intermediate memory.
