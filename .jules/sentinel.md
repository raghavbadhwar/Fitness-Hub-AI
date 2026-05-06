## 2025-02-24 - Rate limiting bypass

**Vulnerability:** Rate limiting on authenticated endpoints relied on IP addresses which can be spoofed using `X-Forwarded-For` headers.
**Learning:** For authenticated API routes, use `userId` from authentication context (e.g. `getAuth(req).userId`) instead of IPs for rate limiting to ensure it tracks the actual user making the request.
**Prevention:** Use user IDs or other authenticated identifiers for rate limits.
