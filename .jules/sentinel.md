## 2024-05-11 - IP Spoofing via Manual Header Extraction

**Vulnerability:** The `clerkProxyMiddleware` manually extracted the client IP from the `x-forwarded-for` header, which could allow malicious actors to easily spoof their IP address.
**Learning:** Express has built-in, secure mechanisms for handling IP addresses behind proxies via `req.ip` when the `trust proxy` setting is configured correctly. Manual extraction bypasses these safeguards.
**Prevention:** Always use `req.ip` instead of manually parsing `req.headers['x-forwarded-for']` to ensure IP addresses are handled according to the server's proxy trust configuration.
