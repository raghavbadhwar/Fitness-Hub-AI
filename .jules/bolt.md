## 2024-05-29 - Array Accumulation in Node.js
**Learning:** Chaining multiple array methods (`.filter()`, `.reduce()`, nested `.map()`) with O(N) internal iterations can create a measurable performance bottleneck in data processing, especially in routes that fetch a large unbounded set of rows (like `/dashboard`).
**Action:** Replace chained array methods with a single-pass O(N) `for` loop that accumulates multiple variables and pre-computes hash maps.
