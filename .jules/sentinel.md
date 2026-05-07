## 2026-05-07 - Rate Limiting Bypass via Spoofed IP
**Vulnerability:** The rate limit implementation for the AI endpoint (`artifacts/api-server/src/routes/ai.ts`) relied on the `x-forwarded-for` HTTP header. Without a verified proxy configuration, this header can be trivially spoofed by an attacker, allowing them to bypass the rate limit and potentially exhaust resources or incur massive AI API costs.
**Learning:** For authenticated API routes, relying on client-provided network headers for rate limiting is fundamentally insecure. The most reliable and spoof-proof identifier is the authenticated session itself.
**Prevention:** Always use the authenticated `userId` (e.g., via `getAuth(req)?.userId`) as the rate-limiting key for protected endpoints rather than IP addresses or proxy headers.
