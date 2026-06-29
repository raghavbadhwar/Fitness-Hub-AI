## 2024-06-29 - Avoid Intermediate Array Allocation
**Learning:** Using `.filter(condition).length` to count elements creates a full intermediate array, which causes unnecessary memory allocation and garbage collection overhead, especially when iterating over large datasets like database results or member lists.
**Action:** Replace `.filter(condition).length` with a single-pass O(N) `.reduce((acc, curr) => condition ? acc + 1 : acc, 0)` counter to avoid allocating intermediate arrays.
