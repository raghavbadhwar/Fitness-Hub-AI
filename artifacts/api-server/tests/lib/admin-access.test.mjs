import assert from "node:assert/strict";
import { after, beforeEach, describe, it, mock } from "node:test";

let authenticatedUser = null;
const originalAllowedEmails = process.env.ADMIN_ALLOWED_EMAILS;
const originalOwnerEmailMap = process.env.ADMIN_GYM_OWNER_EMAILS;
const originalDefaultGymId = process.env.DEFAULT_GYM_ID;

mock.module("../../src/lib/clerk-request.ts", {
  namedExports: {
    async getAuthenticatedClerkUser() {
      return authenticatedUser ? { userId: authenticatedUser.id, user: authenticatedUser } : null;
    },
  },
});

mock.module("../../src/lib/user-access.ts", {
  namedExports: {
    normalizeEmail(value) {
      if (typeof value !== "string") {
        return null;
      }

      const normalized = value.trim().toLowerCase();
      return normalized && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
    },
    getPrimaryEmail(user) {
      const value = user.emailAddresses?.[0]?.emailAddress ?? null;
      if (typeof value !== "string") {
        return null;
      }

      const normalized = value.trim().toLowerCase();
      return normalized && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
    },
  },
});

const { resolveAdminAccess } = await import("../../src/lib/admin-access.ts");

function clerkUser(overrides = {}) {
  return {
    id: "user_1",
    publicMetadata: {},
    emailAddresses: [{ emailAddress: "owner@example.com" }],
    ...overrides,
  };
}

beforeEach(() => {
  authenticatedUser = clerkUser();
  delete process.env.ADMIN_ALLOWED_EMAILS;
  delete process.env.ADMIN_GYM_OWNER_EMAILS;
  delete process.env.DEFAULT_GYM_ID;
});

after(() => {
  if (originalAllowedEmails === undefined) {
    delete process.env.ADMIN_ALLOWED_EMAILS;
  } else {
    process.env.ADMIN_ALLOWED_EMAILS = originalAllowedEmails;
  }
  if (originalOwnerEmailMap === undefined) {
    delete process.env.ADMIN_GYM_OWNER_EMAILS;
  } else {
    process.env.ADMIN_GYM_OWNER_EMAILS = originalOwnerEmailMap;
  }
  if (originalDefaultGymId === undefined) {
    delete process.env.DEFAULT_GYM_ID;
  } else {
    process.env.DEFAULT_GYM_ID = originalDefaultGymId;
  }
});

describe("resolveAdminAccess", () => {
  it("requires authentication", async () => {
    authenticatedUser = null;

    const access = await resolveAdminAccess({});

    assert.equal(access.allowed, false);
    assert.equal(access.status, 401);
    assert.equal(access.reason, "Unauthorized");
  });

  it("allows Clerk owner metadata when no email allowlist is configured", async () => {
    authenticatedUser = clerkUser({ publicMetadata: { role: "owner" } });

    const access = await resolveAdminAccess({});

    assert.equal(access.allowed, true);
    assert.equal(access.role, "owner");
    assert.equal(access.gymId, "gymos-main");
    assert.equal(access.allowlistConfigured, false);
  });

  it("blocks non-owner metadata when no email allowlist is configured", async () => {
    const access = await resolveAdminAccess({});

    assert.equal(access.allowed, false);
    assert.equal(access.status, 403);
    assert.equal(access.reason, "Forbidden: owner access required");
  });

  it("allows a listed admin email before Clerk owner metadata exists", async () => {
    process.env.ADMIN_ALLOWED_EMAILS = " raghav1badhwar@gmail.com ; Owner@Example.com ";
    authenticatedUser = clerkUser({
      publicMetadata: { role: "member" },
      emailAddresses: [{ emailAddress: "OWNER@example.com" }],
    });

    const access = await resolveAdminAccess({});

    assert.equal(access.allowed, true);
    assert.equal(access.email, "owner@example.com");
    assert.equal(access.role, "owner");
    assert.equal(access.gymId, "gymos-main");
    assert.equal(access.allowlistConfigured, true);
  });

  it("maps listed admin emails to separate gyms", async () => {
    process.env.ADMIN_GYM_OWNER_EMAILS =
      "raghav1badhwar@gmail.com:gymos-main,owner@example.com:raghav2-padwar";
    authenticatedUser = clerkUser({
      publicMetadata: { role: "member" },
      emailAddresses: [{ emailAddress: "owner@example.com" }],
    });

    const access = await resolveAdminAccess({});

    assert.equal(access.allowed, true);
    assert.equal(access.email, "owner@example.com");
    assert.equal(access.role, "owner");
    assert.equal(access.gymId, "raghav2-padwar");
    assert.equal(access.allowlistConfigured, true);
  });

  it("blocks unlisted emails when the admin allowlist is configured", async () => {
    process.env.ADMIN_ALLOWED_EMAILS = "raghav1badhwar@gmail.com";
    authenticatedUser = clerkUser({
      publicMetadata: { role: "owner" },
      emailAddresses: [{ emailAddress: "other@example.com" }],
    });

    const access = await resolveAdminAccess({});

    assert.equal(access.allowed, false);
    assert.equal(access.status, 403);
    assert.equal(access.reason, "Forbidden: email is not approved for admin access");
  });
});
