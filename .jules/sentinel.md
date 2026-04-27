## 2024-04-27 - [High] IP-based rate limit bypass in authenticated routes

**Vulnerability:** Rate limiting on the `/api/ai/*` routes relied on `x-forwarded-for` headers and the socket's `remoteAddress`. Both of these can be easily spoofed or bypassed by attackers, rendering the rate limiting ineffective.
**Learning:** For authenticated API endpoints, rate limiting should always be tied to the authenticated user's identity (e.g., `userId` from Clerk) rather than network-level identifiers like IP addresses.
**Prevention:** Use `getAuth(req).userId` or a similar robust identity mechanism for rate limiting logic in all authenticated routes across the application.
