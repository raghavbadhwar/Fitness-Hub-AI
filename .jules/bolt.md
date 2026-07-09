## 2026-07-09 - Optimize O(N²) array filter in Admin Dashboard weekly stats

**Learning:** In the admin dashboard stats route, calculating the weekly class counts repeatedly called `allClasses.filter()` inside a `.map()` loop (an O(N\*M) operation). For large gym schedules, this could cause excessive memory and CPU usage on the backend when rendering the admin dashboard.
**Action:** Replace the nested loop array filtering with a single-pass `reduce` to build an O(N) hash map lookup table (`classCountsByDate`), ensuring faster and safer rendering regardless of dataset size.
