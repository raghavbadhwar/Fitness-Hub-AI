## 2025-05-22 - Optimize Dashboard Stats

**Learning:** Found multiple iterations through large class arrays with `.filter`, `.reduce`, and nested sorting to compute admin dashboard statistics. In Express backend arrays fetching from db queries this causes excessive array allocations.
**Action:** Replace multiple passes over class queries with a single O(n) array reduction loop.
## 2025-05-22 - Optimize Dashboard Stats Part 2
**Learning:** Found O(N^2) behavior in computing weekly class counts. The `.filter()` loop inside the 7 days mapping creates 7x N iterations.
**Action:** Replace nested loops by accumulating counts in an O(N) hash map step first.
