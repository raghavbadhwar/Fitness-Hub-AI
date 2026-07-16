## 2024-05-14 - IP Spoofing via Unvalidated Header

**Vulnerability:** The API server's clerk proxy middleware manually parsed the `x-forwarded-for` header from incoming requests to determine the client IP address. Because this header is client-controlled, a malicious actor could send a spoofed `x-forwarded-for` header to bypass IP-based logging, rate limiting, or to mask their true origin in the proxy request.
**Learning:** Manually parsing `x-forwarded-for` directly from `req.headers` skips the framework's secure handling of proxy trust. When an Express application is running behind a trusted proxy (like a load balancer or ingress controller), the framework needs to be explicitly configured using `app.set("trust proxy", ...)` to securely parse the XFF header, starting from the most trusted proxy backwards.
**Prevention:** Always use `req.ip` in Express (or the equivalent secure accessor in other frameworks) rather than reading `req.headers["x-forwarded-for"]` directly. Ensure the application's `trust proxy` setting is correctly configured for the deployment environment so that `req.ip` returns the true client IP instead of a spoofed or intermediate proxy IP.

## 2024-07-16 - Host Header Injection in Raw Node.js Servers

**Vulnerability:** The static Expo build server (`serve.js`) was manually parsing the client-controlled `x-forwarded-host` header from incoming requests to build base URLs for the application. Because it is a raw Node.js server lacking a framework-level proxy trust mechanism, attackers could easily spoof this header to perform Host Header Injection or Server-Side Request Forgery (SSRF) attacks against users loading the landing page.
**Learning:** In raw Node.js servers without a verified `trust proxy` configuration, blindly trusting `x-forwarded-host` or other proxy headers introduces severe vulnerabilities because the server has no way of distinguishing between legitimate load balancer headers and spoofed attacker headers.
**Prevention:** Never use `x-forwarded-host` in raw Node.js environments. Always rely on the standard `host` header, which is inherently safer.
