/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const {
  buildBundleUrl,
  buildMetroOrigin,
  getMetroPortCandidates,
  parsePort,
  resolveMetroPort,
} = require("./build.js");

test("buildBundleUrl uses the configured Metro origin and workspace-relative app path", () => {
  const workspaceRoot = path.resolve("/repo");
  const projectRoot = path.join(workspaceRoot, "artifacts", "gymapp");

  const url = buildBundleUrl({
    metroOrigin: "http://127.0.0.1:19001",
    platform: "ios",
    projectRoot,
    workspaceRoot,
  });

  assert.equal(url.origin, "http://127.0.0.1:19001");
  assert.equal(url.pathname, "/artifacts/gymapp/node_modules/expo-router/entry.bundle");
  assert.equal(url.searchParams.get("platform"), "ios");
  assert.equal(url.searchParams.get("dev"), "false");
  assert.equal(url.searchParams.get("minify"), "true");
});

test("resolveMetroPort skips occupied servers unless reuse is explicitly validated", async () => {
  const checkedOrigins = [];

  const result = await resolveMetroPort({
    preferredPort: 8081,
    attempts: 3,
    reuseExisting: false,
    checkHealth: async (origin) => {
      checkedOrigins.push(origin);
      return origin === "http://127.0.0.1:8081";
    },
    canServeProjectBundle: async () => true,
    log: { warn() {} },
  });

  assert.deepEqual(checkedOrigins, ["http://127.0.0.1:8081", "http://127.0.0.1:8082"]);
  assert.deepEqual(result, {
    port: 8082,
    origin: "http://127.0.0.1:8082",
    reused: false,
  });
});

test("resolveMetroPort can reuse an existing Metro only when it serves this project bundle", async () => {
  const result = await resolveMetroPort({
    preferredPort: 19001,
    attempts: 1,
    reuseExisting: true,
    checkHealth: async () => true,
    canServeProjectBundle: async () => true,
    log: { warn() {} },
  });

  assert.deepEqual(result, {
    port: 19001,
    origin: "http://127.0.0.1:19001",
    reused: true,
  });
});

test("Metro port helpers reject invalid values", () => {
  assert.equal(buildMetroOrigin(18081), "http://127.0.0.1:18081");
  assert.deepEqual(getMetroPortCandidates(18081, 3), [18081, 18082, 18083]);
  assert.throws(() => parsePort("not-a-port", "Test port"), /valid TCP port/);
  assert.throws(() => getMetroPortCandidates(18081, 0), /positive integer/);
});
