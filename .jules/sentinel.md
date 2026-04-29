## 2024-05-18 - Rate Limiting Bypass via IP Spoofing

**Vulnerability:** The API server was using the `x-forwarded-for` header for rate limiting on the `/api/ai` endpoint. This could be bypassed by an attacker spoofing the header or could inadvertently rate limit users sharing the same IP.
**Learning:** For endpoints authenticated via Clerk, always use the authenticated user's `userId` instead of IP address for rate limiting to prevent circumvention and false positives.
**Prevention:** Use `getAuth(req).userId` from `@clerk/express` for rate limiting logic in authenticated routes instead of relying on `req.headers["x-forwarded-for"]` or `req.socket.remoteAddress`.
