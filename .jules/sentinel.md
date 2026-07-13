## 2024-05-14 - IP Spoofing via Unvalidated Header

**Vulnerability:** The API server's clerk proxy middleware manually parsed the `x-forwarded-for` header from incoming requests to determine the client IP address. Because this header is client-controlled, a malicious actor could send a spoofed `x-forwarded-for` header to bypass IP-based logging, rate limiting, or to mask their true origin in the proxy request.
**Learning:** Manually parsing `x-forwarded-for` directly from `req.headers` skips the framework's secure handling of proxy trust. When an Express application is running behind a trusted proxy (like a load balancer or ingress controller), the framework needs to be explicitly configured using `app.set("trust proxy", ...)` to securely parse the XFF header, starting from the most trusted proxy backwards.
**Prevention:** Always use `req.ip` in Express (or the equivalent secure accessor in other frameworks) rather than reading `req.headers["x-forwarded-for"]` directly. Ensure the application's `trust proxy` setting is correctly configured for the deployment environment so that `req.ip` returns the true client IP instead of a spoofed or intermediate proxy IP.

## 2024-05-15 - Protocol & Host Header Spoofing Vulnerability

**Vulnerability:** The application was manually parsing client-controlled `x-forwarded-host` and `x-forwarded-proto` headers to determine the base URL and protocol for redirect paths in the Express clerk proxy and standalone node web server, which allows attackers to inject malicious hosts (Host Header Injection) and protocols (SSRF).
**Learning:** Blindly trusting `x-forwarded-*` headers without relying on the framework's secure proxy trust mechanics (or avoiding them altogether in untrusted environments) allows user-controlled inputs to dictate internal routing, potentially bypassing proxy controls or generating attacker-controlled URLs in responses.
**Prevention:** In Express, rely on securely configured `trust proxy` mechanisms and standard getters like `req.protocol` and `req.get('host')`. In raw node.js servers, strictly validate the standard `Host` header and do not parse `x-forwarded-*` headers.
