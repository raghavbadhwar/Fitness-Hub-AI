## 2024-05-13 - [HIGH] Prevent IP spoofing by respecting trust proxy configuration

**Vulnerability:** Manually extracting IP addresses from the `x-forwarded-for` header can allow an attacker to easily spoof their IP address by injecting their own `X-Forwarded-For` header in the request. In `clerkProxyMiddleware`, this could bypass security measures relying on accurate client IPs.
**Learning:** We must rely on Express's internal IP handling (`req.ip`) which natively integrates with the application's global `trust proxy` configuration. The framework inherently handles stripping off spoofed IPs and correctly extracting the real client IP based on the trusted proxy chain.
**Prevention:** Avoid blindly parsing `req.headers["x-forwarded-for"]`. Always use `req.ip` for IP-based logic in Express middleware and ensure `app.set('trust proxy', ...)` is correctly configured at the application level.
