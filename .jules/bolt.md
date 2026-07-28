## 2024-07-28 - Refactoring Repeated Array Filtering to Hash Map Lookups

**Learning:** Found an O(N\*M) anti-pattern in the admin dashboard where the entire `allClasses` array was being filtered inside a loop for each day of the week to calculate weekly class counts.
**Action:** When aggregating properties across a static set of keys, always build a hash map lookup table in a single O(N) pass using `reduce`, and then map the keys to their precomputed values.
