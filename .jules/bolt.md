## 2024-06-21 - [Node.js Data Processing Array Allocations]
**Learning:** Chaining multiple array methods like `.filter().length`, `.reduce()`, and nested `.map()` inside loops causes excessive memory allocation and O(N^2) execution time in Node.js data processing, particularly for dashboard statistics.
**Action:** Always prefer single-pass O(N) accumulation loops and pre-initialized hash maps to aggregate data instead of allocating intermediate arrays.
