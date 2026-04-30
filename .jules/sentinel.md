## 2024-05-24 - Cryptographically Insecure ID Generation

**Vulnerability:** Found multiple instances where unique IDs were being generated using `Math.random()` combined with `Date.now()`. `Math.random()` is not cryptographically secure, which could lead to predictable IDs, collisions, and potential insecure direct object references or predictability issues if these IDs are ever used in security-sensitive contexts.
**Learning:** `Math.random()` should never be used to generate tokens, unique identifiers, or secrets. It is designed to be fast, not secure.
**Prevention:** Use a secure random number generator instead. For Expo/React Native projects, `expo-crypto.randomUUID()` provides cryptographically secure pseudo-random identifiers.
