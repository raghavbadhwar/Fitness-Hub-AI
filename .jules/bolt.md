## 2026-05-07 - External API Calls in Dashboard Routes
**Learning:** The admin dashboard was making a synchronous network request to Clerk (`clerkClient.users.getCount()`) on every load just to retrieve the active member count, which created an unnecessary bottleneck for a frequently-accessed page and consumed external API rate limits.
**Action:** Use an in-memory cache with a reasonable TTL (e.g., 5 minutes) for metrics that do not require real-time absolute precision but are expensive to compute or fetch from external services.
