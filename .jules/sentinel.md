## 2024-05-14 - IP Spoofing via Unvalidated Header

**Vulnerability:** The API server's clerk proxy middleware manually parsed the `x-forwarded-for` header from incoming requests to determine the client IP address. Because this header is client-controlled, a malicious actor could send a spoofed `x-forwarded-for` header to bypass IP-based logging, rate limiting, or to mask their true origin in the proxy request.
**Learning:** Manually parsing `x-forwarded-for` directly from `req.headers` skips the framework's secure handling of proxy trust. When an Express application is running behind a trusted proxy (like a load balancer or ingress controller), the framework needs to be explicitly configured using `app.set("trust proxy", ...)` to securely parse the XFF header, starting from the most trusted proxy backwards.
**Prevention:** Always use `req.ip` in Express (or the equivalent secure accessor in other frameworks) rather than reading `req.headers["x-forwarded-for"]` directly. Ensure the application's `trust proxy` setting is correctly configured for the deployment environment so that `req.ip` returns the true client IP instead of a spoofed or intermediate proxy IP.

## 2024-05-27 - Protocol and Host Header Injection

**Vulnerability:** The API server's clerk proxy middleware manually parsed `req.headers["x-forwarded-proto"]` and `req.headers.host` from incoming requests to determine the protocol and host for the proxy URL. This is susceptible to spoofing and injection.
**Learning:** Manually parsing `x-forwarded-proto` and `host` headers is insecure as they can be manipulated by malicious actors. Instead, we should rely on Express's `req.protocol` and `req.get('host')` which respect the "trust proxy" settings and provide safer and more reliable ways to access this information.
**Prevention:** Always use `req.protocol` and `req.get('host')` instead of directly accessing `x-forwarded-proto` and `host` headers when building URLs in Express middleware.
