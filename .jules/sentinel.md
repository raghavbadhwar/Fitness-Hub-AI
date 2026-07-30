## 2024-05-14 - IP Spoofing via Unvalidated Header

**Vulnerability:** The API server's clerk proxy middleware manually parsed the `x-forwarded-for` header from incoming requests to determine the client IP address. Because this header is client-controlled, a malicious actor could send a spoofed `x-forwarded-for` header to bypass IP-based logging, rate limiting, or to mask their true origin in the proxy request.
**Learning:** Manually parsing `x-forwarded-for` directly from `req.headers` skips the framework's secure handling of proxy trust. When an Express application is running behind a trusted proxy (like a load balancer or ingress controller), the framework needs to be explicitly configured using `app.set("trust proxy", ...)` to securely parse the XFF header, starting from the most trusted proxy backwards.
**Prevention:** Always use `req.ip` in Express (or the equivalent secure accessor in other frameworks) rather than reading `req.headers["x-forwarded-for"]` directly. Ensure the application's `trust proxy` setting is correctly configured for the deployment environment so that `req.ip` returns the true client IP instead of a spoofed or intermediate proxy IP.

## 2024-07-30 - Fix DoS via URL Parsing and Host Header Injection

**Vulnerability:** The raw Node.js HTTP server was crashing due to `TypeError: Invalid URL` when encountering malformed `Host` headers in `new URL()`, creating a DoS vector. Additionally, it blindly trusted the `x-forwarded-host` header for generating internal links and the `x-forwarded-proto` header wasn't sanitized against comma-separated list spoofing.
**Learning:** When dealing with raw Node.js `http` modules, there's no native proxy trust mechanism like Express. `new URL()` is strict and will throw unhandled exceptions (crashing the server) if the input host is maliciously formatted (e.g., `%foo`).
**Prevention:** Always wrap `new URL()` with a `try-catch` when feeding it client-controlled data like headers, and use a safe fallback or a `400 Bad Request` instead of letting it throw. Avoid reading `x-forwarded-host` unless specifically configuring proxy trust boundaries securely, relying instead on `req.headers.host`.
