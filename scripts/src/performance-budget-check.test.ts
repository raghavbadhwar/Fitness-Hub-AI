import assert from "node:assert/strict";
import test from "node:test";

import { createBudgetFixture, evaluatePerformanceBudgets } from "./performance-budget-check";

test("passes when built artifacts are within budget", async () => {
  const fixture = await createBudgetFixture({
    "artifacts/admin/dist/public/assets/index.js": "x".repeat(10),
    "artifacts/admin/dist/public/assets/dashboard.js": "x".repeat(20),
    "artifacts/api-server/dist/index.mjs": "x".repeat(30),
  });

  try {
    const result = await evaluatePerformanceBudgets(fixture.root, {
      adminTotalBytes: 100,
      adminLargestJsBytes: 50,
      apiEntryBytes: 50,
    });

    assert.equal(result.ok, true);
  } finally {
    await fixture.cleanup();
  }
});

test("fails when a built artifact exceeds budget", async () => {
  const fixture = await createBudgetFixture({
    "artifacts/admin/dist/public/assets/index.js": "x".repeat(80),
    "artifacts/api-server/dist/index.mjs": "x".repeat(30),
  });

  try {
    const result = await evaluatePerformanceBudgets(fixture.root, {
      adminTotalBytes: 100,
      adminLargestJsBytes: 50,
      apiEntryBytes: 50,
    });

    assert.equal(result.ok, false);
    assert.match(result.messages.join("\n"), /admin largest js/);
  } finally {
    await fixture.cleanup();
  }
});
