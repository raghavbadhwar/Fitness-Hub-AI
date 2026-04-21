import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import express from "express";
import request from "supertest";

const authState = { userId: "member_1" };
const clerkUsers = new Map();
const profilesByClerkId = new Map();

const userProfiles = {
  id: Symbol("id"),
  clerkId: Symbol("clerkId"),
  name: Symbol("name"),
  role: Symbol("role"),
  updatedAt: Symbol("updatedAt"),
};

const profileFieldMap = new Map([
  [userProfiles.id, "id"],
  [userProfiles.clerkId, "clerkId"],
  [userProfiles.name, "name"],
  [userProfiles.role, "role"],
  [userProfiles.updatedAt, "updatedAt"],
]);

function defaultClerkUser(overrides = {}) {
  return {
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

function projectProfile(profile, selection) {
  if (!selection) {
    return cloneProfile(profile);
  }

  return Object.fromEntries(
    Object.entries(selection).map(([key, field]) => [key, profile[profileFieldMap.get(field)]]),
  );
}

function listProfilesForCondition(condition) {
  if (condition?.op === "eq") {
    const profile = profilesByClerkId.get(condition.value);
    return profile ? [cloneProfile(profile)] : [];
  }

  return [...profilesByClerkId.values()].map(cloneProfile);
}

const db = {
  select(selection) {
    return {
      from() {
        return {
          where(condition) {
            return {
              limit(count) {
                const rows = listProfilesForCondition(condition)
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
            return clerkUsers.get(userId) ?? defaultClerkUser();
          },
        },
      };
    },
  },
});

mock.module("@workspace/db", {
  namedExports: {
    db,
    userProfiles,
    userRoleEnum: ["member", "admin"],
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
  clerkUsers.set("member_1", defaultClerkUser());
});

describe("profiles routes", () => {
  it("returns missing_profile when the caller has no stored profile", async () => {
    const response = await request(app).get("/profiles/access-check");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { status: "missing_profile" });
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
      name: "Asha",
      role: "member",
    });
  });

  it("creates a synced profile with the requested name and clerk role", async () => {
    clerkUsers.set(
      "member_1",
      defaultClerkUser({
        publicMetadata: { role: "admin" },
        firstName: "Priya",
        lastName: "Singh",
      }),
    );

    const response = await request(app)
      .post("/profiles/sync")
      .send({ name: "  Priya S.  " });

    assert.equal(response.status, 200);
    assert.equal(response.body.clerkId, "member_1");
    assert.equal(response.body.name, "Priya S.");
    assert.equal(response.body.role, "admin");

    assert.deepEqual(
      profilesByClerkId.get("member_1"),
      {
        id: 1,
        clerkId: "member_1",
        name: "Priya S.",
        role: "admin",
        updatedAt: profilesByClerkId.get("member_1").updatedAt,
      },
    );
  });

  it("preserves the existing role when clerk metadata is invalid", async () => {
    profilesByClerkId.set("member_1", {
      id: 7,
      clerkId: "member_1",
      name: "Existing Name",
      role: "admin",
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
    assert.equal(response.body.role, "admin");
  });

  it("returns unauthorized when auth resolution does not provide a user id", async () => {
    authState.userId = null;

    const response = await request(app).get("/profiles/access-check");

    assert.equal(response.status, 401);
    assert.deepEqual(response.body, { error: "Unauthorized" });
  });
});
