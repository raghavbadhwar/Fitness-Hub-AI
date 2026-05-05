## 2026-05-05 - IP Spoofing Risk in AI Rate Limiting
**Vulnerability:** The rate limiter for the AI endpoints relied on `x-forwarded-for` and the connection's remote IP address to track request counts. Because `x-forwarded-for` can be easily manipulated by users, an attacker could spoof IP addresses to bypass rate limiting completely.
**Learning:** This existed because IP tracking is a common default for rate-limiting, but in authenticated endpoints it ignores the stronger identity provided by the user session.
**Prevention:** In authenticated Express endpoints, always prefer relying on the authenticated `userId` (e.g., using Clerk's `getAuth(req)?.userId`) over connection-level headers to limit abuse.
