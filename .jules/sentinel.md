
## 2024-05-12 - Secure IP extraction from requests behind proxy
**Vulnerability:** IP spoofing via direct access to `req.headers["x-forwarded-for"]` array when parsing IP addresses.
**Learning:** Checking custom or nested arrays of proxy headers can allow malicious clients to spoof their original IPs simply by sending arbitrary headers since raw headers are not validated by the framework.
**Prevention:** Rely on Express's `req.ip` mechanism, ensuring the app is securely configured via `app.set('trust proxy')` to automatically strip untrusted segments.
