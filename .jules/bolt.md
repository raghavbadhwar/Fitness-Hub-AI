## 2024-06-05 - Optimize admin dashboard stats with Promise caching
**Learning:** Computing the total active members using Clerk API in the dashboard route handler caused performance bottlenecks and potential cache stampedes under concurrent loads.
**Action:** Implement Promise caching for expensive operations. Store the promise instead of the resolved value in a memory cache, so concurrent requests share the same promise rather than initiating parallel computations. Cache the original uncaught promise to ensure invalidation logic fires properly.
