## 2025-02-14 - Fix Protocol Spoofing Vulnerability in Clerk Proxy
**Vulnerability:** The Clerk proxy middleware manually extracted the protocol from `req.headers["x-forwarded-proto"]` instead of using the secure Express `req.protocol`.
**Learning:** Blindly trusting `x-forwarded-proto` or `host` headers bypasses Express's `trust proxy` configuration, potentially allowing attackers to spoof the protocol.
**Prevention:** Rely on Express's built-in `req.protocol`, `req.get("host")`, and `req.ip`, which correctly validate forwarded headers against the configured `trust proxy` settings.
