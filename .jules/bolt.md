## 2024-07-20 - O(N\*M) Loop to O(N) Hash Map for Dashboard weeklyClassCounts

**Learning:** The dashboard's `weeklyClassCounts` was performing an O(N\*M) operation by filtering `allClasses` multiple times across a static set of days.
**Action:** Refactored the loop to use a single-pass `reduce` over `allClasses` to build a hash map lookup table (O(N)), and then map the keys to their precomputed counts, preventing performance regressions as the number of classes grows.
