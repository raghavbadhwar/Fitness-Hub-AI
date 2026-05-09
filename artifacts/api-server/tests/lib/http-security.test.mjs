import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  configureTrustProxy,
  getConfiguredCorsOrigins,
  createSecurityHeadersMiddleware,
  isAllowedCorsOrigin,
  isLoopbackOrigin,
  normalizeOrigin,
} from "../../src/lib/http-security.ts";

describe("http security helpers", () => {
  it("normalizes configured CORS origins from URL and host values", () => {
    const origins = getConfiguredCorsOrigins({
      CORS_ALLOWED_ORIGINS: "https://admin.example.com, member.example.com",
      VERCEL_URL: "fitness-hub.vercel.app",
    });

    assert.deepEqual([...origins].sort(), [
      "https://admin.example.com",
      "https://fitness-hub.vercel.app",
      "https://member.example.com",
    ]);
  });

  it("allows loopback origins only outside production", () => {
    assert.equal(normalizeOrigin("localhost:4173"), "https://localhost:4173");
    assert.equal(isLoopbackOrigin("http://localhost:4173"), true);
    assert.equal(
      isAllowedCorsOrigin({
        origin: "http://localhost:4173",
        allowedOrigins: new Set(),
        isProduction: false,
      }),
      true,
    );
    assert.equal(
      isAllowedCorsOrigin({
        origin: "http://localhost:4173",
        allowedOrigins: new Set(),
        isProduction: true,
      }),
      false,
    );
  });

  it("configures trust proxy from explicit env before Vercel fallback", () => {
    const app = {
      values: new Map(),
      set(key, value) {
        this.values.set(key, value);
      },
    };

    configureTrustProxy(app, { TRUST_PROXY: "2", VERCEL: "1" });
    assert.equal(app.values.get("trust proxy"), 2);
  });

  it("sets API security headers without blocking the next middleware", () => {
    const headers = new Map();
    let nextCalled = false;
    const middleware = createSecurityHeadersMiddleware();

    middleware(
      {},
      {
        setHeader(name, value) {
          headers.set(name, value);
        },
      },
      () => {
        nextCalled = true;
      },
    );

    assert.equal(nextCalled, true);
    assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
    assert.equal(headers.get("X-Frame-Options"), "DENY");
    assert.equal(headers.get("Referrer-Policy"), "no-referrer");
    assert.equal(headers.get("Cross-Origin-Resource-Policy"), "same-site");
    assert.equal(headers.get("Permissions-Policy"), "camera=(), geolocation=(), microphone=()");
    assert.match(headers.get("Content-Security-Policy"), /default-src 'none'/);
    assert.match(headers.get("Content-Security-Policy"), /frame-ancestors 'none'/);
  });
});
