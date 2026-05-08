## 2025-05-08 - Insecure ID Generation

**Vulnerability:** Weak random number generation using `Math.random()` was found across several files in the `gymapp` codebase (`workout-session.tsx`, `assistant.tsx`, `NutritionContext.tsx`, `WorkoutContext.tsx`) for generating IDs. This is not cryptographically secure and can lead to predictable IDs and potential collision issues.
**Learning:** Math.random() is predictable and shouldn't be used for ID generation in an application.
**Prevention:** Always use cryptographically secure random number generators. For the Expo React Native app, `expo-crypto`'s `randomUUID()` should be used as a drop-in replacement to generate robust, unpredictable IDs.
