## 2024-05-09 - [Optimized Dashboard Stats]
**Learning:** In-memory aggregations on tables with unbound historical growth (like all classes ever created in `gym_classes`) create a massive N+1-like performance bottleneck as the data grows, causing excess memory and transfer.
**Action:** Always prefer database-level aggregations (`sum`, `count`, `groupBy` in Drizzle ORM) for lifetime statistics rather than fetching entire tables into memory, and use bounded date ranges for filtering UI-specific views.
