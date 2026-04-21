import assert from "node:assert/strict";
import { describe, it, mock, beforeEach, afterEach } from "node:test";

let mockCreateProxyMiddlewareConfig = null;

mock.module("http-proxy-middleware", {
  namedExports: {
    createProxyMiddleware(config) {
      mockCreateProxyMiddlewareConfig = config;
      return (req, res, next) => {
        res.setHeader("X-Mock-Proxy", "true");
        res.end();
      };
    },
  },
});

const { clerkProxyMiddleware, CLERK_PROXY_PATH } = await import("../../src/middlewares/clerkProxyMiddleware.ts");

describe("clerkProxyMiddleware", () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    mockCreateProxyMiddlewareConfig = null;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("skips proxy in development mode", () => {
    process.env.NODE_ENV = "development";
    process.env.CLERK_SECRET_KEY = "test_secret_key";

    const middleware = clerkProxyMiddleware();
    let nextCalled = false;

    middleware({}, {}, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true, "next() should be called");
    assert.equal(mockCreateProxyMiddlewareConfig, null, "createProxyMiddleware should not be called");
  });

  it("skips proxy when CLERK_SECRET_KEY is missing", () => {
    process.env.NODE_ENV = "production";
    delete process.env.CLERK_SECRET_KEY;

    const middleware = clerkProxyMiddleware();
    let nextCalled = false;

    middleware({}, {}, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true, "next() should be called");
    assert.equal(mockCreateProxyMiddlewareConfig, null, "createProxyMiddleware should not be called");
  });

  it("configures proxy correctly in production", () => {
    process.env.NODE_ENV = "production";
    process.env.CLERK_SECRET_KEY = "test_secret_key";

    const middleware = clerkProxyMiddleware();
    assert.ok(mockCreateProxyMiddlewareConfig, "createProxyMiddleware should be called");

    assert.equal(mockCreateProxyMiddlewareConfig.target, "https://frontend-api.clerk.dev");
    assert.equal(mockCreateProxyMiddlewareConfig.changeOrigin, true);
    assert.equal(typeof mockCreateProxyMiddlewareConfig.pathRewrite, "function");

    // Test pathRewrite logic
    const rewrittenPath = mockCreateProxyMiddlewareConfig.pathRewrite(`${CLERK_PROXY_PATH}/some/path`);
    assert.equal(rewrittenPath, "/some/path", "pathRewrite should strip CLERK_PROXY_PATH");
  });

  it("injects proper headers in on.proxyReq", () => {
    process.env.NODE_ENV = "production";
    process.env.CLERK_SECRET_KEY = "test_secret_key";

    clerkProxyMiddleware(); // Initialize to capture config
    const onProxyReq = mockCreateProxyMiddlewareConfig.on.proxyReq;

    const setHeaders = new Map();
    const mockProxyReq = {
      setHeader(key, value) {
        setHeaders.set(key, value);
      }
    };

    const mockReq = {
      headers: {
        "x-forwarded-proto": "https",
        host: "example.com",
        "x-forwarded-for": "192.168.1.1, 10.0.0.1"
      }
    };

    onProxyReq(mockProxyReq, mockReq);

    assert.equal(setHeaders.get("Clerk-Proxy-Url"), `https://example.com${CLERK_PROXY_PATH}`);
    assert.equal(setHeaders.get("Clerk-Secret-Key"), "test_secret_key");
    assert.equal(setHeaders.get("X-Forwarded-For"), "192.168.1.1");
  });

  it("handles missing req.headers gracefully in on.proxyReq", () => {
    process.env.NODE_ENV = "production";
    process.env.CLERK_SECRET_KEY = "test_secret_key";

    clerkProxyMiddleware(); // Initialize to capture config
    const onProxyReq = mockCreateProxyMiddlewareConfig.on.proxyReq;

    const setHeaders = new Map();
    const mockProxyReq = {
      setHeader(key, value) {
        setHeaders.set(key, value);
      }
    };

    const mockReq = {
      headers: {},
      socket: {
        remoteAddress: "127.0.0.1"
      }
    };

    onProxyReq(mockProxyReq, mockReq);

    // Should fallback to https if x-forwarded-proto is missing, and empty host if host missing
    assert.equal(setHeaders.get("Clerk-Proxy-Url"), `https://${CLERK_PROXY_PATH}`);
    assert.equal(setHeaders.get("Clerk-Secret-Key"), "test_secret_key");
    assert.equal(setHeaders.get("X-Forwarded-For"), "127.0.0.1"); // fallback to req.socket.remoteAddress
  });
});
