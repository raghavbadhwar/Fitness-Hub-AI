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
const gymSettingsByGymId = new Map();
const adminAuditLogsById = new Map();
let getUserListCalls = 0;
let getUserListShouldFail = false;
let nowMs = Date.parse("2026-05-07T00:00:00.000Z");

mock.method(Date, "now", () => nowMs);

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
const gymSettingsTable = {
  id: Symbol("gymSettings.id"),
  gymId: Symbol("gymSettings.gymId"),
  gymName: Symbol("gymSettings.gymName"),
  address: Symbol("gymSettings.address"),
  phone: Symbol("gymSettings.phone"),
  workingHours: Symbol("gymSettings.workingHours"),
  description: Symbol("gymSettings.description"),
  updatedAt: Symbol("gymSettings.updatedAt"),
};

const adminAuditLogs = {
  id: Symbol("adminAuditLogs.id"),
  gymId: Symbol("adminAuditLogs.gymId"),
  actorClerkId: Symbol("adminAuditLogs.actorClerkId"),
  action: Symbol("adminAuditLogs.action"),
  targetType: Symbol("adminAuditLogs.targetType"),
  targetId: Symbol("adminAuditLogs.targetId"),
  metadata: Symbol("adminAuditLogs.metadata"),
  createdAt: Symbol("adminAuditLogs.createdAt"),
};

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

const gymSettingsFieldMap = new Map([
  [gymSettingsTable.id, "id"],
  [gymSettingsTable.gymId, "gymId"],
  [gymSettingsTable.gymName, "gymName"],
  [gymSettingsTable.address, "address"],
  [gymSettingsTable.phone, "phone"],
  [gymSettingsTable.workingHours, "workingHours"],
  [gymSettingsTable.description, "description"],
  [gymSettingsTable.updatedAt, "updatedAt"],
]);

const adminAuditLogFieldMap = new Map([
  [adminAuditLogs.id, "id"],
  [adminAuditLogs.gymId, "gymId"],
  [adminAuditLogs.actorClerkId, "actorClerkId"],
  [adminAuditLogs.action, "action"],
  [adminAuditLogs.targetType, "targetType"],
  [adminAuditLogs.targetId, "targetId"],
  [adminAuditLogs.metadata, "metadata"],
  [adminAuditLogs.createdAt, "createdAt"],
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

function cloneGymSettings(row) {
  return {
    ...row,
    updatedAt: new Date(row.updatedAt),
  };
}

function cloneAuditLog(row) {
  return {
    ...row,
    metadata: { ...(row.metadata ?? {}) },
    createdAt: new Date(row.createdAt),
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
            if (getUserListShouldFail) {
              throw new Error("Clerk list unavailable");
            }

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

          if (table === gymSettingsTable) {
            const rows = [...gymSettingsByGymId.values()]
              .map(cloneGymSettings)
              .filter((row) => matchesCondition(row, condition, gymSettingsFieldMap));

            return rows.slice(0, count).map((row) => ({ ...row }));
          }

          if (table === adminAuditLogs) {
            const rows = [...adminAuditLogsById.values()]
              .map(cloneAuditLog)
              .filter((row) => matchesCondition(row, condition, adminAuditLogFieldMap));

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
              orderBy() {
                return Promise.resolve(selectRows(table, condition));
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
            if (table === adminAuditLogs) {
              return {
                returning() {
                  const row = {
                    createdAt: new Date("2026-05-07T10:00:00.000Z"),
                    ...values,
                  };
                  adminAuditLogsById.set(row.id, cloneAuditLog(row));
                  return Promise.resolve([cloneAuditLog(row)]);
                },
              };
            }

            if (table === gymSettingsTable) {
              return {
                returning() {
                  const row = {
                    id: gymSettingsByGymId.size + 1,
                    gymId: values.gymId ?? "gymos-main",
                    gymName: values.gymName ?? "GymOS",
                    address: values.address ?? "",
                    phone: values.phone ?? "",
                    workingHours: values.workingHours ?? "Mon-Fri: 6am-10pm, Sat-Sun: 7am-8pm",
                    description: values.description ?? "",
                    updatedAt: new Date("2026-05-07T10:00:00.000Z"),
                  };
                  gymSettingsByGymId.set(row.gymId, cloneGymSettings(row));
                  return Promise.resolve([cloneGymSettings(row)]);
                },
              };
            }

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

                    if (table === gymSettingsTable) {
                      const rows = [...gymSettingsByGymId.values()]
                        .filter((row) => matchesCondition(row, condition, gymSettingsFieldMap))
                        .map((row) => {
                          const nextSettings = {
                            ...row,
                            ...values,
                            updatedAt: values.updatedAt ?? new Date("2026-05-07T10:05:00.000Z"),
                          };
                          gymSettingsByGymId.set(row.gymId, cloneGymSettings(nextSettings));
                          return cloneGymSettings(nextSettings);
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
      delete(table) {
        return {
          where(condition) {
            return {
              returning() {
                if (table === gymClassesTable) {
                  const rows = [...adminClassesById.values()].filter((row) =>
                    matchesCondition(row, condition, gymClassFieldMap),
                  );
                  for (const row of rows) {
                    adminClassesById.delete(row.id);
                  }
                  return Promise.resolve(rows.map(cloneAdminClass));
                }

                return Promise.resolve([]);
              },
            };
          },
        };
      },
    },
    adminAuditLogs,
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

function makeDeleteClassParamsSafeParse() {
  return {
    safeParse(value) {
      return Number.isInteger(value.id)
        ? { success: true, data: value }
        : { success: false, error: { message: "Invalid class ID" } };
    },
  };
}

function makeSettingsBodySafeParse() {
  return {
    safeParse(value) {
      return {
        success: true,
        data: {
          ...(typeof value.gymName === "string" && { gymName: value.gymName }),
          ...(typeof value.address === "string" && { address: value.address }),
          ...(typeof value.phone === "string" && { phone: value.phone }),
          ...(typeof value.workingHours === "string" && { workingHours: value.workingHours }),
          ...(typeof value.description === "string" && { description: value.description }),
        },
      };
    },
  };
}

mock.module("@workspace/api-zod", {
  namedExports: {
    AdminCreateClassBody: makeSafeParse(),
    AdminUpdateClassBody: makeSafeParse(),
    AdminUpdateClassParams: makeSafeParse(),
    AdminDeleteClassParams: makeDeleteClassParamsSafeParse(),
    AdminUpdateSettingsBody: makeSettingsBodySafeParse(),
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
const { clearDashboardMemberCountCache, default: adminRouter } =
  await import("../../src/routes/admin.ts");

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
  gymSettingsByGymId.clear();
  adminAuditLogsById.clear();
  getUserListCalls = 0;
  getUserListShouldFail = false;
  nowMs = Date.parse("2026-05-07T00:00:00.000Z");
  process.env.CLERK_SECRET_KEY = "test_secret_key";
  clearAdminMemberListCache();
  clearDashboardMemberCountCache();

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
  it("returns authoritative class waitlist and checked-in counts", async () => {
    adminClassesById.set(
      1,
      seedAdminClass({
        waitlistedMemberIds: ["member_8", "member_9"],
        attendanceRecords: [
          {
            memberId: "member_1",
            status: "checked_in",
            updatedAt: "2026-05-07T07:00:00.000Z",
            updatedBy: "owner_1",
          },
          {
            memberId: "missing_user",
            status: "no_show",
            updatedAt: "2026-05-07T07:05:00.000Z",
            updatedBy: "owner_1",
          },
        ],
      }),
    );

    const response = await request(app).get("/admin/classes");

    assert.equal(response.status, 200);
    assert.equal(response.body[0].waitlistedCount, 2);
    assert.equal(response.body[0].checkedInCount, 1);
  });

  it("keeps admin class reads and attendance writes scoped to the owner gym", async () => {
    adminClassesById.set(
      3,
      seedAdminClass({
        id: 3,
        gymId: "other-gym",
        name: "Other Gym Strength",
        enrolledMemberIds: ["member_1"],
        attendanceRecords: [
          {
            memberId: "member_1",
            status: "booked",
            updatedAt: "2026-05-07T07:00:00.000Z",
            updatedBy: "owner_2",
          },
        ],
      }),
    );

    const classesResponse = await request(app).get("/admin/classes");
    assert.equal(classesResponse.status, 200);
    assert.deepEqual(
      classesResponse.body.map((cls) => cls.id),
      [1, 2],
    );

    const enrollmentsResponse = await request(app).get("/admin/classes/3/enrollments");
    assert.equal(enrollmentsResponse.status, 404);
    assert.deepEqual(enrollmentsResponse.body, { error: "Class not found" });

    const attendanceResponse = await request(app)
      .patch("/admin/classes/3/enrollments/member_1")
      .send({ attendanceStatus: "checked_in" });
    assert.equal(attendanceResponse.status, 404);
    assert.deepEqual(attendanceResponse.body, { error: "Class not found" });
    assert.equal(adminClassesById.get(3).attendanceRecords[0].status, "booked");
  });

  it("records sanitized audit logs for sensitive admin actions", async () => {
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
    gymSettingsByGymId.set("gymos-main", {
      id: 1,
      gymId: "gymos-main",
      gymName: "GymOS",
      address: "",
      phone: "",
      workingHours: "Mon-Fri: 6am-10pm, Sat-Sun: 7am-8pm",
      description: "",
      updatedAt: new Date("2026-05-07T09:00:00.000Z"),
    });

    const accessResponse = await request(app).post("/admin/member-access").send({
      email: "new.member@example.com",
      role: "member",
      accessStatus: "approved",
      apiToken: "secret-token-that-must-not-persist",
    });
    assert.equal(accessResponse.status, 200);

    const roleResponse = await request(app)
      .patch("/admin/members/member_2")
      .send({ role: "trainer" });
    assert.equal(roleResponse.status, 200);

    const settingsResponse = await request(app).put("/admin/settings").send({
      gymName: "GymOS West",
      address: "123 Main Street",
      bearerToken: "Bearer should-never-persist",
    });
    assert.equal(settingsResponse.status, 200);

    const attendanceResponse = await request(app)
      .patch("/admin/classes/1/enrollments/member_1")
      .send({ attendanceStatus: "checked_in" });
    assert.equal(attendanceResponse.status, 200);

    const deleteResponse = await request(app).delete("/admin/classes/2");
    assert.equal(deleteResponse.status, 204);

    const auditResponse = await request(app).get("/admin/audit-logs?limit=20");
    assert.equal(auditResponse.status, 200);
    const logsByAction = new Map(auditResponse.body.map((entry) => [entry.action, entry]));

    assert.equal(logsByAction.get("access.grant").targetId, "new.member@example.com");
    assert.equal(logsByAction.get("member.role.update").targetId, "member_2");
    assert.deepEqual(logsByAction.get("settings.update").metadata.changedFields, [
      "gymName",
      "address",
    ]);
    assert.deepEqual(logsByAction.get("class.attendance.update").metadata, {
      memberId: "member_1",
      attendanceStatus: "checked_in",
    });
    assert.equal(logsByAction.get("class.delete").targetId, "2");

    for (const log of auditResponse.body) {
      assert.equal(log.gymId, "gymos-main");
      assert.equal(log.actorClerkId, "member_1");
      assert.match(log.createdAt, /^2026-05-07T10:00:00\.000Z$/);
    }
    assert.doesNotMatch(JSON.stringify(auditResponse.body), /secret-token|Bearer|apiToken/i);
  });

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

  it("caches dashboard active member counts for five minutes", async () => {
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

    const firstResponse = await request(app).get("/admin/dashboard");
    const secondResponse = await request(app).get("/admin/dashboard");

    assert.equal(firstResponse.status, 200);
    assert.equal(secondResponse.status, 200);
    assert.equal(firstResponse.body.totalActiveMembers, 2);
    assert.equal(secondResponse.body.totalActiveMembers, 2);
    assert.equal(getUserListCalls, 1);

    nowMs += 5 * 60 * 1_000 + 1;

    const refreshedResponse = await request(app).get("/admin/dashboard");

    assert.equal(refreshedResponse.status, 200);
    assert.equal(refreshedResponse.body.totalActiveMembers, 2);
    assert.equal(getUserListCalls, 2);
  });

  it("computes dashboard owner analytics from existing class rows", async () => {
    adminClassesById.clear();
    adminClassesById.set(
      1,
      seedAdminClass({
        id: 1,
        name: "Yoga Reset",
        category: "Yoga",
        date: "2026-05-05",
        startTime: "08:00",
        enrolledCount: 4,
        maxParticipants: 10,
      }),
    );
    adminClassesById.set(
      2,
      seedAdminClass({
        id: 2,
        name: "Strength Intro",
        category: "Strength",
        date: "2026-05-07",
        startTime: "09:00",
        enrolledCount: 2,
        maxParticipants: 10,
      }),
    );
    adminClassesById.set(
      3,
      seedAdminClass({
        id: 3,
        name: "Strength Prime",
        category: "Strength",
        date: "2026-05-08",
        startTime: "18:00",
        enrolledCount: 8,
        maxParticipants: 10,
      }),
    );
    adminClassesById.set(
      4,
      seedAdminClass({
        id: 4,
        name: "Room Setup",
        category: "Other",
        date: "2026-05-09",
        startTime: "12:00",
        enrolledCount: 0,
        maxParticipants: 0,
      }),
    );
    adminClassesById.set(
      5,
      seedAdminClass({
        id: 5,
        name: "Pilates Control",
        category: "Pilates",
        date: "2026-05-10",
        startTime: "10:00",
        enrolledCount: 1,
        maxParticipants: 10,
      }),
    );
    adminClassesById.set(
      6,
      seedAdminClass({
        id: 6,
        name: "Cancelled Boxing",
        category: "Boxing",
        date: "2026-05-07",
        startTime: "17:00",
        enrolledCount: 3,
        maxParticipants: 10,
        status: "cancelled",
      }),
    );

    const response = await request(app).get("/admin/dashboard");

    assert.equal(response.status, 200);
    assert.equal(response.body.totalClassesThisWeek, 4);
    assert.equal(response.body.totalEnrollments, 18);
    assert.equal(response.body.totalEnrollmentsThisWeek, 14);
    assert.equal(response.body.averageClassOccupancy, 47);
    assert.equal(response.body.upcomingClassesCount, 4);
    assert.equal(response.body.mostPopularCategory, "Strength");
    assert.equal(response.body.totalActiveMembers, 1);
    assert.deepEqual(response.body.lowAttendanceClasses, [
      {
        id: 2,
        name: "Strength Intro",
        date: "2026-05-07",
        startTime: "09:00",
        enrolledCount: 2,
        maxParticipants: 10,
        occupancyPercent: 20,
      },
      {
        id: 5,
        name: "Pilates Control",
        date: "2026-05-10",
        startTime: "10:00",
        enrolledCount: 1,
        maxParticipants: 10,
        occupancyPercent: 10,
      },
    ]);
    assert.equal(getUserListCalls, 1);
  });

  it("uses the last valid dashboard member-count cache when Clerk fails", async () => {
    const firstResponse = await request(app).get("/admin/dashboard");
    assert.equal(firstResponse.status, 200);
    assert.equal(firstResponse.body.totalActiveMembers, 1);
    assert.equal(getUserListCalls, 1);

    nowMs += 5 * 60 * 1_000 + 1;
    getUserListShouldFail = true;

    const staleCacheResponse = await request(app).get("/admin/dashboard");

    assert.equal(staleCacheResponse.status, 200);
    assert.equal(staleCacheResponse.body.totalActiveMembers, 1);
    assert.equal(getUserListCalls, 2);
  });

  it("does not crash dashboard when Clerk member count fails without cache", async () => {
    getUserListShouldFail = true;

    const response = await request(app).get("/admin/dashboard");

    assert.equal(response.status, 200);
    assert.equal(response.body.totalActiveMembers, 0);
  });

  it("skips dashboard member counts when Clerk is not configured", async () => {
    delete process.env.CLERK_SECRET_KEY;

    const response = await request(app).get("/admin/dashboard");

    assert.equal(response.status, 200);
    assert.equal(response.body.totalActiveMembers, 0);
    assert.equal(getUserListCalls, 0);
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
    assert.deepEqual(response.body, { error: "Unauthorized" });
    assert.equal(response.headers.location, undefined);
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
