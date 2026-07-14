## 2024-05-14 - IP Spoofing via Unvalidated Header

**Vulnerability:** The API server's clerk proxy middleware manually parsed the `x-forwarded-for` header from incoming requests to determine the client IP address. Because this header is client-controlled, a malicious actor could send a spoofed `x-forwarded-for` header to bypass IP-based logging, rate limiting, or to mask their true origin in the proxy request.
**Learning:** Manually parsing `x-forwarded-for` directly from `req.headers` skips the framework's secure handling of proxy trust. When an Express application is running behind a trusted proxy (like a load balancer or ingress controller), the framework needs to be explicitly configured using `app.set("trust proxy", ...)` to securely parse the XFF header, starting from the most trusted proxy backwards.
**Prevention:** Always use `req.ip` in Express (or the equivalent secure accessor in other frameworks) rather than reading `req.headers["x-forwarded-for"]` directly. Ensure the application's `trust proxy` setting is correctly configured for the deployment environment so that `req.ip` returns the true client IP instead of a spoofed or intermediate proxy IP.

## 2024-05-24 - Fix Protocol Spoofing in Proxy Middleware

**Vulnerability:** Express proxy middleware (`clerkProxyMiddleware`) blindly trusted the `x-forwarded-proto` header from the client without strict validation or relying on Express's proxy trust rules. This allowed malicious actors to spoof the protocol (e.g., setting it to `http` or custom schemes), potentially leading to SSRF or bypassing TLS enforcement.
**Learning:** When proxying requests or constructing absolute URLs in Express, manually parsing raw proxy headers like `x-forwarded-proto` bypasses the framework's configured `trust proxy` mechanism and introduces spoofing vulnerabilities.
**Prevention:** Always use `req.protocol` rather than manually extracting `req.headers['x-forwarded-proto']`. Express securely resolves the protocol based on the application's trusted proxy configuration.

## 2024-05-24 - Fix Host Header Injection in Raw Node.js Static Server

**Vulnerability:** The standalone static Expo build server (`artifacts/gymapp/server/serve.js`) blindly trusted the `x-forwarded-host` and `x-forwarded-proto` headers when constructing the `baseUrl` for the landing page template. Since this is a raw Node.js server without a proxy trust mechanism, an attacker could inject arbitrary hosts via `x-forwarded-host`, leading to Host Header Injection and potentially Cross-Site Scripting (XSS) or Server-Side Request Forgery (SSRF) vulnerabilities in the rendered HTML.
**Learning:** In raw Node.js servers (unlike Express with `trust proxy` configured), blindly trusting proxy forwarding headers like `x-forwarded-host` is extremely dangerous because there's no built-in mechanism to verify the headers originated from a trusted reverse proxy.
**Prevention:** Never trust `x-forwarded-host` or `x-forwarded-proto` headers in raw Node servers without explicit, validated proxy trust logic. Always use secure defaults and strictly validate the standard `host` header instead.
