import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import express from "express";
import request from "supertest";

const authState = { userId: "member_1" };
const clerkUsers = new Map();
const userProfilesByClerkId = new Map();
const memberAiProfilesByClerkId = new Map();
const accessControlsByEmail = new Map();
const adminClassesById = new Map();
let getUserListCalls = 0;

const userProfiles = {
  id: Symbol("id"),
  clerkId: Symbol("clerkId"),
  gymId: Symbol("gymId"),
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

const userAccessControls = {
  gymId: Symbol("gymId"),
  email: Symbol("email"),
  role: Symbol("role"),
  status: Symbol("status"),
  note: Symbol("note"),
  createdByClerkId: Symbol("createdByClerkId"),
  updatedAt: Symbol("updatedAt"),
  createdAt: Symbol("createdAt"),
};

const gymClassesTable = {
  id: Symbol("id"),
  gymId: Symbol("gymId"),
  enrolledMemberIds: Symbol("enrolledMemberIds"),
  waitlistedMemberIds: Symbol("waitlistedMemberIds"),
  attendanceRecords: Symbol("attendanceRecords"),
  updatedAt: Symbol("updatedAt"),
};
const gymSettingsTable = { id: Symbol("id") };

const profileFieldMap = new Map([
  [userProfiles.id, "id"],
  [userProfiles.clerkId, "clerkId"],
  [userProfiles.gymId, "gymId"],
  [userProfiles.name, "name"],
  [userProfiles.role, "role"],
  [userProfiles.updatedAt, "updatedAt"],
]);

const accessControlFieldMap = new Map([
  [userAccessControls.gymId, "gymId"],
  [userAccessControls.email, "email"],
  [userAccessControls.role, "role"],
  [userAccessControls.status, "status"],
  [userAccessControls.note, "note"],
  [userAccessControls.createdByClerkId, "createdByClerkId"],
  [userAccessControls.updatedAt, "updatedAt"],
  [userAccessControls.createdAt, "createdAt"],
]);

const gymClassFieldMap = new Map([
  [gymClassesTable.id, "id"],
  [gymClassesTable.gymId, "gymId"],
  [gymClassesTable.enrolledMemberIds, "enrolledMemberIds"],
  [gymClassesTable.waitlistedMemberIds, "waitlistedMemberIds"],
  [gymClassesTable.attendanceRecords, "attendanceRecords"],
  [gymClassesTable.updatedAt, "updatedAt"],
]);

function withDefaultGym(row) {
  return { gymId: "gymos-main", ...row };
}

function seedAdminClass(overrides = {}) {
  return {
    id: 1,
    gymId: "gymos-main",
    name: "Morning Yoga",
    category: "Yoga",
    date: "2099-04-25",
    startTime: "06:30",
    duration: 60,
    maxParticipants: 20,
    enrolledCount: 2,
    enrolledMemberIds: ["member_1", "missing_user"],
    waitlistedMemberIds: [],
    attendanceRecords: [],
    room: "Studio A",
    status: "scheduled",
    color: "#22C55E",
    createdAt: new Date("2026-04-20T10:00:00.000Z"),
    updatedAt: new Date("2026-04-20T10:00:00.000Z"),
    ...overrides,
  };
}

function cloneAdminClass(row) {
  return {
    ...row,
    enrolledMemberIds: [...(row.enrolledMemberIds ?? [])],
    waitlistedMemberIds: [...(row.waitlistedMemberIds ?? [])],
    attendanceRecords: (row.attendanceRecords ?? []).map((record) => ({ ...record })),
    updatedAt: new Date(row.updatedAt),
  };
}

function matchesCondition(row, condition, fieldMap) {
  if (!condition) return true;
  if (condition.op === "and") {
    return condition.conditions.every((child) => matchesCondition(row, child, fieldMap));
  }
  if (condition.op !== "eq") return true;
  const fieldName = fieldMap.get(condition.field);
  return fieldName ? row[fieldName] === condition.value : true;
}

mock.module("drizzle-orm", {
  namedExports: {
    eq(field, value) {
      return { op: "eq", field, value };
    },
    and(...conditions) {
      return { op: "and", conditions };
    },
    gte(field, value) {
      return { op: "gte", field, value };
    },
    count() {
      return { op: "count" };
    },
    sum() {
      return { op: "sum" };
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
          async getUserList({ userId = [], emailAddress = [], limit = 200, offset = 0 } = {}) {
            getUserListCalls += 1;
            let users = [];
            if (userId.length > 0) {
              users = userId.map((id) => clerkUsers.get(id)).filter(Boolean);
            } else if (emailAddress.length > 0) {
              const emails = new Set(emailAddress.map((email) => email.toLowerCase()));
              users = [...clerkUsers.values()].filter((user) =>
                user.emailAddresses.some((entry) => emails.has(entry.emailAddress.toLowerCase())),
              );
            } else {
              users = [...clerkUsers.values()];
            }

            const data = users.slice(offset, offset + limit).map(cloneUser);
            return { data, totalCount: data.length };
          },
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
        },
      };
    },
  },
});

mock.module("@workspace/db", {
  namedExports: {
    db: {
      select() {
        function selectRows(table, condition, count = Number.POSITIVE_INFINITY) {
          if (table === userProfiles) {
            const rows = [...userProfilesByClerkId.values()]
              .map(withDefaultGym)
              .filter((row) => matchesCondition(row, condition, profileFieldMap));
            return rows.slice(0, count).map((row) => ({ ...row }));
          }

          if (table === gymClassesTable) {
            const rows = [...adminClassesById.values()]
              .map(cloneAdminClass)
              .filter((row) => matchesCondition(row, condition, gymClassFieldMap));

            if (rows.some((row) => row.id === 2)) {
              const ids = Array.from({ length: 101 }, (_, i) => `u_${i}`);
              ids.forEach((id) => clerkUsers.set(id, defaultClerkUser({ id })));
            }

            return rows.slice(0, count).map((row) => ({ ...row }));
          }

          if (table === memberAiProfiles) {
            const rows =
              condition?.op === "eq"
                ? [memberAiProfilesByClerkId.get(condition.value)].filter(Boolean)
                : [...memberAiProfilesByClerkId.values()];

            return rows.slice(0, count).map((row) => ({
              ...row,
              recentMessages: Array.isArray(row.recentMessages)
                ? [...row.recentMessages]
                : row.recentMessages,
            }));
          }

          if (table === userAccessControls) {
            const rows = [...accessControlsByEmail.values()]
              .map(withDefaultGym)
              .filter((row) => matchesCondition(row, condition, accessControlFieldMap));
            return rows.slice(0, count).map((row) => ({
              ...row,
              updatedAt: new Date(row.updatedAt),
              createdAt: new Date(row.createdAt),
            }));
          }

          return [];
        }

        return {
          from(table) {
            const makeQuery = (condition) => ({
              limit(count) {
                return Promise.resolve(selectRows(table, condition, count));
              },
              then(resolve, reject) {
                return Promise.resolve(selectRows(table, condition)).then(resolve, reject);
              },
            });

            return {
              where(condition) {
                return makeQuery(condition);
              },
              then(resolve, reject) {
                return Promise.resolve(selectRows(table)).then(resolve, reject);
              },
            };
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
                    if (table === userProfiles) {
                      const existing = userProfilesByClerkId.get(values.clerkId);
                      const nextProfile = {
                        id: existing?.id ?? userProfilesByClerkId.size + 1,
                        clerkId: values.clerkId,
                        gymId: set?.gymId ?? values.gymId ?? existing?.gymId ?? "gymos-main",
                        name: set?.name ?? values.name,
                        role: set?.role ?? values.role,
                        updatedAt:
                          set?.updatedAt ??
                          existing?.updatedAt ??
                          new Date("2026-04-20T10:00:00.000Z"),
                      };
                      userProfilesByClerkId.set(values.clerkId, { ...nextProfile });
                      return Promise.resolve([{ ...nextProfile }]);
                    }

                    if (table === userAccessControls) {
                      const existing = accessControlsByEmail.get(values.email);
                      const nextAccessControl = {
                        gymId: set?.gymId ?? values.gymId ?? existing?.gymId ?? "gymos-main",
                        email: values.email,
                        role: set?.role ?? values.role,
                        status: set?.status ?? values.status,
                        note: set?.note ?? values.note ?? "",
                        createdByClerkId:
                          set?.createdByClerkId ??
                          values.createdByClerkId ??
                          existing?.createdByClerkId ??
                          null,
                        updatedAt:
                          set?.updatedAt ??
                          existing?.updatedAt ??
                          new Date("2026-04-20T10:00:00.000Z"),
                        createdAt:
                          existing?.createdAt ??
                          values.createdAt ??
                          new Date("2026-04-20T10:00:00.000Z"),
                      };
                      accessControlsByEmail.set(values.email, { ...nextAccessControl });
                      return Promise.resolve([{ ...nextAccessControl }]);
                    }

                    return Promise.resolve([]);
                  },
                };
              },
            };
          },
        };
      },
      update(table) {
        return {
          set(values) {
            return {
              where(condition) {
                return {
                  returning() {
                    if (table === gymClassesTable) {
                      const rows = [...adminClassesById.values()]
                        .filter((row) => matchesCondition(row, condition, gymClassFieldMap))
                        .map((row) => {
                          const nextClass = {
                            ...row,
                            ...values,
                            attendanceRecords: (
                              values.attendanceRecords ?? row.attendanceRecords
                            ).map((record) => ({ ...record })),
                            updatedAt: values.updatedAt ?? row.updatedAt,
                          };
                          adminClassesById.set(row.id, cloneAdminClass(nextClass));
                          return cloneAdminClass(nextClass);
                        });
                      return Promise.resolve(rows);
                    }

                    return Promise.resolve([]);
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
    userAccessControls,
    userAccessStatusEnum: ["pending", "approved", "revoked"],
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
    async resolveAdminAccess() {
      const userId = authState.userId;
      if (!userId) {
        return {
          allowed: false,
          status: 401,
          userId: null,
          email: null,
          gymId: null,
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
          gymId: "gymos-main",
          role,
          allowlistConfigured: false,
          reason: "Forbidden: owner access required",
        };
      }

      return {
        allowed: true,
        userId,
        email,
        gymId: "gymos-main",
        role,
        allowlistConfigured: false,
        reason: null,
      };
    },
  },
});

const { clearAdminMemberListCache } = await import("../../src/lib/admin-members.ts");
const { default: adminRouter } = await import("../../src/routes/admin.ts");

const app = express();
app.use(express.json());
app.use("/admin", adminRouter);

beforeEach(() => {
  authState.userId = "member_1";
  clerkUsers.clear();
  userProfilesByClerkId.clear();
  memberAiProfilesByClerkId.clear();
  accessControlsByEmail.clear();
  adminClassesById.clear();
  getUserListCalls = 0;
  clearAdminMemberListCache();

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
  adminClassesById.set(1, seedAdminClass());
  adminClassesById.set(
    2,
    seedAdminClass({
      id: 2,
      enrolledMemberIds: Array.from({ length: 101 }, (_, i) => `u_${i}`),
    }),
  );
});

describe("admin routes", () => {
  it("updates a member role and returns the normalized member payload", async () => {
    clerkUsers.set(
      "member_2",
      defaultClerkUser({
        id: "member_2",
        firstName: "Alex",
        lastName: "Lane",
        publicMetadata: { role: "member" },
        emailAddresses: [{ emailAddress: "alex@example.com" }],
      }),
    );
    userProfilesByClerkId.set("member_2", {
      id: 2,
      clerkId: "member_2",
      name: "Alex Lane",
      role: "member",
      updatedAt: new Date("2026-04-19T09:00:00.000Z"),
    });

    const response = await request(app).patch("/admin/members/member_2").send({ role: "trainer" });

    assert.equal(response.status, 200);
    assert.match(response.body.accessUpdatedAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.deepEqual(
      { ...response.body, accessUpdatedAt: null },
      {
        id: "member_2",
        name: "Alex Lane",
        firstName: "Alex",
        lastName: "Lane",
        email: "alex@example.com",
        gymId: "gymos-main",
        role: "trainer",
        accessStatus: "approved",
        accessUpdatedAt: null,
        createdAt: "2026-04-10T12:00:00.000Z",
        aiMemorySummary: null,
        aiLastUpdatedAt: null,
        aiRecentMessageCount: 0,
      },
    );
    assert.equal(clerkUsers.get("member_2").publicMetadata.role, "trainer");
    assert.equal(userProfilesByClerkId.get("member_2").role, "trainer");
    assert.equal(accessControlsByEmail.get("alex@example.com").status, "approved");
    assert.equal(accessControlsByEmail.get("alex@example.com").role, "trainer");
  });

  it("dedupes concurrent admin member listing calls", async () => {
    clerkUsers.set(
      "member_2",
      defaultClerkUser({
        id: "member_2",
        firstName: "Alex",
        lastName: "Lane",
        publicMetadata: { role: "member" },
        emailAddresses: [{ emailAddress: "alex@example.com" }],
      }),
    );
    userProfilesByClerkId.set("member_2", {
      id: 2,
      clerkId: "member_2",
      name: "Alex Lane",
      role: "member",
      updatedAt: new Date("2026-04-19T09:00:00.000Z"),
    });

    const [firstResponse, secondResponse] = await Promise.all([
      request(app).get("/admin/members"),
      request(app).get("/admin/members"),
    ]);

    assert.equal(firstResponse.status, 200);
    assert.equal(secondResponse.status, 200);
    assert.equal(firstResponse.body.length, 2);
    assert.equal(secondResponse.body.length, 2);
    assert.equal(getUserListCalls, 1);
  });

  it("invalidates cached admin member listing after role changes", async () => {
    clerkUsers.set(
      "member_2",
      defaultClerkUser({
        id: "member_2",
        firstName: "Alex",
        lastName: "Lane",
        publicMetadata: { role: "member" },
        emailAddresses: [{ emailAddress: "alex@example.com" }],
      }),
    );
    userProfilesByClerkId.set("member_2", {
      id: 2,
      clerkId: "member_2",
      name: "Alex Lane",
      role: "member",
      updatedAt: new Date("2026-04-19T09:00:00.000Z"),
    });

    const cachedResponse = await request(app).get("/admin/members");
    assert.equal(cachedResponse.status, 200);
    assert.equal(getUserListCalls, 1);

    const roleResponse = await request(app)
      .patch("/admin/members/member_2")
      .send({ role: "trainer" });
    assert.equal(roleResponse.status, 200);

    const refreshedResponse = await request(app).get("/admin/members");
    assert.equal(refreshedResponse.status, 200);
    assert.equal(getUserListCalls, 2);
    assert.equal(
      refreshedResponse.body.find((member) => member.id === "member_2")?.role,
      "trainer",
    );
  });

  it("does not mutate owner accounts when Clerk metadata marks them as owner", async () => {
    const response = await request(app).patch("/admin/members/member_1").send({ role: "trainer" });

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, { error: "Owner accounts must be managed separately" });
    assert.equal(clerkUsers.get("member_1").publicMetadata.role, "owner");
    assert.equal(userProfilesByClerkId.get("member_1").role, "member");
    assert.equal(accessControlsByEmail.has("morgan@example.com"), false);
  });

  it("does not create access-control rows when member-access targets an owner", async () => {
    const response = await request(app).post("/admin/member-access").send({
      email: "morgan@example.com",
      role: "trainer",
      accessStatus: "approved",
    });

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, { error: "Owner accounts must be managed separately" });
    assert.equal(clerkUsers.get("member_1").publicMetadata.role, "owner");
    assert.equal(userProfilesByClerkId.get("member_1").role, "member");
    assert.equal(accessControlsByEmail.has("morgan@example.com"), false);
  });

  it("grants access to an email that has not signed up yet", async () => {
    const response = await request(app).post("/admin/member-access").send({
      email: "  New.Member@Example.COM  ",
      role: "trainer",
      accessStatus: "approved",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(
      { ...response.body, accessUpdatedAt: null, createdAt: null },
      {
        id: "email:new.member@example.com",
        name: null,
        firstName: null,
        lastName: null,
        email: "new.member@example.com",
        gymId: "gymos-main",
        role: "trainer",
        accessStatus: "approved",
        accessUpdatedAt: null,
        createdAt: null,
        aiMemorySummary: null,
        aiLastUpdatedAt: null,
        aiRecentMessageCount: 0,
      },
    );
    assert.equal(accessControlsByEmail.get("new.member@example.com").createdByClerkId, "member_1");
  });

  it("revokes access from an existing member and downgrades their app role", async () => {
    clerkUsers.set(
      "member_2",
      defaultClerkUser({
        id: "member_2",
        firstName: "Alex",
        lastName: "Lane",
        publicMetadata: { role: "trainer" },
        emailAddresses: [{ emailAddress: "alex@example.com" }],
      }),
    );
    userProfilesByClerkId.set("member_2", {
      id: 2,
      clerkId: "member_2",
      name: "Alex Lane",
      role: "trainer",
      updatedAt: new Date("2026-04-19T09:00:00.000Z"),
    });

    const response = await request(app).post("/admin/member-access").send({
      email: "alex@example.com",
      role: "member",
      accessStatus: "revoked",
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.id, "member_2");
    assert.equal(response.body.email, "alex@example.com");
    assert.equal(response.body.role, "member");
    assert.equal(response.body.accessStatus, "revoked");
    assert.equal(clerkUsers.get("member_2").publicMetadata.role, "member");
    assert.equal(userProfilesByClerkId.get("member_2").role, "member");
    assert.equal(accessControlsByEmail.get("alex@example.com").status, "revoked");
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

  it("returns enrolled members including missing users fallback", async () => {
    const response = await request(app).get("/admin/classes/1/enrollments");
    assert.equal(response.status, 200);
    assert.equal(response.body.length, 2);
    assert.deepEqual(response.body[0], {
      id: "member_1",
      firstName: "Morgan",
      lastName: "Hill",
      email: "morgan@example.com",
      role: "owner",
      attendanceStatus: "booked",
    });
    assert.deepEqual(response.body[1], {
      id: "missing_user",
      firstName: null,
      lastName: null,
      email: "",
      role: "member",
      attendanceStatus: "booked",
    });
  });

  it("updates enrolled member attendance status", async () => {
    const response = await request(app)
      .patch("/admin/classes/1/enrollments/member_1")
      .send({ attendanceStatus: "checked_in" });

    assert.equal(response.status, 200);
    assert.equal(response.body.memberId, "member_1");
    assert.equal(response.body.attendanceStatus, "checked_in");
    assert.equal(adminClassesById.get(1).attendanceRecords[0].status, "checked_in");
  });

  it("batches getUserList correctly for large classes", async () => {
    const response = await request(app).get("/admin/classes/2/enrollments");
    assert.equal(response.status, 200);
    assert.equal(response.body.length, 101);
    assert.equal(response.body[0].id, "u_0");
    assert.equal(response.body[100].id, "u_100");
  });
});
