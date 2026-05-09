import assert from "node:assert/strict";
import { describe, it } from "node:test";

const modulePath = "../../src/lib/clerk-role-matrix.ts";

describe("clerk role matrix helpers", () => {
  it("blocks live Clerk mutations unless explicitly enabled", async () => {
    const { assertSafeClerkMutationEnv } = await import(modulePath);

    assert.throws(
      () =>
        assertSafeClerkMutationEnv({
          allowLiveMutation: false,
          secretKey: "sk_live_example",
        }),
      /Refusing to mutate a non-test Clerk instance/,
    );
  });

  it("allows Clerk test keys", async () => {
    const { assertSafeClerkMutationEnv } = await import(modulePath);

    assert.doesNotThrow(() =>
      assertSafeClerkMutationEnv({
        allowLiveMutation: false,
        secretKey: "sk_test_example",
      }),
    );
  });

  it("builds deterministic disposable personas without leaking credentials in summaries", async () => {
    const { buildRoleMatrixPersonas, summarizePersona } = await import(modulePath);

    const personas = buildRoleMatrixPersonas({
      emailDomain: "Example.COM",
      gymId: "gymos-main",
      password: "LocalOnlyPassword123!",
      runId: "Local Run_01",
    });

    assert.deepEqual(
      personas.map((persona) => [persona.key, persona.email, persona.role, persona.status]),
      [
        ["owner", "codex-fh-owner-local-run-01@example.com", "owner", "approved"],
        ["trainer", "codex-fh-trainer-local-run-01@example.com", "trainer", "approved"],
        ["member", "codex-fh-member-local-run-01@example.com", "member", "approved"],
        ["pendingMember", "codex-fh-pending-member-local-run-01@example.com", "member", "pending"],
        ["revokedMember", "codex-fh-revoked-member-local-run-01@example.com", "member", "revoked"],
      ],
    );
    assert.equal(summarizePersona(personas[0]).password, undefined);
  });
});
