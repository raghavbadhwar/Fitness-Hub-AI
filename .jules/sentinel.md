## 2024-05-15 - Insecure Random ID Generation

**Vulnerability:** Found `Math.random()` being used to generate IDs in multiple files across the `gymapp` workspace. `Math.random()` is cryptographically insecure and predictable, which could lead to ID collisions or predictability if these IDs are ever used in security-sensitive contexts (like session or auth identifiers, even if they aren't currently).
**Learning:** Developers sometimes use quick, built-in Javascript functions like `Math.random()` for convenience when generating unique identifiers, unaware of the potential security implications of predictable PRNGs. In a React Native/Expo environment, `expo-crypto` provides a readily available secure alternative.
**Prevention:** Always use cryptographically secure methods like `expo-crypto.randomUUID()` in React Native/Expo or `node:crypto.randomUUID()` in Node.js instead of `Math.random()` for generating IDs, tokens, or any random values.
