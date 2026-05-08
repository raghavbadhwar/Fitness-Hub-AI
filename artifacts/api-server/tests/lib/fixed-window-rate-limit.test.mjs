import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import {
  createFixedWindowRateLimiter,
  createFixedWindowRateLimitStore,
} from "../../src/lib/fixed-window-rate-limit.ts";

async function invokeMiddleware(middleware, req = {}) {
  let nextCalled = false;
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  await middleware(req, res, () => {
    nextCalled = true;
  });

  return { nextCalled, res };
}

describe("fixed-window rate limiter", () => {
  it("limits repeated requests for the same key until the window resets", async (t) => {
    let now = 1_000;
    const dateNow = mock.method(Date, "now", () => now);
    t.after(() => dateNow.mock.restore());

    const limiter = createFixedWindowRateLimiter({
      windowMs: 1_000,
      maxRequests: 2,
      getKey: () => "user:member_1",
    });

    assert.equal((await invokeMiddleware(limiter)).nextCalled, true);
    assert.equal((await invokeMiddleware(limiter)).nextCalled, true);

    const limited = await invokeMiddleware(limiter);
    assert.equal(limited.nextCalled, false);
    assert.equal(limited.res.statusCode, 429);

    now = 2_001;
    assert.equal((await invokeMiddleware(limiter)).nextCalled, true);
  });

  it("caps tracked keys by evicting the oldest entry", async () => {
    const limiter = createFixedWindowRateLimiter({
      windowMs: 60_000,
      maxRequests: 10,
      maxKeys: 2,
      pruneIntervalMs: 0,
      getKey: (req) => req.key,
    });

    assert.equal((await invokeMiddleware(limiter, { key: "first" })).nextCalled, true);
    assert.equal((await invokeMiddleware(limiter, { key: "second" })).nextCalled, true);
    assert.equal((await invokeMiddleware(limiter, { key: "third" })).nextCalled, true);

    assert.equal((await invokeMiddleware(limiter, { key: "first" })).nextCalled, true);
  });

  it("can use an injected shared store without changing limiter behavior", async () => {
    const calls = [];
    const limiter = createFixedWindowRateLimiter({
      windowMs: 60_000,
      maxRequests: 1,
      getKey: (req) => req.key,
      store: {
        increment(args) {
          calls.push(args);
          return { count: calls.length, resetAt: args.now + args.windowMs };
        },
      },
    });

    assert.equal((await invokeMiddleware(limiter, { key: "member_1" })).nextCalled, true);
    const limited = await invokeMiddleware(limiter, { key: "member_1" });

    assert.equal(limited.nextCalled, false);
    assert.equal(limited.res.statusCode, 429);
    assert.deepEqual(
      calls.map((call) => call.key),
      ["member_1", "member_1"],
    );
  });

  it("creates an external HTTP store for production shared counters", async () => {
    const requests = [];
    const store = createFixedWindowRateLimitStore({
      env: {
        AI_RATE_LIMIT_STORE: "external-http",
        AI_RATE_LIMIT_EXTERNAL_URL: "https://rate-limit.example.com/increment",
        AI_RATE_LIMIT_EXTERNAL_TOKEN: "test-token",
      },
      fetchImpl: async (url, init) => {
        requests.push({ url: String(url), init });
        return new Response(JSON.stringify({ count: 2, resetAt: 12_345 }), { status: 200 });
      },
    });

    const entry = await store.increment({ key: "user:member_1", now: 1_000, windowMs: 60_000 });

    assert.deepEqual(entry, { count: 2, resetAt: 12_345 });
    assert.equal(requests[0].url, "https://rate-limit.example.com/increment");
    assert.deepEqual(requests[0].init.headers, {
      "Content-Type": "application/json",
      Authorization: "Bearer test-token",
    });
    assert.equal(
      requests[0].init.body,
      JSON.stringify({
        algorithm: "fixed-window",
        key: "user:member_1",
        now: 1_000,
        windowMs: 60_000,
      }),
    );
  });

  it("requires an external endpoint when external HTTP storage is selected", () => {
    assert.throws(
      () => createFixedWindowRateLimitStore({ env: { AI_RATE_LIMIT_STORE: "external-http" } }),
      /AI_RATE_LIMIT_EXTERNAL_URL/,
    );
  });
});
