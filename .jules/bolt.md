## 2024-11-20 - Redundant O(N) Iteration Anti-Pattern in Dashboard Stats Calculation
**Learning:** In the `api-server` workspace, computing daily class counts via `allClasses.filter((c) => c.date === dateStr).length` inside a `.map()` loop creates a redundant O(7N) execution path (filtering over ALL classes every day). This scales poorly with many classes and causes unnecessary overhead.
**Action:** When computing stats across predefined buckets (like days of the week), use a single-pass O(N) accumulation loop or pre-initialize a hash map instead of chaining multiple array methods.
