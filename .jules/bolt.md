## 2024-05-14 - [Dashboard O(N) Array Accumulation]
**Learning:** The `/dashboard` route previously used multiple `.filter()`, `.reduce()`, and nested `.map()` loops on the entire `gymClassesTable` result set. For large datasets, this creates excessive intermediate array allocations and blocks the Node event loop.
**Action:** Always prefer a single O(N) accumulation pass over data sets for derived statistics (e.g. counting enrollments, calculating categories, counting daily classes) over chaining multiple array methods.

## 2024-05-14 - [Concurrent External API Call Coalescing]
**Learning:** The `/dashboard` route fetched active members from Clerk directly. Caching the raw array works for sequential requests, but under concurrent load (e.g. multiple clients refreshing), a cache stampede occurs because the initial fetch hasn't resolved yet before the second client checks the cache.
**Action:** When implementing an in-memory TTL cache for external async fetches in Express, store the `Promise` itself rather than the resolved value. If a new request arrives while the first is pending, it safely awaits the identical Promise.
