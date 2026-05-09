import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  apiErrorHandler,
  getRequestLogContext,
  setRequestLogContext,
} from "../../src/lib/logger.ts";

describe("request log context", () => {
  it("merges only safe operational context fields", () => {
    const res = { locals: {} };

    setRequestLogContext(res, {
      route: "/profiles/access-check",
      userId: " user_123 ",
      gymId: "gymos-main",
      role: "member",
    });

    assert.deepEqual(
      getRequestLogContext({ url: "/api/profiles/access-check?token=secret" }, res),
      {
        route: "/profiles/access-check",
        userId: "user_123",
        gymId: "gymos-main",
        role: "member",
      },
    );
  });

  it("logs unhandled API errors with request id and safe route context", () => {
    const logged = [];
    const req = {
      id: "req-123",
      url: "/api/broken?token=secret",
      log: {
        error(payload, message) {
          logged.push({ payload, message });
        },
      },
    };
    const res = {
      locals: {
        requestLogContext: {
          route: "/broken",
          userId: "user_123",
          gymId: "gymos-main",
          role: "owner",
        },
      },
      headersSent: false,
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

    apiErrorHandler(new Error("boom"), req, res, () => {
      assert.fail("next should not run when headers have not been sent");
    });

    assert.equal(logged.length, 1);
    assert.equal(logged[0].message, "Unhandled API error");
    assert.equal(logged[0].payload.route, "/broken");
    assert.equal(logged[0].payload.userId, "user_123");
    assert.equal(logged[0].payload.gymId, "gymos-main");
    assert.equal(logged[0].payload.role, "owner");
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { error: "Internal server error", requestId: "req-123" });
  });
});
