## 2024-07-31 - Refactor workout-session stats calculation

**Learning:** Repeatedly calling `.reduce()` and `.filter()` inside React component renders leads to unnecessary intermediate arrays (due to filter) and multiple iterations over the same data structure, which can cause micro-stutters during frequent state updates (like an active workout timer).
**Action:** Consolidate multiple array derivations into a single `reduce` pass to minimize iterations and avoid creating intermediate arrays completely.
