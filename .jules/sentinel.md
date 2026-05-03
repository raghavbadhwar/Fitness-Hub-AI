## 2024-05-15 - Spoofable IP-Based Rate Limiting Bypass

**Vulnerability:** The AI endpoints in `api-server` used `req.headers["x-forwarded-for"]` or IP address for rate limiting instead of the authenticated user's ID. This allows an attacker to bypass rate limits by spoofing the `X-Forwarded-For` header or rotating IP addresses, potentially leading to resource exhaustion or abuse of AI APIs.
**Learning:** For authenticated endpoints, rate limiting should always rely on a secure, non-spoofable identifier like the user ID from the authentication context (e.g., Clerk `userId`), not IP addresses or HTTP headers.
**Prevention:** Always use `getAuth(req).userId` or a similarly secure identity token for rate limiting on authenticated API routes. Reserve IP-based rate limiting only for unauthenticated endpoints.
