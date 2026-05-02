## 2025-02-23 - Insecure UUID generation

**Vulnerability:** Found `Math.random()` used in multiple places within `artifacts/gymapp` to generate primary UUIDs for workout sessions, meal entries, and user messages. `Math.random()` is not cryptographically secure, and this could lead to ID collision or predictability.
**Learning:** React Native / Expo environment does not have access to standard Node.js `crypto` or `Math.randomUUID` uniformly across old runtimes without polyfills. Developers often fallback to `Math.random()` when encountering polyfill issues.
**Prevention:** Provide a workspace-level secure ID utility like `@/lib/id` wrapping `expo-crypto.randomUUID()` and enforce its usage rather than ad-hoc inline ID generators.
