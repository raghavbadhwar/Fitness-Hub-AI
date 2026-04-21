import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRotationTemplate,
  evaluatePreflight,
  isPlaceholderValue,
  parseEnvFile,
  type PreflightSnapshot,
} from "./internal-beta-secret-preflight";

function createPassingSnapshot(): PreflightSnapshot {
  const rotationTemplate = buildRotationTemplate();
  const rotatedSecrets = Object.fromEntries(
    Object.keys(rotationTemplate.secrets).map((key) => [key, true]),
  ) as typeof rotationTemplate.secrets;

  return {
    exampleValues: {
      CLERK_PUBLISHABLE_KEY: "pk_test_xxxxxxxxxxxxxxxxx",
      CLERK_SECRET_KEY: "sk_test_xxxxxxxxxxxxxxxxx",
      ADMIN_ALLOWED_EMAILS: "owner@example.com,coowner@example.com",
      DATABASE_URL:
        "postgresql://fitness_hub_app:change_me@db.<project-ref>.supabase.co:5432/postgres?sslmode=require&uselibpqcompat=true",
      DATABASE_ADMIN_URL:
        "postgresql://postgres:change_me@db.<project-ref>.supabase.co:5432/postgres?sslmode=require&uselibpqcompat=true",
      DATABASE_APP_PASSWORD: "change_me",
      AI_INTEGRATIONS_GEMINI_API_KEY: "",
    },
    envLocalTracked: false,
    knownIncidentActive: true,
    rotationStatus: {
      incident: "tracked-env-local",
      resolution: "rotate",
      rotatedAt: "2026-04-20T12:00:00.000Z",
      acceptedAt: "",
      acceptedBy: "",
      secrets: rotatedSecrets,
      notes: "all rotated",
    },
  };
}

test("parseEnvFile handles comments and quoted values", () => {
  const parsed = parseEnvFile(`
# comment
CLERK_SECRET_KEY="sk_test_xxxxxxxxxxxxxxxxx"
DATABASE_APP_PASSWORD=change_me
EMPTY=
`);

  assert.equal(parsed.CLERK_SECRET_KEY, "sk_test_xxxxxxxxxxxxxxxxx");
  assert.equal(parsed.DATABASE_APP_PASSWORD, "change_me");
  assert.equal(parsed.EMPTY, "");
});

test("isPlaceholderValue recognizes sanitized template values", () => {
  assert.equal(isPlaceholderValue("CLERK_SECRET_KEY", "sk_test_xxxxxxxxxxxxxxxxx"), true);
  assert.equal(
    isPlaceholderValue(
      "DATABASE_URL",
      "postgresql://fitness_hub_app:change_me@db.<project-ref>.supabase.co:5432/postgres?sslmode=require",
    ),
    true,
  );
  assert.equal(isPlaceholderValue("ADMIN_ALLOWED_EMAILS", "owner@example.com"), true);
  assert.equal(isPlaceholderValue("CLERK_SECRET_KEY", "sk_live_real_secret_value"), false);
});

test("evaluatePreflight fails when env local is still tracked", () => {
  const result = evaluatePreflight({
    ...createPassingSnapshot(),
    envLocalTracked: true,
  });

  assert.equal(result.ok, false);
  assert.equal(result.checks[0]?.ok, false);
});

test("evaluatePreflight fails when rotation attestation is incomplete", () => {
  const snapshot = createPassingSnapshot();
  snapshot.rotationStatus = {
    ...snapshot.rotationStatus!,
    rotatedAt: "",
    secrets: {
      ...snapshot.rotationStatus!.secrets,
      AI_INTEGRATIONS_GEMINI_API_KEY: false,
    },
  };

  const result = evaluatePreflight(snapshot);

  assert.equal(result.ok, false);
  assert.match(
    result.checks[2]?.details ?? "",
    /pending secret rotations: AI_INTEGRATIONS_GEMINI_API_KEY/,
  );
});

test("evaluatePreflight passes with explicit accepted-risk attestation", () => {
  const snapshot = createPassingSnapshot();
  snapshot.rotationStatus = {
    ...snapshot.rotationStatus!,
    resolution: "accepted-risk",
    rotatedAt: "",
    acceptedAt: "2026-04-20T12:05:00.000Z",
    acceptedBy: "local-operator",
    secrets: {
      ...snapshot.rotationStatus!.secrets,
      AI_INTEGRATIONS_GEMINI_API_KEY: false,
    },
    notes: "Internal beta will proceed with local acknowledged risk.",
  };

  const result = evaluatePreflight(snapshot);

  assert.equal(result.ok, true);
  assert.match(result.checks[2]?.details ?? "", /Accepted-risk resolution recorded locally/);
});

test("evaluatePreflight passes with sanitized example and complete attestation", () => {
  const result = evaluatePreflight(createPassingSnapshot());

  assert.equal(result.ok, true);
  assert.equal(result.checks.every((check) => check.ok), true);
});
