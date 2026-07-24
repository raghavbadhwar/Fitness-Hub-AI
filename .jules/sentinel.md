## 2024-05-14 - IP Spoofing via Unvalidated Header

**Vulnerability:** The API server's clerk proxy middleware manually parsed the `x-forwarded-for` header from incoming requests to determine the client IP address. Because this header is client-controlled, a malicious actor could send a spoofed `x-forwarded-for` header to bypass IP-based logging, rate limiting, or to mask their true origin in the proxy request.
**Learning:** Manually parsing `x-forwarded-for` directly from `req.headers` skips the framework's secure handling of proxy trust. When an Express application is running behind a trusted proxy (like a load balancer or ingress controller), the framework needs to be explicitly configured using `app.set("trust proxy", ...)` to securely parse the XFF header, starting from the most trusted proxy backwards.
**Prevention:** Always use `req.ip` in Express (or the equivalent secure accessor in other frameworks) rather than reading `req.headers["x-forwarded-for"]` directly. Ensure the application's `trust proxy` setting is correctly configured for the deployment environment so that `req.ip` returns the true client IP instead of a spoofed or intermediate proxy IP.

## 2024-07-24 - Fix Host Header Injection and URL Parse DoS in Expo Serve

**Vulnerability:**

1. Blindly trusting `x-forwarded-host` in `artifacts/gymapp/server/serve.js` without a `trust proxy` mechanism introduces SSRF and Host Header Injection vulnerabilities.
2. Constructing `new URL(...)` with unchecked `req.headers.host` can crash the Node.js process with a TypeError if the header is malformed, causing a Denial of Service (DoS).
3. Failing to handle chained, comma-separated `x-forwarded-proto` values.
   **Learning:** Raw Node.js servers handling proxy headers must manually implement secure fallbacks and error boundaries, as they lack Express's robust `trust proxy` protections. `new URL()` is strict and will crash on invalid inputs.
   **Prevention:** Never trust `x-forwarded-host` outside of a trusted proxy configuration. Always wrap `new URL()` inside a try-catch block to handle invalid inputs safely. Always process proxy headers expecting comma-separated values.
