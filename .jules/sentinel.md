## 2024-05-14 - IP Spoofing via Unvalidated Header

**Vulnerability:** The API server's clerk proxy middleware manually parsed the `x-forwarded-for` header from incoming requests to determine the client IP address. Because this header is client-controlled, a malicious actor could send a spoofed `x-forwarded-for` header to bypass IP-based logging, rate limiting, or to mask their true origin in the proxy request.
**Learning:** Manually parsing `x-forwarded-for` directly from `req.headers` skips the framework's secure handling of proxy trust. When an Express application is running behind a trusted proxy (like a load balancer or ingress controller), the framework needs to be explicitly configured using `app.set("trust proxy", ...)` to securely parse the XFF header, starting from the most trusted proxy backwards.
**Prevention:** Always use `req.ip` in Express (or the equivalent secure accessor in other frameworks) rather than reading `req.headers["x-forwarded-for"]` directly. Ensure the application's `trust proxy` setting is correctly configured for the deployment environment so that `req.ip` returns the true client IP instead of a spoofed or intermediate proxy IP.

## 2024-07-28 - [CRITICAL] Prevent DoS & SSRF vulnerabilities in raw Node server

**Vulnerability:** The raw Node.js static server was susceptible to a DoS vulnerability because malformed HTTP `Host` headers passed into `new URL()` threw an uncaught `TypeError`, bringing down the server. It was also vulnerable to SSRF / Host Header Injection by blindly trusting the `x-forwarded-host` header for generating base URLs without proxy safeguards.
**Learning:** When dealing with client-controlled inputs like HTTP headers in raw Node.js without frameworks like Express handling the errors, `new URL()` parsing must always be wrapped in a `try-catch` block. Additionally, blindly reading `x-forwarded-host` bypasses proper proxy configuration and should not be trusted.
**Prevention:** Wrap `new URL()` in `try-catch` and fallback securely. When generating base URLs for landing pages, parse `x-forwarded-proto` to handle chained proxies and strictly use `req.headers.host` for the host instead of `x-forwarded-host`.
