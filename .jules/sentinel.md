## 2025-02-21 - Fix Rate Limiting Bypass Vulnerability in AI Endpoint
**Vulnerability:** The `/api/ai` endpoints implemented rate limiting using the `x-forwarded-for` HTTP header or the raw socket remote address to identify the client IP.
**Learning:** `x-forwarded-for` headers can be easily spoofed by attackers to bypass IP-based rate limiting entirely. Additionally, relying on user-provided IPs allows an attacker to artificially fill the rate limiter's tracking Map, which could cause a memory leak/exhaustion Denial-of-Service condition.
**Prevention:** For authenticated routes, tie rate limiters directly to the trusted user identity token (`userId` from Clerk authentication) rather than unreliable network-layer data.
