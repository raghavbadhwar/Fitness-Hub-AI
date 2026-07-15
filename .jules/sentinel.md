## 2024-05-14 - IP Spoofing via Unvalidated Header

**Vulnerability:** The API server's clerk proxy middleware manually parsed the `x-forwarded-for` header from incoming requests to determine the client IP address. Because this header is client-controlled, a malicious actor could send a spoofed `x-forwarded-for` header to bypass IP-based logging, rate limiting, or to mask their true origin in the proxy request.
**Learning:** Manually parsing `x-forwarded-for` directly from `req.headers` skips the framework's secure handling of proxy trust. When an Express application is running behind a trusted proxy (like a load balancer or ingress controller), the framework needs to be explicitly configured using `app.set("trust proxy", ...)` to securely parse the XFF header, starting from the most trusted proxy backwards.
**Prevention:** Always use `req.ip` in Express (or the equivalent secure accessor in other frameworks) rather than reading `req.headers["x-forwarded-for"]` directly. Ensure the application's `trust proxy` setting is correctly configured for the deployment environment so that `req.ip` returns the true client IP instead of a spoofed or intermediate proxy IP.

## 2024-05-15 - Protocol Spoofing and Host Header Injection via Unvalidated Headers

**Vulnerability:** The API server's proxy middleware and the standalone static server blindly trusted `x-forwarded-proto` and `x-forwarded-host` headers. Since these are client-controllable, attackers can spoof the protocol or host, potentially bypassing security rules, enabling SSRF, or conducting Host Header Injection attacks.
**Learning:** Blindly reading `x-forwarded-*` headers circumvents Express's built-in `trust proxy` mechanism (which securely extracts these values when configured correctly). In raw Node.js without a proxy trust mechanism, these headers are inherently insecure.
**Prevention:** In Express, cast the request to `Request` (e.g. in `http-proxy-middleware` hooks) and use secure accessors like `req.protocol` and `req.hostname` (or `req.get("host")` to preserve port). In raw servers, stick to strict validation of the standard `host` header and use secure defaults for protocol.
