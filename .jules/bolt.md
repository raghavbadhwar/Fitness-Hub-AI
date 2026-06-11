## 2026-06-11 - Optimize Array Counting
**Learning:** Using `.filter(condition).length` to count elements creates an unnecessary intermediate array and can lead to O(N^2) execution time if used inside loops.
**Action:** Prefer single-pass O(N) accumulation loops and pre-initialized hash maps over chaining multiple array methods.
