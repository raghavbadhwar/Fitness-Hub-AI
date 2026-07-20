## 2024-05-14 - IP Spoofing via Unvalidated Header

**Vulnerability:** The API server's clerk proxy middleware manually parsed the `x-forwarded-for` header from incoming requests to determine the client IP address. Because this header is client-controlled, a malicious actor could send a spoofed `x-forwarded-for` header to bypass IP-based logging, rate limiting, or to mask their true origin in the proxy request.
**Learning:** Manually parsing `x-forwarded-for` directly from `req.headers` skips the framework's secure handling of proxy trust. When an Express application is running behind a trusted proxy (like a load balancer or ingress controller), the framework needs to be explicitly configured using `app.set("trust proxy", ...)` to securely parse the XFF header, starting from the most trusted proxy backwards.
**Prevention:** Always use `req.ip` in Express (or the equivalent secure accessor in other frameworks) rather than reading `req.headers["x-forwarded-for"]` directly. Ensure the application's `trust proxy` setting is correctly configured for the deployment environment so that `req.ip` returns the true client IP instead of a spoofed or intermediate proxy IP.

## 2024-07-20 - Unhandled URL Parsing in Node.js Server

**Vulnerability:** A Denial of Service (DoS) vulnerability existed in the static Expo server where an invalid `host` header (e.g., `%foo`) passed into `new URL(...)` caused an uncaught `TypeError: Invalid URL`, crashing the raw Node.js server.
**Learning:** Constructing a `new URL()` with client-controlled, potentially malformed input (like `req.headers.host`) is unsafe. Providing a fallback string is insufficient if the base URL becomes invalid.
**Prevention:** Always wrap `new URL()` parsing in a `try-catch` block to handle invalid inputs safely, especially in raw Node.js servers where Express middleware does not act as a safety net.
