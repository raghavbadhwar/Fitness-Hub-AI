import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import express from "express";
import request from "supertest";

const authState = { userId: "member_1" };
const clerkUsers = new Map();
const userProfilesByClerkId = new Map();
const memberAiProfilesByClerkId = new Map();

const userProfiles = {
  id: Symbol("id"),
  clerkId: Symbol("clerkId"),
  name: Symbol("name"),
  role: Symbol("role"),
  updatedAt: Symbol("updatedAt"),
};

const memberAiProfiles = {
  memberClerkId: Symbol("memberClerkId"),
  memorySummary: Symbol("memorySummary"),
  updatedAt: Symbol("updatedAt"),
  recentMessages: Symbol("recentMessages"),
};

const gymClassesTable = {
  id: Symbol("id"),
  date: Symbol("date"),
  category: Symbol("category"),
  enrolledCount: Symbol("enrolledCount"),
};
const gymSettingsTable = { id: Symbol("id") };

mock.module("drizzle-orm", {
  namedExports: {
    eq(field, value) {
      return { op: "eq", field, value };
    },
    gte(field, value) {
      return { op: "gte", field, value };
    },
    lte(field, value) {
      return { op: "lte", field, value };
    },
    and(...conditions) {
      return { op: "and", conditions };
    },
    count() {
      return { op: "count" };
    },
    sum(field) {
      return { op: "sum", field };
    },
    desc(field) {
      return { op: "desc", field };
    },
  },
});

function cloneUser(user) {
  return {
    ...user,
    publicMetadata: { ...(user.publicMetadata ?? {}) },
    emailAddresses: user.emailAddresses.map((entry) => ({ ...entry })),
  };
}

function defaultClerkUser(overrides = {}) {
  return {
    id: "member_1",
    firstName: "Morgan",
    lastName: "Hill",
    createdAt: Date.parse("2026-04-10T12:00:00.000Z"),
    publicMetadata: { role: "owner" },
    emailAddresses: [{ emailAddress: "morgan@example.com" }],
    ...overrides,
  };
}

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
            return cloneUser(clerkUsers.get(userId) ?? defaultClerkUser({ id: userId }));
          },
          async updateUser(userId, patch) {
            const existing = clerkUsers.get(userId) ?? defaultClerkUser({ id: userId });
            const nextUser = {
              ...existing,
              publicMetadata: {
                ...(existing.publicMetadata ?? {}),
                ...(patch.publicMetadata ?? {}),
              },
            };
            clerkUsers.set(userId, cloneUser(nextUser));
            return cloneUser(nextUser);
          },
          async getCount() {
            return clerkUsers.size;
          },
        },
      };
    },
  },
});

mock.module("@workspace/db", {
  namedExports: {
    db: {
      select(selection) {
        return {
          from(table) {
            const baseQuery = {
              where(condition) {
                return {
                  ...baseQuery,
                  condition,
                  limit(count) {
                    if (table === userProfiles) {
                      const profile =
                        condition?.op === "eq" ? userProfilesByClerkId.get(condition.value) : null;
                      const rows = profile ? [profile] : [];
                      return Promise.resolve(rows.slice(0, count).map((row) => ({ ...row })));
                    }

                    if (table === memberAiProfiles) {
                      const profile =
                        condition?.op === "eq"
                          ? memberAiProfilesByClerkId.get(condition.value)
                          : null;
                      const rows = profile ? [profile] : [];
                      return Promise.resolve(
                        rows.slice(0, count).map((row) => ({
                          ...row,
                          recentMessages: Array.isArray(row.recentMessages)
                            ? [...row.recentMessages]
                            : row.recentMessages,
                        })),
                      );
                    }

                    return Promise.resolve([]);
                  },
                  groupBy(groupByField) {
                    return {
                      ...baseQuery,
                      condition,
                      groupByField,
                      orderBy(orderBySpec) {
                        return {
                          ...baseQuery,
                          condition,
                          groupByField,
                          orderBySpec,
                          limit(l) {
                            // mostPopularCategory query
                            if (selection?.category && selection?.count?.op === "count") {
                              return Promise.resolve([{ category: "Yoga", count: 2 }]);
                            }
                            return Promise.resolve([]);
                          },
                        };
                      },
                      then(cb) {
                        // weeklyClassCounts query
                        if (selection?.date && selection?.count?.op === "count") {
                          return Promise.resolve([
                            { date: "2026-04-19", count: 1 },
                            { date: "2026-04-20", count: 1 },
                            { date: "2026-04-21", count: 1 },
                          ]).then(cb);
                        }
                        return Promise.resolve([]).then(cb);
                      },
                    };
                  },
                };
              },
              then(cb) {
                // totalEnrollments sum query
                if (selection?.val?.op === "sum") {
                  return Promise.resolve([{ val: 18 }]).then(cb);
                }
                // totalClassesThisWeek count query (if no groupBy)
                if (selection?.val?.op === "count") {
                  return Promise.resolve([{ val: 3 }]).then(cb);
                }
                return Promise.resolve([]).then(cb);
              },
            };
            return baseQuery;
          },
        };
      },
      insert(table) {
        return {
          values(values) {
            return {
              onConflictDoUpdate({ set }) {
                return {
                  returning() {
                    if (table !== userProfiles) {
                      return Promise.resolve([]);
                    }

                    const existing = userProfilesByClerkId.get(values.clerkId);
                    const nextProfile = {
                      id: existing?.id ?? userProfilesByClerkId.size + 1,
                      clerkId: values.clerkId,
                      name: set?.name ?? values.name,
                      role: set?.role ?? values.role,
                      updatedAt:
                        set?.updatedAt ??
                        existing?.updatedAt ??
                        new Date("2026-04-20T10:00:00.000Z"),
                    };
                    userProfilesByClerkId.set(values.clerkId, { ...nextProfile });
                    return Promise.resolve([{ ...nextProfile }]);
                  },
                };
              },
            };
          },
        };
      },
    },
    gymClassesTable,
    gymSettingsTable,
    memberAiProfiles,
    userProfiles,
    userRoleEnum: ["member", "trainer", "owner"],
  },
});

function makeSafeParse() {
  return {
    safeParse() {
      return {
        success: false,
        error: { message: "Not used in admin route tests" },
      };
    },
  };
}

mock.module("@workspace/api-zod", {
  namedExports: {
    AdminCreateClassBody: makeSafeParse(),
    AdminUpdateClassBody: makeSafeParse(),
    AdminUpdateClassParams: makeSafeParse(),
    AdminDeleteClassParams: makeSafeParse(),
    AdminUpdateSettingsBody: makeSafeParse(),
  },
});

mock.module("../../src/lib/admin-access.ts", {
  namedExports: {
    async resolveAdminAccess(req) {
      const userId = authState.userId;
      if (!userId) {
        return {
          allowed: false,
          status: 401,
          userId: null,
          email: null,
          role: null,
          allowlistConfigured: false,
          reason: "Unauthorized",
        };
      }

      const user = clerkUsers.get(userId) ?? defaultClerkUser({ id: userId });
      const role = typeof user.publicMetadata?.role === "string" ? user.publicMetadata.role : null;
      const email = user.emailAddresses[0]?.emailAddress ?? null;

      if (role !== "owner") {
        return {
          allowed: false,
          status: 403,
          userId,
          email,
          role,
          allowlistConfigured: false,
          reason: "Forbidden: owner access required",
        };
      }

      return {
        allowed: true,
        userId,
        email,
        role,
        allowlistConfigured: false,
        reason: null,
      };
    },
  },
});

const { default: adminRouter } = await import("../../src/routes/admin.ts");

const app = express();
app.use(express.json());
app.use("/admin", adminRouter);

beforeEach(() => {
  authState.userId = "member_1";
  clerkUsers.clear();
  userProfilesByClerkId.clear();
  memberAiProfilesByClerkId.clear();

  clerkUsers.set("member_1", defaultClerkUser());
  userProfilesByClerkId.set("member_1", {
    id: 1,
    clerkId: "member_1",
    name: "Morgan Hill",
    role: "member",
    updatedAt: new Date("2026-04-19T09:00:00.000Z"),
  });
  memberAiProfilesByClerkId.set("member_1", {
    memberClerkId: "member_1",
    memorySummary: "Prefers strength sessions and 45-minute workouts.",
    updatedAt: new Date("2026-04-19T10:00:00.000Z"),
    recentMessages: [{ role: "user", content: "keep the plan simple" }],
  });
});

describe("admin routes", () => {
  it("updates a member role and returns the normalized member payload", async () => {
    const response = await request(app).patch("/admin/members/member_1").send({ role: "trainer" });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      id: "member_1",
      name: "Morgan Hill",
      firstName: "Morgan",
      lastName: "Hill",
      email: "morgan@example.com",
      role: "trainer",
      createdAt: "2026-04-10T12:00:00.000Z",
      aiMemorySummary: "Prefers strength sessions and 45-minute workouts.",
      aiLastUpdatedAt: "2026-04-19T10:00:00.000Z",
      aiRecentMessageCount: 1,
    });
    assert.equal(clerkUsers.get("member_1").publicMetadata.role, "trainer");
    assert.equal(userProfilesByClerkId.get("member_1").role, "trainer");
  });

  it("returns unauthorized when the caller is not authenticated", async () => {
    authState.userId = null;

    const response = await request(app).patch("/admin/members/member_1").send({ role: "trainer" });

    assert.equal(response.status, 401);
    assert.deepEqual(response.body, {
      error: "Unauthorized",
      email: null,
      role: null,
      allowlistConfigured: false,
    });
  });

  it("returns forbidden when the caller is not an owner", async () => {
    clerkUsers.set(
      "member_1",
      defaultClerkUser({
        publicMetadata: { role: "member" },
      }),
    );

    const response = await request(app).patch("/admin/members/member_1").send({ role: "trainer" });

    assert.equal(response.status, 403);
    assert.deepEqual(response.body, {
      error: "Forbidden: owner access required",
      email: "morgan@example.com",
      role: "member",
      allowlistConfigured: false,
    });
  });

  it("returns dashboard statistics optimized from database", async () => {
    // Mock date to 2026-04-20 (Monday)
    const fixedDate = new Date("2026-04-20T12:00:00Z");
    const originalDate = global.Date;
    global.Date = class extends Date {
      constructor(date) {
        if (date) return new originalDate(date);
        return fixedDate;
      }
    };

    try {
      const response = await request(app).get("/admin/dashboard");

      assert.equal(response.status, 200);
      assert.deepEqual(response.body, {
        totalClassesThisWeek: 3,
        totalEnrollments: 18,
        mostPopularCategory: "Yoga",
        totalActiveMembers: 1,
        weeklyClassCounts: [
          { day: "Sun", count: 1 }, // 2026-04-19
          { day: "Mon", count: 1 }, // 2026-04-20
          { day: "Tue", count: 1 }, // 2026-04-21
          { day: "Wed", count: 0 },
          { day: "Thu", count: 0 },
          { day: "Fri", count: 0 },
          { day: "Sat", count: 0 },
        ],
      });
    } finally {
      global.Date = originalDate;
    }
  });
});
