import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import express from "express";
import request from "supertest";

const authState = { userId: "member_1" };
const accessState = { allowed: true, gymId: "gymos-main" };
const preferences = new Map();

const memberNotificationPreferences = {
  id: Symbol("id"),
  gymId: Symbol("gymId"),
  memberClerkId: Symbol("memberClerkId"),
};

const fieldMap = new Map([
  [memberNotificationPreferences.id, "id"],
  [memberNotificationPreferences.gymId, "gymId"],
  [memberNotificationPreferences.memberClerkId, "memberClerkId"],
]);

function rowKey(row) {
  return `${row.gymId}:${row.memberClerkId}`;
}

function cloneRow(row) {
  return {
    ...row,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

function matchesCondition(row, condition) {
  if (!condition) return true;
  if (condition.op === "and") {
    return condition.conditions.every((child) => matchesCondition(row, child));
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
  },
});

mock.module("@clerk/express", {
  namedExports: {
    requireAuth() {
      return (_req, res, next) => {
        if (!authState.userId) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }
        next();
      };
    },
    getAuth() {
      return { userId: authState.userId };
    },
  },
});

mock.module("@workspace/db", {
  namedExports: {
    db: {
      select() {
        return {
          from(table) {
            assert.equal(table, memberNotificationPreferences);
            return {
              where(condition) {
                return {
                  limit(count) {
                    return Promise.resolve(
                      [...preferences.values()]
                        .filter((row) => matchesCondition(row, condition))
                        .slice(0, count)
                        .map(cloneRow),
                    );
                  },
                };
              },
            };
          },
        };
      },
      insert(table) {
        assert.equal(table, memberNotificationPreferences);
        return {
          values(values) {
            return {
              onConflictDoUpdate({ set }) {
                return {
                  returning() {
                    const existing = preferences.get(rowKey(values));
                    const now = new Date("2026-05-07T10:00:00.000Z");
                    const row = {
                      id: existing?.id ?? values.id,
                      gymId: values.gymId,
                      memberClerkId: values.memberClerkId,
                      createdAt: existing?.createdAt ?? now,
                      updatedAt: set.updatedAt ?? now,
                      ...values,
                      ...set,
                    };
                    preferences.set(rowKey(row), cloneRow(row));
                    return Promise.resolve([cloneRow(row)]);
                  },
                };
              },
            };
          },
        };
      },
    },
    memberNotificationPreferences,
  },
});

mock.module("../../src/lib/user-access.ts", {
  namedExports: {
    async requireApprovedAccess(_req, res) {
      if (!authState.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return null;
      }

      if (!accessState.allowed) {
        res.status(403).json({ error: "Access revoked" });
        return null;
      }

      return {
        allowed: true,
        userId: authState.userId,
        email: "member@example.com",
        role: "member",
        gymId: accessState.gymId,
        profile: null,
        control: null,
      };
    },
  },
});

const { default: notificationsRouter } = await import("../../src/routes/notifications.ts");

const app = express();
app.use(express.json());
app.use("/notifications", notificationsRouter);

beforeEach(() => {
  authState.userId = "member_1";
  accessState.allowed = true;
  accessState.gymId = "gymos-main";
  preferences.clear();
});

describe("notification preferences routes", () => {
  it("returns safe defaults before preferences are stored", async () => {
    const response = await request(app).get("/notifications/preferences");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      classRemindersEnabled: true,
      workoutRemindersEnabled: true,
      reminderLeadMinutes: 60,
      emailEnabled: true,
      pushEnabled: false,
    });
  });

  it("updates preferences for the signed-in member", async () => {
    const response = await request(app).put("/notifications/preferences").send({
      classRemindersEnabled: false,
      workoutRemindersEnabled: true,
      reminderLeadMinutes: 30,
      emailEnabled: false,
      pushEnabled: true,
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.classRemindersEnabled, false);
    assert.equal(response.body.reminderLeadMinutes, 30);
    assert.equal(response.body.pushEnabled, true);
    assert.equal(preferences.size, 1);
  });

  it("does not expose another user's preferences", async () => {
    await request(app).put("/notifications/preferences").send({
      classRemindersEnabled: false,
      workoutRemindersEnabled: false,
      reminderLeadMinutes: 15,
      emailEnabled: false,
      pushEnabled: true,
    });

    authState.userId = "member_2";
    const response = await request(app).get("/notifications/preferences");

    assert.equal(response.status, 200);
    assert.equal(response.body.classRemindersEnabled, true);
    assert.equal(response.body.pushEnabled, false);
  });

  it("rejects unauthenticated and revoked callers", async () => {
    authState.userId = null;
    const unauthenticated = await request(app).get("/notifications/preferences");
    assert.equal(unauthenticated.status, 401);

    authState.userId = "member_1";
    accessState.allowed = false;
    const revoked = await request(app).put("/notifications/preferences").send({});
    assert.equal(revoked.status, 403);
  });
});
