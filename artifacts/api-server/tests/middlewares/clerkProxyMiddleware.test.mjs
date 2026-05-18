import assert from "node:assert/strict";
import { describe, it, mock, beforeEach, afterEach } from "node:test";

let mockCreateProxyMiddlewareConfig = null;

mock.module("http-proxy-middleware", {
  namedExports: {
    createProxyMiddleware(config) {
      mockCreateProxyMiddlewareConfig = config;
      return (_req, res) => {
        res.setHeader("X-Mock-Proxy", "true");
        res.end();
      };
    },
  },
});

const { clerkProxyMiddleware, CLERK_PROXY_PATH } =
  await import("../../src/middlewares/clerkProxyMiddleware.ts");

describe("clerkProxyMiddleware", () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    mockCreateProxyMiddlewareConfig = null;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("skips proxy when CLERK_PROXY_ENABLED=false", () => {
    process.env.CLERK_PROXY_ENABLED = "false";
    process.env.CLERK_SECRET_KEY = "test_secret_key";

    const middleware = clerkProxyMiddleware();
    let nextCalled = false;

    middleware({}, {}, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true, "next() should be called");
    assert.equal(
      mockCreateProxyMiddlewareConfig,
      null,
      "createProxyMiddleware should not be called",
    );
  });

  it("throws when CLERK_PROXY_ENABLED is missing", () => {
    delete process.env.CLERK_PROXY_ENABLED;
    process.env.CLERK_SECRET_KEY = "test_secret_key";

    assert.throws(() => clerkProxyMiddleware(), /CLERK_PROXY_ENABLED must be set/);
  });

  it("throws when CLERK_PROXY_ENABLED is not a boolean string", () => {
    process.env.CLERK_PROXY_ENABLED = "yes";
    process.env.CLERK_SECRET_KEY = "test_secret_key";

    assert.throws(() => clerkProxyMiddleware(), /CLERK_PROXY_ENABLED must be either/);
  });

  it("throws when CLERK_SECRET_KEY is missing and proxy is enabled", () => {
    process.env.CLERK_PROXY_ENABLED = "true";
    delete process.env.CLERK_SECRET_KEY;

    assert.throws(
      () => clerkProxyMiddleware(),
      /CLERK_SECRET_KEY is required when CLERK_PROXY_ENABLED=true/,
    );
  });

  it("configures proxy correctly when enabled", () => {
    process.env.CLERK_PROXY_ENABLED = "true";
    process.env.CLERK_SECRET_KEY = "test_secret_key";

    clerkProxyMiddleware();
    assert.ok(mockCreateProxyMiddlewareConfig, "createProxyMiddleware should be called");

    assert.equal(mockCreateProxyMiddlewareConfig.target, "https://frontend-api.clerk.dev");
    assert.equal(mockCreateProxyMiddlewareConfig.changeOrigin, true);
    assert.equal(typeof mockCreateProxyMiddlewareConfig.pathRewrite, "function");

    // Test pathRewrite logic
    const rewrittenPath = mockCreateProxyMiddlewareConfig.pathRewrite(
      `${CLERK_PROXY_PATH}/some/path`,
    );
    assert.equal(rewrittenPath, "/some/path", "pathRewrite should strip CLERK_PROXY_PATH");
  });

  it("injects proper headers in on.proxyReq", () => {
    process.env.CLERK_PROXY_ENABLED = "true";
    process.env.CLERK_SECRET_KEY = "test_secret_key";

    clerkProxyMiddleware(); // Initialize to capture config
    const onProxyReq = mockCreateProxyMiddlewareConfig.on.proxyReq;

    const setHeaders = new Map();
    const mockProxyReq = {
      setHeader(key, value) {
        setHeaders.set(key, value);
      },
    };

    const mockReq = {
      headers: {
        host: "example.com",
      },
      protocol: "https",
      ip: "192.168.1.1",
    };

    onProxyReq(mockProxyReq, mockReq);

    assert.equal(setHeaders.get("Clerk-Proxy-Url"), `https://example.com${CLERK_PROXY_PATH}`);
    assert.equal(setHeaders.get("Clerk-Secret-Key"), "test_secret_key");
    assert.equal(setHeaders.get("X-Forwarded-For"), "192.168.1.1");
  });

  it("handles missing req.headers gracefully in on.proxyReq", () => {
    process.env.CLERK_PROXY_ENABLED = "true";
    process.env.CLERK_SECRET_KEY = "test_secret_key";

    clerkProxyMiddleware(); // Initialize to capture config
    const onProxyReq = mockCreateProxyMiddlewareConfig.on.proxyReq;

    const setHeaders = new Map();
    const mockProxyReq = {
      setHeader(key, value) {
        setHeaders.set(key, value);
      },
    };

    const mockReq = {
      headers: {},
      socket: {
        remoteAddress: "127.0.0.1",
      },
    };

    onProxyReq(mockProxyReq, mockReq);

    // Should fallback to https if protocol is missing, and empty host if host missing
    assert.equal(setHeaders.get("Clerk-Proxy-Url"), `https://${CLERK_PROXY_PATH}`);
    assert.equal(setHeaders.get("Clerk-Secret-Key"), "test_secret_key");
    assert.equal(setHeaders.get("X-Forwarded-For"), "127.0.0.1"); // fallback to req.socket.remoteAddress
  });
});
