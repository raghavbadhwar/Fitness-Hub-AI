## 2026-04-26 - [Rate Limiting bypass fix]
**Vulnerability:** The app had an IP-based rate-limiting middleware that relied on `x-forwarded-for` headers, which can be easily spoofed, allowing attackers to bypass rate limits or exhaust server memory.
**Learning:** For authenticated API routes, identifying users by `x-forwarded-for` header is not secure and can be bypassed by attackers modifying their headers.
**Prevention:** Rely on authenticated identities like `userId` (via `getAuth(req)`) rather than client IPs for rate-limiting wherever possible.
