## 2024-05-18 - Avoid O(N^2) multiple passes for Node.js data processing

**Learning:** Multiple array iterations with `filter`, `map`, and `reduce` create full intermediate arrays and cause excessive redundant iterations that block the event loop for larger sets.
**Action:** Prefer single-pass O(N) accumulation loops instead of chaining multiple array methods.
