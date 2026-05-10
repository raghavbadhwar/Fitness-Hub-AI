## 2024-05-10 - IP Spoofing via X-Forwarded-For

**Vulnerability:** IP spoofing in `clerkProxyMiddleware` due to manually parsing the `x-forwarded-for` header instead of using `req.ip`.
**Learning:** `req.ip` correctly relies on Express's "trust proxy" configuration to safely extract the IP address, whereas manually using `x-forwarded-for` ignores the trust proxy setup and allows malicious clients to provide spoofed IP addresses to bypass IP-based controls.
**Prevention:** Always use `req.ip` for IP address extraction in Express instead of manually reading the `x-forwarded-for` header, and ensure `app.set('trust proxy', ...)` is properly configured in the application initialization.
