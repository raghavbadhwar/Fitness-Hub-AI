## 2024-05-14 - IP Spoofing via Unvalidated Header

**Vulnerability:** The API server's clerk proxy middleware manually parsed the `x-forwarded-for` header from incoming requests to determine the client IP address. Because this header is client-controlled, a malicious actor could send a spoofed `x-forwarded-for` header to bypass IP-based logging, rate limiting, or to mask their true origin in the proxy request.
**Learning:** Manually parsing `x-forwarded-for` directly from `req.headers` skips the framework's secure handling of proxy trust. When an Express application is running behind a trusted proxy (like a load balancer or ingress controller), the framework needs to be explicitly configured using `app.set("trust proxy", ...)` to securely parse the XFF header, starting from the most trusted proxy backwards.
**Prevention:** Always use `req.ip` in Express (or the equivalent secure accessor in other frameworks) rather than reading `req.headers["x-forwarded-for"]` directly. Ensure the application's `trust proxy` setting is correctly configured for the deployment environment so that `req.ip` returns the true client IP instead of a spoofed or intermediate proxy IP.

## 2024-06-14 - Fix Host Header Injection in Clerk Proxy Middleware
**Vulnerability:** The proxy middleware extracted the host from the raw `req.headers.host` and protocol from `req.headers["x-forwarded-proto"]` instead of using the secure Express properties. This can lead to host header injection or protocol spoofing if trust proxy is misconfigured or if an attacker sends forged headers.
**Learning:** Using `req.get("host")` and `req.protocol` is safer because they respect the application's `trust proxy` configuration and provide a more reliable way to determine the original host and protocol in a proxied environment.
**Prevention:** Always use `req.get("host")` or `req.hostname`, and `req.protocol` when determining the request origin in Express middleware, rather than directly reading raw headers.
