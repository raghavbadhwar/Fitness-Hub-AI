## 2024-05-12 - Dashboard Aggregation Optimization
**Learning:** In-memory calculations of `enrolledCount`, categories, and weekly totals caused an O(N) penalty and memory bloat on the server for `/api/admin/dashboard`. Relying on full-table scans mapped via JS array methods reduces throughput.
**Action:** Always delegate aggregations (`sum`, `count`, `groupBy`) directly to the Drizzle ORM/database level. It scales better and simplifies mapping logic using `Promise.all` concurrent database queries.
