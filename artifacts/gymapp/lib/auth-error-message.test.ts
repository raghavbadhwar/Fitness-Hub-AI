import assert from "node:assert/strict";
import { test } from "node:test";

import { authFieldErrorMessage, authFormErrorMessage } from "./auth-error-message.ts";

test("returns field messages from structured auth field errors", () => {
  const message = authFieldErrorMessage(
    {
      fields: {
        emailAddress: { message: "Enter a valid email address." },
      },
    },
    "emailAddress",
  );

  assert.equal(message, "Enter a valid email address.");
});

test("returns field messages from Clerk error arrays", () => {
  const message = authFieldErrorMessage(
    {
      errors: [
        {
          message: "Password is too short.",
          longMessage: "Password must be at least 8 characters.",
          meta: { paramName: "password" },
        },
      ],
    },
    "password",
  );

  assert.equal(message, "Password must be at least 8 characters.");
});

test("does not stringify raw auth error payloads", () => {
  const source = {
    errors: [
      {
        code: "form_identifier_exists",
        message: "Email is already taken.",
        meta: { paramName: "emailAddress", debug: { token: "secret" } },
      },
    ],
  };

  assert.equal(authFormErrorMessage(source), "Email is already taken.");
  assert.doesNotMatch(authFormErrorMessage(source) ?? "", /secret|form_identifier_exists/);
});
