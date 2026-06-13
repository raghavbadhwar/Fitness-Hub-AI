## 2024-05-14 - IP Spoofing via Unvalidated Header

**Vulnerability:** The API server's clerk proxy middleware manually parsed the `x-forwarded-for` header from incoming requests to determine the client IP address. Because this header is client-controlled, a malicious actor could send a spoofed `x-forwarded-for` header to bypass IP-based logging, rate limiting, or to mask their true origin in the proxy request.
**Learning:** Manually parsing `x-forwarded-for` directly from `req.headers` skips the framework's secure handling of proxy trust. When an Express application is running behind a trusted proxy (like a load balancer or ingress controller), the framework needs to be explicitly configured using `app.set("trust proxy", ...)` to securely parse the XFF header, starting from the most trusted proxy backwards.
**Prevention:** Always use `req.ip` in Express (or the equivalent secure accessor in other frameworks) rather than reading `req.headers["x-forwarded-for"]` directly. Ensure the application's `trust proxy` setting is correctly configured for the deployment environment so that `req.ip` returns the true client IP instead of a spoofed or intermediate proxy IP.

## 2025-06-13 - Express Request Protocol and Host Header Vulnerabilities

**Vulnerability:** The application was vulnerable to Host header injection and potentially HTTP protocol spoofing because `req.headers.host` and `req.headers["x-forwarded-proto"]` were read directly from the request instead of using Express's validated `req.get('host')` and `req.protocol` helpers when `trust proxy` is configured.
**Learning:** `req.headers.host` does not get any Express processing. To safely access these values in a trusted proxy environment, the Express Request API (`req.protocol`, `req.get("host")`, `req.ip`) must be used, which appropriately applies `trust proxy` validation settings.
**Prevention:** In Express applications and middlewares (like `http-proxy-middleware`), always cast `req` to the Express `Request` type and utilize `req.protocol`, `req.ip`, and `req.get("host")` rather than accessing raw headers directly.
