## 2024-05-14 - IP Spoofing via Unvalidated Header

**Vulnerability:** The API server's clerk proxy middleware manually parsed the `x-forwarded-for` header from incoming requests to determine the client IP address. Because this header is client-controlled, a malicious actor could send a spoofed `x-forwarded-for` header to bypass IP-based logging, rate limiting, or to mask their true origin in the proxy request.
**Learning:** Manually parsing `x-forwarded-for` directly from `req.headers` skips the framework's secure handling of proxy trust. When an Express application is running behind a trusted proxy (like a load balancer or ingress controller), the framework needs to be explicitly configured using `app.set("trust proxy", ...)` to securely parse the XFF header, starting from the most trusted proxy backwards.
**Prevention:** Always use `req.ip` in Express (or the equivalent secure accessor in other frameworks) rather than reading `req.headers["x-forwarded-for"]` directly. Ensure the application's `trust proxy` setting is correctly configured for the deployment environment so that `req.ip` returns the true client IP instead of a spoofed or intermediate proxy IP.

## 2026-08-01 - Prevent DoS via Unhandled Invalid URL Parsing

**Vulnerability:** Constructing a `new URL()` in Node.js using unvalidated client-controlled headers (like `req.headers.host`) can lead to uncaught exceptions (e.g., `TypeError: Invalid URL`) if the header contains malformed input, crashing the server process and causing a Denial of Service (DoS).
**Learning:** Providing a fallback string (e.g., `req.headers.host || 'localhost'`) does not prevent crashes if the header value exists but is invalid (e.g., contains `%foo`).
**Prevention:** Always wrap `new URL()` parsing in a `try-catch` block when using client-provided data as the base URL, or use a strictly validated host, to handle invalid inputs gracefully without bringing down the server.
