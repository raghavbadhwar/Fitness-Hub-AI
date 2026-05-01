## 2024-05-24 - Rate Limiting on Authenticated Routes
**Vulnerability:** Rate limiting relied on IP addresses or `x-forwarded-for` headers, which can be spoofed by an attacker, allowing them to bypass the limit and cause a DoS or drain resources.
**Learning:** IP-based rate limiting is insufficient for authenticated routes because an attacker can just spoof headers. `getAuth(req).userId` provides a secure identity tied to the user making the request.
**Prevention:** For authenticated routes, always use the authenticated user ID (`userId`) as the key for rate limiting instead of IP address or request headers.
