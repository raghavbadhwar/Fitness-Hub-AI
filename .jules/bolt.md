## 2025-01-20 - Prevent intermediate array allocations with reduce

**Learning:** Using `.filter(condition).length` to count elements in large arrays causes unnecessary memory allocations by creating a full intermediate array, which can be problematic during high traffic or large payload processing.

**Action:** Always use `.reduce((acc, curr) => condition ? acc + 1 : acc, 0)` when counting array elements to maintain a strict O(1) space footprint.
