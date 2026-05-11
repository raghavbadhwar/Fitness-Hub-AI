## 2025-02-14 - IP Spoofing via Manual Header Extraction

**Vulnerability:** Express middleware (`clerkProxyMiddleware.ts`) manually parsed the `x-forwarded-for` header to determine client IP. An attacker could spoof this header, bypassing rate limiting and misleading downstream APIs.
**Learning:** `req.headers["x-forwarded-for"]` contains user-controlled data and should not be trusted directly. Express's built-in `req.ip` securely handles IP extraction when `trust proxy` is correctly configured in the application.
**Prevention:** Always use `req.ip` in Express middleware instead of manually extracting IP addresses from request headers. Ensure the application properly configures `app.set('trust proxy', ...)` for the deployment environment.
