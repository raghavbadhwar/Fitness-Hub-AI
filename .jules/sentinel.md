## Sentinel Journal

## 2025-02-28 - Information Exposure and Rate Limit Spoofing in AI Routes
**Vulnerability:** The AI endpoints in `artifacts/api-server/src/routes/ai.ts` were returning raw error messages (`err.message`) in JSON responses when catching exceptions. Additionally, the rate limiter used the `x-forwarded-for` header for its tracking key.
**Learning:** Returning unhandled exception messages in a 500 status payload can leak internal implementation details, such as file paths or third-party API error details. Using `x-forwarded-for` for rate limiting allows attackers to spoof their IP address to bypass OOM defenses or trigger DoS scenarios.
**Prevention:** Always use generic fallback strings for top-level catch blocks in Express handlers (e.g., `Failed to generate workout`) rather than passing raw strings directly to the client. Use verified authentication tokens, like `userId` from Clerk via `getAuth(req)`, for stateful operations such as rate-limiting.
