## 2024-05-20 - Database Aggregations for Dashboard Performance

**Learning:** Fetching an entire table into Node.js memory just to calculate aggregations (`totalEnrollments`, `mostPopularCategory`) is a severe performance bottleneck as the database grows. In `admin.ts` `/dashboard` endpoint, doing this manually in JS caused an O(N) memory and compute footprint.
**Action:** Always prioritize database aggregations (`sum`, `count`, `groupBy`) in Drizzle ORM to keep memory footprints low and avoid huge database lookups.
