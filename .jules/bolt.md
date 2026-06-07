## 2024-06-07 - Promise Caching to Prevent Thundering Herd
**Learning:** When caching expensive API calls in Node.js/Express, caching the resolved value leaves a window where concurrent requests under load can trigger identical outgoing API calls (the thundering herd or cache stampede problem).
**Action:** Store the initial `Promise` itself in the cache map instead of awaiting the result first. This ensures all concurrent requests seamlessly await the exact same flighted promise.
