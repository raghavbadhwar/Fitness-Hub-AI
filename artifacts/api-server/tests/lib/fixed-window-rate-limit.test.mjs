import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { createFixedWindowRateLimiter } from "../../src/lib/fixed-window-rate-limit.ts";

function invokeMiddleware(middleware, req = {}) {
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

  middleware(req, res, () => {
    nextCalled = true;
  });

  return { nextCalled, res };
}

describe("fixed-window rate limiter", () => {
  it("limits repeated requests for the same key until the window resets", (t) => {
    let now = 1_000;
    const dateNow = mock.method(Date, "now", () => now);
    t.after(() => dateNow.mock.restore());

    const limiter = createFixedWindowRateLimiter({
      windowMs: 1_000,
      maxRequests: 2,
      getKey: () => "user:member_1",
    });

    assert.equal(invokeMiddleware(limiter).nextCalled, true);
    assert.equal(invokeMiddleware(limiter).nextCalled, true);

    const limited = invokeMiddleware(limiter);
    assert.equal(limited.nextCalled, false);
    assert.equal(limited.res.statusCode, 429);

    now = 2_001;
    assert.equal(invokeMiddleware(limiter).nextCalled, true);
  });

  it("caps tracked keys by evicting the oldest entry", () => {
    const limiter = createFixedWindowRateLimiter({
      windowMs: 60_000,
      maxRequests: 10,
      maxKeys: 2,
      pruneIntervalMs: 0,
      getKey: (req) => req.key,
    });

    assert.equal(invokeMiddleware(limiter, { key: "first" }).nextCalled, true);
    assert.equal(invokeMiddleware(limiter, { key: "second" }).nextCalled, true);
    assert.equal(invokeMiddleware(limiter, { key: "third" }).nextCalled, true);

    assert.equal(invokeMiddleware(limiter, { key: "first" }).nextCalled, true);
  });
});
