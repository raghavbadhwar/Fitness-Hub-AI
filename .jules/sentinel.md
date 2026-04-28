## 2024-05-24 - Rate Limit Bypass via IP Spoofing on Authenticated Routes

**Vulnerability:** Rate limiting in `ai.ts` relied on IP addresses (`x-forwarded-for` headers), which can be easily spoofed by malicious actors to bypass the rate limits.
**Learning:** Using IP addresses for rate limiting on authenticated endpoints is a significant security gap. IP addresses are unreliable identifiers, especially behind proxies or when the `x-forwarded-for` header is trusted without validation.
**Prevention:** For authenticated routes, always tie rate limiting to the authenticated identity (e.g., `userId` from Clerk) rather than network-level identifiers like IP addresses.
