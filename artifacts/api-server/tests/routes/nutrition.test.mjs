import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import express from "express";
import request from "supertest";

const authState = { userId: "member_1" };
const accessState = { allowed: true, gymId: "gymos-main" };
const nutritionLogs = new Map();

const memberNutritionLogs = {
  id: Symbol("id"),
  gymId: Symbol("gymId"),
  memberClerkId: Symbol("memberClerkId"),
  date: Symbol("date"),
};

const fieldMap = new Map([
  [memberNutritionLogs.id, "id"],
  [memberNutritionLogs.gymId, "gymId"],
  [memberNutritionLogs.memberClerkId, "memberClerkId"],
  [memberNutritionLogs.date, "date"],
]);

function rowKey({ gymId, memberClerkId, date }) {
  return `${gymId}:${memberClerkId}:${date}`;
}

function cloneRow(row) {
  return {
    ...row,
    entries: row.entries.map((entry) => ({ ...entry })),
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
  },
});

mock.module("@workspace/db", {
  namedExports: {
    db: {
      select() {
        return {
          from(table) {
            assert.equal(table, memberNutritionLogs);
            const makeQuery = (condition) => ({
              limit(count) {
                return Promise.resolve(
                  [...nutritionLogs.values()]
                    .filter((row) => matchesCondition(row, condition))
                    .slice(0, count)
                    .map(cloneRow),
                );
              },
              then(resolve, reject) {
                return Promise.resolve(
                  [...nutritionLogs.values()]
                    .filter((row) => matchesCondition(row, condition))
                    .map(cloneRow),
                ).then(resolve, reject);
              },
            });

            return {
              where(condition) {
                return makeQuery(condition);
              },
            };
          },
        };
      },
      insert(table) {
        assert.equal(table, memberNutritionLogs);
        return {
          values(values) {
            return {
              onConflictDoUpdate({ set }) {
                return {
                  returning() {
                    const key = rowKey(values);
                    const existing = nutritionLogs.get(key);
                    const now = new Date("2026-05-07T10:00:00.000Z");
                    const row = {
                      id: existing?.id ?? values.id,
                      gymId: values.gymId,
                      memberClerkId: values.memberClerkId,
                      date: values.date,
                      entries: set?.entries ?? values.entries,
                      waterIntake: set?.waterIntake ?? values.waterIntake,
                      createdAt: existing?.createdAt ?? now,
                      updatedAt: set?.updatedAt ?? existing?.updatedAt ?? now,
                    };
                    nutritionLogs.set(key, cloneRow(row));
                    return Promise.resolve([cloneRow(row)]);
                  },
                };
              },
            };
          },
        };
      },
    },
    memberNutritionLogs,
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

const { default: nutritionRouter } = await import("../../src/routes/nutrition.ts");

const app = express();
app.use(express.json());
app.use("/nutrition", nutritionRouter);

beforeEach(() => {
  authState.userId = "member_1";
  accessState.allowed = true;
  accessState.gymId = "gymos-main";
  nutritionLogs.clear();
});

describe("nutrition routes", () => {
  it("rejects unauthenticated callers before nutrition logic", async () => {
    authState.userId = null;

    const response = await request(app).get("/nutrition/logs/2026-05-07");

    assert.equal(response.status, 401);
    assert.deepEqual(response.body, { error: "Unauthorized" });
  });

  it("rejects callers without approved member access", async () => {
    accessState.allowed = false;

    const response = await request(app).get("/nutrition/logs/2026-05-07");

    assert.equal(response.status, 403);
    assert.deepEqual(response.body, { error: "Access revoked" });
  });

  it("creates and updates a single-day nutrition log for the signed-in member", async () => {
    const firstResponse = await request(app)
      .put("/nutrition/logs/2026-05-07")
      .send({
        entries: [{ id: "entry_1", name: "Dal", calories: 220 }],
        waterIntake: 4,
      });

    assert.equal(firstResponse.status, 200);
    assert.equal(firstResponse.body.date, "2026-05-07");
    assert.equal(firstResponse.body.waterIntake, 4);
    assert.equal(firstResponse.body.entries[0].name, "Dal");

    const updateResponse = await request(app)
      .put("/nutrition/logs/2026-05-07")
      .send({
        entries: [{ id: "entry_2", name: "Paneer", calories: 300 }],
        waterIntake: 6,
      });

    assert.equal(updateResponse.status, 200);
    assert.equal(updateResponse.body.waterIntake, 6);
    assert.equal(updateResponse.body.entries[0].name, "Paneer");
    assert.equal(nutritionLogs.size, 1);
  });

  it("fetches a single day and returns an empty log when missing", async () => {
    await request(app)
      .put("/nutrition/logs/2026-05-07")
      .send({ entries: [{ id: "entry_1", name: "Dal" }], waterIntake: 3 });

    const existingResponse = await request(app).get("/nutrition/logs/2026-05-07");
    assert.equal(existingResponse.status, 200);
    assert.equal(existingResponse.body.entries[0].name, "Dal");

    const missingResponse = await request(app).get("/nutrition/logs/2026-05-08");
    assert.equal(missingResponse.status, 200);
    assert.deepEqual(missingResponse.body, {
      date: "2026-05-08",
      entries: [],
      waterIntake: 0,
    });
  });

  it("fetches a date range scoped to the signed-in member", async () => {
    await request(app)
      .put("/nutrition/logs/2026-05-06")
      .send({ entries: [{ id: "entry_1", name: "Poha" }], waterIntake: 2 });
    await request(app)
      .put("/nutrition/logs/2026-05-07")
      .send({ entries: [{ id: "entry_2", name: "Dal" }], waterIntake: 4 });
    await request(app)
      .put("/nutrition/logs/2026-05-08")
      .send({ entries: [{ id: "entry_3", name: "Curd" }], waterIntake: 5 });

    const response = await request(app).get("/nutrition/logs?from=2026-05-07&to=2026-05-08");

    assert.equal(response.status, 200);
    assert.deepEqual(
      response.body.map((log) => log.date),
      ["2026-05-07", "2026-05-08"],
    );
  });

  it("does not expose another user's nutrition logs", async () => {
    await request(app)
      .put("/nutrition/logs/2026-05-07")
      .send({ entries: [{ id: "entry_1", name: "Dal" }], waterIntake: 4 });

    authState.userId = "member_2";
    const response = await request(app).get("/nutrition/logs/2026-05-07");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      date: "2026-05-07",
      entries: [],
      waterIntake: 0,
    });
  });
});
