## 2025-05-10 - IP Spoofing via X-Forwarded-For Header

**Vulnerability:** The Express `clerkProxyMiddleware` manually extracted and trusted the `x-forwarded-for` HTTP header to determine the client's IP address.
**Learning:** Blindly trusting `x-forwarded-for` allows malicious actors to easily spoof their IP address. Express provides a built-in `req.ip` property that, when paired with the `trust proxy` configuration, securely resolves the client IP, preventing spoofing attacks.
**Prevention:** Always rely on Express's `req.ip` and configure `app.set('trust proxy', ...)` appropriately rather than manually parsing proxy headers.
