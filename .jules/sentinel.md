## 2026-04-25 - [Secure AI Chat Rate Limiting]
**Vulnerability:** IP address spoofing in x-forwarded-for header for rate limiting AI Chat endpoints.
**Learning:** The rate limiter for the AI endpoint (`/api/ai/*`) was incorrectly extracting the IP address using the `x-forwarded-for` header and relying on it. Attackers can easily spoof this header if it's not stripped by a proxy, bypassing the rate limits entirely.
**Prevention:** Always use the authenticated user ID for rate limiting on authenticated API routes to prevent IP spoofing and avoid penalizing users on shared IPs.
