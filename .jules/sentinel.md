## 2024-05-14 - IP Spoofing via Unvalidated Header

**Vulnerability:** The API server's clerk proxy middleware manually parsed the `x-forwarded-for` header from incoming requests to determine the client IP address. Because this header is client-controlled, a malicious actor could send a spoofed `x-forwarded-for` header to bypass IP-based logging, rate limiting, or to mask their true origin in the proxy request.
**Learning:** Manually parsing `x-forwarded-for` directly from `req.headers` skips the framework's secure handling of proxy trust. When an Express application is running behind a trusted proxy (like a load balancer or ingress controller), the framework needs to be explicitly configured using `app.set("trust proxy", ...)` to securely parse the XFF header, starting from the most trusted proxy backwards.
**Prevention:** Always use `req.ip` in Express (or the equivalent secure accessor in other frameworks) rather than reading `req.headers["x-forwarded-for"]` directly. Ensure the application's `trust proxy` setting is correctly configured for the deployment environment so that `req.ip` returns the true client IP instead of a spoofed or intermediate proxy IP.

## 2024-07-21 - Uncaught URL Parsing DoS & Host Header Injection in Raw Node.js Server

**Vulnerability:** The raw Node.js server in `artifacts/gymapp/server/serve.js` blindly trusted `req.headers["x-forwarded-host"]` (Host Header Injection) and passed user-controlled `host` headers directly into `new URL(...)` without a try-catch block, resulting in a Denial of Service (DoS) crash when given malformed inputs like `%foo`.
**Learning:** In raw Node.js environments lacking Express's `trust proxy` mechanisms and robust error handling, blindly trusting headers or passing unvalidated headers to strict parsers like `new URL` can crash the entire application process or lead to SSRF vulnerabilities.
**Prevention:** Always wrap `new URL()` in a try-catch block when parsing client-controlled headers. Stop trusting `x-forwarded-host` unless explicitly deployed behind a secure proxy that strips spoofed headers, and always handle comma-separated lists in `x-forwarded-*` headers.
