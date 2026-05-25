## 2024-05-25 - Prevent Chained Array Operations in Dashboard Stats
**Learning:** Chained array operations (e.g., `.filter().reduce()` or nested `.filter()` inside `.map()`) on large data sets like dashboard statistics create unnecessary loop passes and array allocations, leading to O(N^2) execution time.
**Action:** When computing complex dashboard stats from a single list of database records, pre-initialize hash maps (`Record<string, number>`) and use a single-pass `for...of` loop to aggregate all counts in O(N) time without allocating intermediate arrays.
