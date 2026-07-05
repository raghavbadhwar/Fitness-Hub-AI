## 2024-07-05 - Multi-tenant full table scans in Promise.all

**Learning:** In the multi-tenant Drizzle ORM architecture, parallel queries (like `Promise.all` in `admin-members.ts`) that fetch data across tenants without explicitly filtering by the tenant ID (`gymId`) cause unbounded full table scans, resulting in massive memory consumption and degraded dashboard performance.
**Action:** Always ensure all database queries, especially those fetching lists or being executed in parallel `Promise.all` blocks, explicitly filter by the tenant ID (e.g., `.where(eq(table.gymId, gymId))`).
