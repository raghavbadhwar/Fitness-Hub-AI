## 2024-06-22 - Dashboard Node.js Optimization
**Learning:** Chaining array methods like `.filter()`, `.reduce()`, and nested `.map()` during data processing causes unnecessary intermediate array allocations and potentially O(N^2) complexity in Express route handlers.
**Action:** Replace chained array methods with single-pass O(N) accumulation loops and pre-initialized hash maps, and use `.reduce()` counters instead of `.filter().length` for memory-efficient counting.
