import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import express from "express";
import request from "supertest";

const authState = { userId: "member_1" };
const clerkUsers = new Map();
const profilesByClerkId = new Map();
const accessControlsByEmail = new Map();

const userProfiles = {
  id: Symbol("id"),
  clerkId: Symbol("clerkId"),
  name: Symbol("name"),
  role: Symbol("role"),
  updatedAt: Symbol("updatedAt"),
};

const userAccessControls = {
  email: Symbol("email"),
  role: Symbol("role"),
  status: Symbol("status"),
  note: Symbol("note"),
  createdByClerkId: Symbol("createdByClerkId"),
  updatedAt: Symbol("updatedAt"),
  createdAt: Symbol("createdAt"),
};

const profileFieldMap = new Map([
  [userProfiles.id, "id"],
  [userProfiles.clerkId, "clerkId"],
  [userProfiles.name, "name"],
  [userProfiles.role, "role"],
  [userProfiles.updatedAt, "updatedAt"],
]);

const accessControlFieldMap = new Map([
  [userAccessControls.email, "email"],
  [userAccessControls.role, "role"],
  [userAccessControls.status, "status"],
  [userAccessControls.note, "note"],
  [userAccessControls.createdByClerkId, "createdByClerkId"],
  [userAccessControls.updatedAt, "updatedAt"],
  [userAccessControls.createdAt, "createdAt"],
]);

function defaultClerkUser(overrides = {}) {
  return {
    id: "member_1",
    firstName: "Morgan",
    lastName: "Hill",
    publicMetadata: {},
    emailAddresses: [{ emailAddress: "morgan@example.com" }],
    ...overrides,
  };
}

function cloneProfile(profile) {
  return {
    ...profile,
    updatedAt: new Date(profile.updatedAt),
  };
}

function cloneAccessControl(accessControl) {
  return {
    ...accessControl,
    updatedAt: new Date(accessControl.updatedAt),
    createdAt: new Date(accessControl.createdAt),
  };
}

function projectProfile(profile, selection) {
  if (!selection) {
    return cloneProfile(profile);
  }

  return Object.fromEntries(
    Object.entries(selection).map(([key, field]) => [key, profile[profileFieldMap.get(field)]]),
  );
}

function projectAccessControl(accessControl, selection) {
  if (!selection) {
    return cloneAccessControl(accessControl);
  }

  return Object.fromEntries(
    Object.entries(selection).map(([key, field]) => [
      key,
      cloneAccessControl(accessControl)[accessControlFieldMap.get(field)],
    ]),
  );
}

function listProfilesForCondition(condition) {
  if (condition?.op === "eq") {
    const profile = profilesByClerkId.get(condition.value);
    return profile ? [cloneProfile(profile)] : [];
  }

  return [...profilesByClerkId.values()].map(cloneProfile);
}

function listAccessControlsForCondition(condition) {
  if (condition?.op === "eq") {
    const accessControl = accessControlsByEmail.get(condition.value);
    return accessControl ? [cloneAccessControl(accessControl)] : [];
  }

  return [...accessControlsByEmail.values()].map(cloneAccessControl);
}

const db = {
  select(selection) {
    return {
      from(table) {
        return {
          where(condition) {
            return {
              limit(count) {
                const rows =
                  table === userAccessControls
                    ? listAccessControlsForCondition(condition)
                        .slice(0, count)
                        .map((accessControl) => projectAccessControl(accessControl, selection))
                    : listProfilesForCondition(condition)
                        .slice(0, count)
                        .map((profile) => projectProfile(profile, selection));
                return Promise.resolve(rows);
              },
            };
          },
        };
      },
    };
  },
  insert() {
    return {
      values(values) {
        return {
          onConflictDoUpdate({ set }) {
            return {
              returning() {
                const existing = profilesByClerkId.get(values.clerkId);
                const nextProfile = {
                  id: existing?.id ?? profilesByClerkId.size + 1,
                  clerkId: values.clerkId,
                  name: set?.name ?? values.name,
                  role: set?.role ?? values.role,
                  updatedAt: set?.updatedAt ?? existing?.updatedAt ?? new Date(),
                };
                profilesByClerkId.set(values.clerkId, cloneProfile(nextProfile));
                return Promise.resolve([cloneProfile(nextProfile)]);
              },
            };
          },
        };
      },
    };
  },
};

mock.module("drizzle-orm", {
  namedExports: {
    eq(field, value) {
      return { op: "eq", field, value };
    },
  },
});

mock.module("@clerk/express", {
  namedExports: {
    requireAuth() {
      return (_req, _res, next) => next();
    },
    getAuth() {
      return { userId: authState.userId };
    },
  },
});

mock.module("@clerk/backend", {
  namedExports: {
    createClerkClient() {
      return {
        users: {
          async getUser(userId) {
            return clerkUsers.get(userId) ?? defaultClerkUser({ id: userId });
          },
        },
      };
    },
  },
});

mock.module("@workspace/db", {
  namedExports: {
    db,
    userAccessControls,
    userAccessStatusEnum: ["pending", "approved", "revoked"],
    userProfiles,
    userRoleEnum: ["member", "trainer", "owner"],
  },
});

const { default: profilesRouter } = await import("../../src/routes/profiles.ts");

const app = express();
app.use(express.json());
app.use("/profiles", profilesRouter);

beforeEach(() => {
  authState.userId = "member_1";
  clerkUsers.clear();
  profilesByClerkId.clear();
  accessControlsByEmail.clear();
  clerkUsers.set("member_1", defaultClerkUser());
});

describe("profiles routes", () => {
  it("returns pending approval when the caller has no stored profile or access grant", async () => {
    const response = await request(app).get("/profiles/access-check");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      status: "pending_approval",
      email: "morgan@example.com",
      role: "member",
      message: "Your gym team needs to allow this email before you can enter the member app.",
    });
  });

  it("returns missing_profile when the caller is approved but not synced yet", async () => {
    accessControlsByEmail.set("morgan@example.com", {
      email: "morgan@example.com",
      role: "member",
      status: "approved",
      note: "",
      createdByClerkId: "owner_1",
      updatedAt: new Date("2026-04-20T09:00:00.000Z"),
      createdAt: new Date("2026-04-20T09:00:00.000Z"),
    });

    const response = await request(app).get("/profiles/access-check");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      status: "missing_profile",
      email: "morgan@example.com",
      role: "member",
    });
  });

  it("returns ready when the caller profile already exists", async () => {
    profilesByClerkId.set("member_1", {
      id: 1,
      clerkId: "member_1",
      name: "Asha",
      role: "member",
      updatedAt: new Date("2026-04-20T09:00:00.000Z"),
    });

    const response = await request(app).get("/profiles/access-check");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      status: "ready",
      email: "morgan@example.com",
      name: "Asha",
      role: "member",
    });
  });

  it("creates a synced profile with the requested name and approved access role", async () => {
    accessControlsByEmail.set("morgan@example.com", {
      email: "morgan@example.com",
      role: "trainer",
      status: "approved",
      note: "",
      createdByClerkId: "owner_1",
      updatedAt: new Date("2026-04-20T09:00:00.000Z"),
      createdAt: new Date("2026-04-20T09:00:00.000Z"),
    });
    clerkUsers.set(
      "member_1",
      defaultClerkUser({
        publicMetadata: { role: "member" },
        firstName: "Priya",
        lastName: "Singh",
      }),
    );

    const response = await request(app).post("/profiles/sync").send({ name: "  Priya S.  " });

    assert.equal(response.status, 200);
    assert.equal(response.body.clerkId, "member_1");
    assert.equal(response.body.name, "Priya S.");
    assert.equal(response.body.role, "trainer");
    assert.equal(response.body.email, "morgan@example.com");

    assert.deepEqual(profilesByClerkId.get("member_1"), {
      id: 1,
      clerkId: "member_1",
      name: "Priya S.",
      role: "trainer",
      updatedAt: profilesByClerkId.get("member_1").updatedAt,
    });
  });

  it("preserves the existing role when clerk metadata is invalid", async () => {
    profilesByClerkId.set("member_1", {
      id: 7,
      clerkId: "member_1",
      name: "Existing Name",
      role: "trainer",
      updatedAt: new Date("2026-04-18T09:00:00.000Z"),
    });
    clerkUsers.set(
      "member_1",
      defaultClerkUser({
        publicMetadata: { role: "not-a-real-role" },
        firstName: null,
        lastName: null,
        emailAddresses: [{ emailAddress: "fallback-role@example.com" }],
      }),
    );

    const response = await request(app).post("/profiles/sync").send({});

    assert.equal(response.status, 200);
    assert.equal(response.body.name, "Existing Name");
    assert.equal(response.body.role, "trainer");
  });

  it("rejects sync when the caller email has been revoked", async () => {
    accessControlsByEmail.set("morgan@example.com", {
      email: "morgan@example.com",
      role: "member",
      status: "revoked",
      note: "",
      createdByClerkId: "owner_1",
      updatedAt: new Date("2026-04-20T09:00:00.000Z"),
      createdAt: new Date("2026-04-20T09:00:00.000Z"),
    });

    const response = await request(app).post("/profiles/sync").send({ name: "Morgan" });

    assert.equal(response.status, 403);
    assert.deepEqual(response.body, {
      error: "Your gym team has turned off member app access for this email.",
      status: "revoked",
      email: "morgan@example.com",
      role: "member",
    });
  });

  it("blocks profile reads when the caller email has been revoked", async () => {
    profilesByClerkId.set("member_1", {
      id: 11,
      clerkId: "member_1",
      name: "Morgan",
      role: "member",
      updatedAt: new Date("2026-04-20T09:00:00.000Z"),
    });
    accessControlsByEmail.set("morgan@example.com", {
      email: "morgan@example.com",
      role: "member",
      status: "revoked",
      note: "",
      createdByClerkId: "owner_1",
      updatedAt: new Date("2026-04-20T09:00:00.000Z"),
      createdAt: new Date("2026-04-20T09:00:00.000Z"),
    });

    const response = await request(app).get("/profiles/me");

    assert.equal(response.status, 403);
    assert.deepEqual(response.body, {
      error: "Your gym team has turned off member app access for this email.",
      status: "revoked",
      email: "morgan@example.com",
      role: "member",
    });
  });

  it("returns unauthorized when auth resolution does not provide a user id", async () => {
    authState.userId = null;

    const response = await request(app).get("/profiles/access-check");

    assert.equal(response.status, 401);
    assert.deepEqual(response.body, { error: "Unauthorized" });
  });
});
