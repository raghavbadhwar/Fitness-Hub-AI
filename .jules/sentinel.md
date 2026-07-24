## 2024-05-14 - IP Spoofing via Unvalidated Header

**Vulnerability:** The API server's clerk proxy middleware manually parsed the `x-forwarded-for` header from incoming requests to determine the client IP address. Because this header is client-controlled, a malicious actor could send a spoofed `x-forwarded-for` header to bypass IP-based logging, rate limiting, or to mask their true origin in the proxy request.
**Learning:** Manually parsing `x-forwarded-for` directly from `req.headers` skips the framework's secure handling of proxy trust. When an Express application is running behind a trusted proxy (like a load balancer or ingress controller), the framework needs to be explicitly configured using `app.set("trust proxy", ...)` to securely parse the XFF header, starting from the most trusted proxy backwards.
**Prevention:** Always use `req.ip` in Express (or the equivalent secure accessor in other frameworks) rather than reading `req.headers["x-forwarded-for"]` directly. Ensure the application's `trust proxy` setting is correctly configured for the deployment environment so that `req.ip` returns the true client IP instead of a spoofed or intermediate proxy IP.

## 2024-07-24 - DoS via Uncaught Exception in URL Parsing

**Vulnerability:** The static file server directly constructed a `new URL()` using the client-controlled `req.headers.host` value. If an attacker supplied a malformed `Host` header (such as `%foo`), it would cause `new URL()` to throw a `TypeError: Invalid URL`. Without a `try-catch` block, this uncaught exception would crash the entire Node.js server process, leading to a Denial of Service (DoS) vulnerability.
**Learning:** Providing a default fallback value like `req.headers.host || "localhost"` is not sufficient to prevent `new URL()` from throwing an error if the first part of the expression is present but malformed.
**Prevention:** Always wrap `new URL()` parsing in a `try-catch` block when any part of the URL string is derived from client-controlled input, including HTTP headers. Handle the error gracefully by returning an appropriate HTTP response like 400 Bad Request.
