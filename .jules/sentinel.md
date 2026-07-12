## 2024-05-14 - IP Spoofing via Unvalidated Header

**Vulnerability:** The API server's clerk proxy middleware manually parsed the `x-forwarded-for` header from incoming requests to determine the client IP address. Because this header is client-controlled, a malicious actor could send a spoofed `x-forwarded-for` header to bypass IP-based logging, rate limiting, or to mask their true origin in the proxy request.
**Learning:** Manually parsing `x-forwarded-for` directly from `req.headers` skips the framework's secure handling of proxy trust. When an Express application is running behind a trusted proxy (like a load balancer or ingress controller), the framework needs to be explicitly configured using `app.set("trust proxy", ...)` to securely parse the XFF header, starting from the most trusted proxy backwards.
**Prevention:** Always use `req.ip` in Express (or the equivalent secure accessor in other frameworks) rather than reading `req.headers["x-forwarded-for"]` directly. Ensure the application's `trust proxy` setting is correctly configured for the deployment environment so that `req.ip` returns the true client IP instead of a spoofed or intermediate proxy IP.

## 2026-07-12 - Host Header Injection via Unvalidated Forwarded Host

**Vulnerability:** A raw Node.js server (`serve.js`) blindly trusted the `x-forwarded-host` and `x-forwarded-proto` headers without validation, causing those values to be injected into the response HTML (Host Header Injection) and potentially leading to Server-Side Request Forgery (SSRF) when parsing URLs.
**Learning:** In raw Node.js servers without a proxy trust mechanism (like Express's `trust proxy`), trusting client-controlled headers like `x-forwarded-host` or `x-forwarded-proto` introduces Host Header Injection and SSRF vulnerabilities because there is no framework validation verifying the proxy's origin.
**Prevention:** Blindly trusting `x-forwarded-host` or `x-forwarded-proto` headers in raw Node servers should be avoided. Always use secure defaults (like `https`) and strictly validate the standard `host` header instead.
