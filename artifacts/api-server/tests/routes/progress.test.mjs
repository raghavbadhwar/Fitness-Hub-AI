import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import express from "express";
import request from "supertest";

const authState = { userId: "member_1" };
const accessState = { allowed: true, gymId: "gymos-main" };
const progressEntries = new Map();

const memberProgressEntries = {
  id: Symbol("id"),
  gymId: Symbol("gymId"),
  memberClerkId: Symbol("memberClerkId"),
  date: Symbol("date"),
};

const fieldMap = new Map([
  [memberProgressEntries.id, "id"],
  [memberProgressEntries.gymId, "gymId"],
  [memberProgressEntries.memberClerkId, "memberClerkId"],
  [memberProgressEntries.date, "date"],
]);

function rowKey({ gymId, memberClerkId, date }) {
  return `${gymId}:${memberClerkId}:${date}`;
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
  },
});

mock.module("@workspace/db", {
  namedExports: {
    db: {
      select() {
        return {
          from(table) {
            assert.equal(table, memberProgressEntries);
            return {
              where(condition) {
                return Promise.resolve(
                  [...progressEntries.values()]
                    .filter((row) => matchesCondition(row, condition))
                    .map(cloneRow),
                );
              },
            };
          },
        };
      },
      insert(table) {
        assert.equal(table, memberProgressEntries);
        return {
          values(values) {
            return {
              onConflictDoUpdate({ set }) {
                return {
                  returning() {
                    const key = rowKey(values);
                    const existing = progressEntries.get(key);
                    const now = new Date("2026-05-07T10:00:00.000Z");
                    const row = {
                      id: existing?.id ?? values.id,
                      gymId: values.gymId,
                      memberClerkId: values.memberClerkId,
                      date: values.date,
                      weight: existing?.weight,
                      chest: existing?.chest,
                      waist: existing?.waist,
                      hips: existing?.hips,
                      biceps: existing?.biceps,
                      thighs: existing?.thighs,
                      createdAt: existing?.createdAt ?? now,
                      updatedAt: set.updatedAt ?? now,
                      ...values,
                      ...set,
                    };
                    progressEntries.set(key, cloneRow(row));
                    return Promise.resolve([cloneRow(row)]);
                  },
                };
              },
            };
          },
        };
      },
      update(table) {
        assert.equal(table, memberProgressEntries);
        return {
          set(values) {
            return {
              where(condition) {
                return {
                  returning() {
                    const rows = [...progressEntries.values()].filter((row) =>
                      matchesCondition(row, condition),
                    );
                    const updated = rows.map((row) => {
                      progressEntries.delete(rowKey(row));
                      const nextRow = { ...row, ...values };
                      progressEntries.set(rowKey(nextRow), cloneRow(nextRow));
                      return cloneRow(nextRow);
                    });
                    return Promise.resolve(updated);
                  },
                };
              },
            };
          },
        };
      },
      delete(table) {
        assert.equal(table, memberProgressEntries);
        return {
          where(condition) {
            return {
              returning() {
                const rows = [...progressEntries.values()].filter((row) =>
                  matchesCondition(row, condition),
                );
                for (const row of rows) {
                  progressEntries.delete(rowKey(row));
                }
                return Promise.resolve(rows.map((row) => ({ id: row.id })));
              },
            };
          },
        };
      },
    },
    memberProgressEntries,
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

const { default: progressRouter } = await import("../../src/routes/progress.ts");

const app = express();
app.use(express.json());
app.use("/progress", progressRouter);

beforeEach(() => {
  authState.userId = "member_1";
  accessState.allowed = true;
  accessState.gymId = "gymos-main";
  progressEntries.clear();
});

describe("progress routes", () => {
  it("rejects unauthenticated callers before progress logic", async () => {
    authState.userId = null;

    const response = await request(app).get("/progress/entries");

    assert.equal(response.status, 401);
    assert.deepEqual(response.body, { error: "Unauthorized" });
  });

  it("rejects callers without approved access", async () => {
    accessState.allowed = false;

    const response = await request(app).get("/progress/entries");

    assert.equal(response.status, 403);
    assert.deepEqual(response.body, { error: "Access revoked" });
  });

  it("creates and updates a member progress entry by date", async () => {
    const firstResponse = await request(app)
      .post("/progress/entries")
      .send({ date: "2026-05-07", weight: 72.4 });

    assert.equal(firstResponse.status, 201);
    assert.equal(firstResponse.body.date, "2026-05-07");
    assert.equal(firstResponse.body.weight, 72.4);

    const updateResponse = await request(app)
      .post("/progress/entries")
      .send({ date: "2026-05-07", waist: 82, chest: 98 });

    assert.equal(updateResponse.status, 201);
    assert.equal(updateResponse.body.weight, 72.4);
    assert.equal(updateResponse.body.waist, 82);
    assert.equal(progressEntries.size, 1);
  });

  it("patches and deletes entries scoped to the signed-in member", async () => {
    const createResponse = await request(app)
      .post("/progress/entries")
      .send({ date: "2026-05-07", weight: 72.4 });

    const patchResponse = await request(app)
      .patch(`/progress/entries/${createResponse.body.id}`)
      .send({ weight: 71.9 });

    assert.equal(patchResponse.status, 200);
    assert.equal(patchResponse.body.weight, 71.9);

    const deleteResponse = await request(app).delete(`/progress/entries/${createResponse.body.id}`);
    assert.equal(deleteResponse.status, 200);
    assert.deepEqual(deleteResponse.body, { success: true });
    assert.equal(progressEntries.size, 0);
  });

  it("does not expose another user's entries", async () => {
    await request(app).post("/progress/entries").send({ date: "2026-05-07", weight: 72.4 });

    authState.userId = "member_2";
    const response = await request(app).get("/progress/entries");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, []);
  });
});
