## 2024-05-24 - Single-Pass Dashboard Statistics Optimization
**Learning:** Using chained array methods (`.filter().length`, nested `.filter()` inside `.map()`) in Node.js backend routes (like dashboard stats) leads to excessive array allocations and O(N^2) execution time.
**Action:** Prefer single-pass O(N) accumulation loops and pre-initialized hash maps over multiple array methods to minimize memory allocations and improve CPU efficiency on large datasets. Avoid `.filter(condition).length` in favor of `.reduce((acc, curr) => condition ? acc + 1 : acc, 0)`.
