## 2026-06-25 - Prevent intermediate array allocations in counters
**Learning:** Using `.filter(condition).length` to count elements creates an unnecessary full intermediate array, causing excess memory allocation and pressure on large datasets.
**Action:** Replace `.filter(condition).length` with `.reduce((acc, curr) => condition ? acc + 1 : acc, 0)` for zero-allocation counting.
