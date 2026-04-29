## 2024-04-29 - Rate Limit Spoofing Vulnerability Fixed

**Vulnerability:** Rate limiting implementation on authenticated endpoints (like `/api/ai/chat`) relied on `x-forwarded-for` headers and IP addresses, which can be easily spoofed to bypass limits.
**Learning:** The `x-forwarded-for` header can be manipulated by malicious actors to bypass rate limits, rendering IP-based rate limiting ineffective on publicly accessible routes.
**Prevention:** Always use a secure, non-spoofable identifier like an authenticated `userId` for rate limiting when the route requires authentication.
