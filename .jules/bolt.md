## 2024-06-13 - Dashboard Loop Optimization

**Learning:** Chaining array methods like `.filter()` and `.reduce()`, combined with nested loops (e.g., `.filter()` inside `.map()`), causes excessive array allocations and O(N\*M) execution times in Node.js data processing.
**Action:** Prefer single-pass O(N) accumulation loops and pre-initialized hash maps over chaining array methods.
