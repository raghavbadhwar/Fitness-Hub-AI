## 2024-05-06 - Insecure Random ID Generation

**Vulnerability:** Weak, non-cryptographic ID generation using `Math.random()` combined with timestamps in gymapp contexts and screens.
**Learning:** `Math.random()` is predictable and not suitable for security purposes such as generating unique IDs, which could potentially lead to collisions or predictability in the system. The codebase has `expo-crypto` installed but it was not being utilized for this purpose.
**Prevention:** Always use a cryptographic random number generator like `expo-crypto.randomUUID()` when generating unique identifiers to ensure unpredictability and significantly lower collision chances.
