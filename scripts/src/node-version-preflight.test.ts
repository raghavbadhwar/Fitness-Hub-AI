import assert from "node:assert/strict";
import test from "node:test";

import { evaluateNodeVersion, parseNodeMajor } from "./node-version-preflight";

test("parseNodeMajor accepts v-prefixed and plain versions", () => {
  assert.equal(parseNodeMajor("v22.22.2"), 22);
  assert.equal(parseNodeMajor("22.22.2"), 22);
});

test("evaluateNodeVersion passes on Node 22", () => {
  const result = evaluateNodeVersion("22.22.2");

  assert.equal(result.ok, true);
  assert.equal(result.actualMajor, 22);
  assert.match(result.message, /PASS Node 22\.22\.2/);
});

test("evaluateNodeVersion fails clearly outside Node 22", () => {
  const result = evaluateNodeVersion("25.8.0");

  assert.equal(result.ok, false);
  assert.equal(result.actualMajor, 25);
  assert.match(result.message, /requires Node 22\.x/);
  assert.match(result.message, /Current runtime is 25\.8\.0/);
});
