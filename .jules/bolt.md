## 2024-05-17 - [Optimizing Dashboard Aggregations]
**Learning:** Fetching full tables into application memory using `db.select().from(table)` to perform programmatic aggregations (`reduce`, `filter.length`) becomes a critical memory and network bottleneck as data volume grows (e.g., in `/dashboard` routes).
**Action:** Push aggregations to the database layer by utilizing Drizzle ORM operators like `sum()`, `count()`, and `groupBy()`. Run independent analytical queries concurrently using `Promise.all()` to decrease overall latency.
