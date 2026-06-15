## 2026-06-15 - Single-pass O(N) accumulation loops vs multiple O(N) array methods

**Learning:** To prevent excessive array allocations and O(N^2) execution time in Node.js data processing (e.g., computing dashboard statistics), prefer single-pass O(N) accumulation loops and pre-initialized hash maps over chaining multiple array methods like `.filter()`, `.reduce()`, and nested `.map()`.
**Action:** Replace multiple passes of array transformations (`filter`, `reduce`, `map`) with a single `for...of` loop using accumulator variables and maps.
