## 2024-05-25 - Prevent intermediate array allocations with reduce counters
**Learning:** Using `.filter(condition).length` creates a full intermediate array in memory, causing unnecessary garbage collection pressure and performance bottlenecks when counting elements in large datasets like `listAdminMembers` or `allClasses`.
**Action:** Always use `.reduce((acc, curr) => condition ? acc + 1 : acc, 0)` when you only need to count elements that match a condition, to maintain O(1) memory complexity.
