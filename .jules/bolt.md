## 2025-02-17 - O(N\*M) weekly class count optimization

**Learning:** Found a common pattern of computing weekly metrics by iteratively filtering an already loaded dataset of classes across the 7 days of the week, resulting in an O(N\*M) time complexity.
**Action:** Replace nested loops and repeated filters with single-pass reducers to build frequency maps (O(N)), followed by straightforward map lookups.
