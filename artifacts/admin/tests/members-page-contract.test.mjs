import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

const membersPagePath = path.resolve(
  process.cwd(),
  "artifacts/admin/src/pages/members.tsx",
);

describe("admin members page contract", () => {
  it("uses the generated auth-aware role update mutation", async () => {
    const source = await readFile(membersPagePath, "utf8");

    assert.match(
      source,
      /\buseAdminUpdateMember\b/,
      "expected members page to import and use the generated role update mutation",
    );

    assert.doesNotMatch(
      source,
      /fetch\(buildApiUrl\(`\/api\/admin\/members\/\$\{memberId\}`\)/,
      "expected members page to avoid the raw fetch role-update path",
    );
  });
});
