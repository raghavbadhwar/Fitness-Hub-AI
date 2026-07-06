## 2024-07-06 - N+1 Array Filtering in Database Queries

**Learning:** Returning all rows with a JSON array and doing application-side `.filter()` (O(N)) when we could have used database-side containment queries like `@>` (or in Drizzle `sql` with the `@>` operator) causes bounded array growth in memory.
**Action:** When filtering jsonb arrays in Postgres/Drizzle, use Drizzle `sql` to push down the array containment check to the database instead of fetching all rows into memory and filtering via `.includes()`.
