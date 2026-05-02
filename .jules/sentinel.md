## 2024-05-24 - Rate Limiting IP Spoofing Bypass

**Vulnerability:** IP-based rate limiting on authenticated endpoints relied entirely on `x-forwarded-for` or IP address headers, allowing an attacker to spoof headers and easily bypass the rate limits.
**Learning:** For endpoints protected by authentication middleware (e.g. `requireAuth`), the rate limit key should always rely on the authenticated user's unique identifier (`userId`), not external metadata like IP addresses which are prone to tampering.
**Prevention:** In authenticated contexts, use `getAuth(req).userId` from Clerk as the primary identifier for applying rate limit constraints, removing reliance on IP addresses as the primary constraint.
