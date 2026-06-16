## 2024-06-16 - Preventing excessive array allocations in dashboard stats

**Learning:** Using `.filter(condition).length` inside loops or for large datasets creates full intermediate arrays, leading to excessive memory allocation and potential O(N^2) execution time. In Node.js environments, this can severely impact performance under load when computing aggregated dashboard statistics.
**Action:** Replace `.filter().length` with single-pass `.reduce()` counters or O(N) hash map accumulations to avoid intermediate array allocations and reduce time complexity.
