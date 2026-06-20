## 2026-06-20 - Array Allocation and O(N) Passes Bottleneck

**Learning:** Multiple array allocations from chaining methods like `.filter()`, `.reduce()`, and nested loops `.filter()` inside `.map()` lead to excessive O(N) iterations and memory allocations in Node.js when processing large data arrays like dashboard statistics.
**Action:** Use single-pass O(N) accumulation loops and `.reduce` counters instead of `.filter().length` to eliminate intermediate memory allocations.
