## 2025-05-04 - Fixed Rate Limiting Logic

**Vulnerability:** Rate limiting by IP address in `ai.ts` using `req.headers["x-forwarded-for"]` or `req.socket.remoteAddress` is susceptible to bypass if reverse proxies are not strictly configured, because the headers can easily be spoofed by attackers.

**Learning:** IP-based rate limiting on authenticated API endpoints provides weak protection when a more robust identifier like the `userId` is available.

**Prevention:** Always prefer using a secure user identifier (like `userId` from an auth context) for rate limiting on endpoints that require authentication, and fallback to IP only for public, unauthenticated routes. Ensure proper verification of headers if IP must be used.
