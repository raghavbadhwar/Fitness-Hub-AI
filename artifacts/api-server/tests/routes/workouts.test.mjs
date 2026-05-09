import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import express from "express";
import request from "supertest";

const authState = { userId: "member_1", gymId: "gymos-main" };
const plansByMemberClerkId = new Map();
const sessionsById = new Map();
const personalRecordsByKey = new Map();

const memberWorkoutPlans = {
  id: Symbol("memberWorkoutPlans.id"),
  gymId: Symbol("memberWorkoutPlans.gymId"),
  memberClerkId: Symbol("memberWorkoutPlans.memberClerkId"),
  name: Symbol("memberWorkoutPlans.name"),
  focus: Symbol("memberWorkoutPlans.focus"),
  exercises: Symbol("memberWorkoutPlans.exercises"),
  createdAt: Symbol("memberWorkoutPlans.createdAt"),
  updatedAt: Symbol("memberWorkoutPlans.updatedAt"),
};

const memberWorkoutSessions = {
  id: Symbol("memberWorkoutSessions.id"),
  gymId: Symbol("memberWorkoutSessions.gymId"),
  memberClerkId: Symbol("memberWorkoutSessions.memberClerkId"),
  updatedAt: Symbol("memberWorkoutSessions.updatedAt"),
};

const memberPersonalRecords = {
  id: Symbol("memberPersonalRecords.id"),
  gymId: Symbol("memberPersonalRecords.gymId"),
  memberClerkId: Symbol("memberPersonalRecords.memberClerkId"),
  exerciseId: Symbol("memberPersonalRecords.exerciseId"),
};

const workoutAssignments = { id: Symbol("id") };
const workoutTemplates = { id: Symbol("id") };
const userProfiles = {
  clerkId: Symbol("clerkId"),
  gymId: Symbol("gymId"),
  name: Symbol("name"),
  role: Symbol("role"),
};

const fieldMap = new Map([
  [memberWorkoutPlans.id, "id"],
  [memberWorkoutPlans.gymId, "gymId"],
  [memberWorkoutPlans.memberClerkId, "memberClerkId"],
  [memberWorkoutSessions.id, "id"],
  [memberWorkoutSessions.gymId, "gymId"],
  [memberWorkoutSessions.memberClerkId, "memberClerkId"],
  [memberPersonalRecords.id, "id"],
  [memberPersonalRecords.gymId, "gymId"],
  [memberPersonalRecords.memberClerkId, "memberClerkId"],
  [memberPersonalRecords.exerciseId, "exerciseId"],
]);

mock.module("drizzle-orm", {
  namedExports: {
    eq(field, value) {
      return { op: "eq", field, value };
    },
    and(...conditions) {
      return { op: "and", conditions };
    },
    isNull(field) {
      return { op: "isNull", field };
    },
    desc(field) {
      return { op: "desc", field };
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
          async getUserList() {
            return { data: [] };
          },
        },
      };
    },
  },
});

function personalRecordKey(row) {
  return `${row.gymId}:${row.memberClerkId}:${row.exerciseId}`;
}

function cloneDate(value) {
  return value instanceof Date ? new Date(value) : value;
}

function cloneRow(row) {
  return {
    ...row,
    exercises: Array.isArray(row.exercises)
      ? row.exercises.map((exercise) => ({
          ...exercise,
          sets: Array.isArray(exercise.sets)
            ? exercise.sets.map((set) => ({ ...set }))
            : exercise.sets,
        }))
      : row.exercises,
    createdAt: cloneDate(row.createdAt),
    updatedAt: cloneDate(row.updatedAt),
    startTime: cloneDate(row.startTime),
    endTime: cloneDate(row.endTime),
  };
}

function rowsForTable(table) {
  if (table === memberWorkoutPlans) return [...plansByMemberClerkId.values()];
  if (table === memberWorkoutSessions) return [...sessionsById.values()];
  if (table === memberPersonalRecords) return [...personalRecordsByKey.values()];
  return [];
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

function findRows(table, condition) {
  return rowsForTable(table)
    .filter((row) => matchesCondition(row, condition))
    .map(cloneRow);
}

function saveTableRow(table, row) {
  if (table === memberWorkoutPlans) {
    plansByMemberClerkId.set(row.memberClerkId, cloneRow(row));
    return;
  }
  if (table === memberWorkoutSessions) {
    sessionsById.set(row.id, cloneRow(row));
    return;
  }
  if (table === memberPersonalRecords) {
    personalRecordsByKey.set(personalRecordKey(row), cloneRow(row));
  }
}

mock.module("@workspace/db", {
  namedExports: {
    db: {
      select() {
        return {
          from(table) {
            const makeQuery = (condition) => ({
              orderBy() {
                return Promise.resolve(
                  findRows(table, condition).sort((left, right) => {
                    const leftTime = left.updatedAt?.getTime?.() ?? 0;
                    const rightTime = right.updatedAt?.getTime?.() ?? 0;
                    return rightTime - leftTime;
                  }),
                );
              },
              limit(count) {
                return Promise.resolve(findRows(table, condition).slice(0, count));
              },
              then(resolve, reject) {
                return Promise.resolve(findRows(table, condition)).then(resolve, reject);
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
        return {
          values(values) {
            const returning = () => {
              const now = new Date("2026-05-07T10:00:00.000Z");
              const row = {
                createdAt: now,
                updatedAt: now,
                ...values,
              };
              saveTableRow(table, row);
              return Promise.resolve([cloneRow(row)]);
            };

            if (table !== memberPersonalRecords) {
              return { returning };
            }

            return {
              onConflictDoUpdate({ set }) {
                return {
                  returning() {
                    const existing = personalRecordsByKey.get(personalRecordKey(values));
                    const row = {
                      createdAt: existing?.createdAt ?? new Date("2026-05-07T10:00:00.000Z"),
                      updatedAt: new Date("2026-05-07T10:05:00.000Z"),
                      ...values,
                      ...(existing ? { id: existing.id } : {}),
                      ...set,
                    };
                    saveTableRow(table, row);
                    return Promise.resolve([cloneRow(row)]);
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
                    const updated = findRows(table, condition).map((row) => {
                      const nextRow = {
                        ...row,
                        ...values,
                        updatedAt: values.updatedAt ?? row.updatedAt,
                      };
                      saveTableRow(table, nextRow);
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
        return {
          where(condition) {
            return {
              returning() {
                const deleted = findRows(table, condition);
                if (table === memberWorkoutSessions) {
                  for (const row of deleted) sessionsById.delete(row.id);
                }
                if (table === memberWorkoutPlans) {
                  for (const row of deleted) plansByMemberClerkId.delete(row.memberClerkId);
                }
                return Promise.resolve(deleted.map((row) => ({ id: row.id })));
              },
            };
          },
        };
      },
    },
    userProfiles,
  },
});

mock.module("@workspace/db/schema", {
  namedExports: {
    memberPersonalRecords,
    memberWorkoutPlans,
    memberWorkoutSessions,
    workoutAssignments,
    workoutTemplates,
  },
});

mock.module("../../src/lib/user-access.ts", {
  namedExports: {
    async requireApprovedAccess(_req, res) {
      if (!authState.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return null;
      }

      return {
        allowed: true,
        userId: authState.userId,
        email: "member@example.com",
        gymId: authState.gymId,
        role: "member",
        profile: null,
        control: null,
      };
    },
  },
});

const { default: workoutsRouter } = await import("../../src/routes/workouts.ts");

const app = express();
app.use(express.json());
app.use("/workouts", workoutsRouter);

function workoutSessionPayload(overrides = {}) {
  return {
    id: "session_1",
    name: "Push Day",
    date: "2026-05-07",
    startTime: Date.parse("2026-05-07T08:00:00.000Z"),
    endTime: Date.parse("2026-05-07T08:45:00.000Z"),
    duration: 45,
    exercises: [
      {
        id: "exercise_1",
        exerciseId: "bench",
        name: "Bench Press",
        sets: [
          { id: "set_1", weight: 100, reps: 5, completed: true },
          { id: "set_2", weight: 80, reps: 8, completed: true },
        ],
      },
    ],
    totalVolume: 1140,
    caloriesBurned: 270,
    completed: true,
    ...overrides,
  };
}

beforeEach(() => {
  authState.userId = "member_1";
  authState.gymId = "gymos-main";
  plansByMemberClerkId.clear();
  sessionsById.clear();
  personalRecordsByKey.clear();
  plansByMemberClerkId.set("member_1", {
    id: "plan_1",
    gymId: "gymos-main",
    memberClerkId: "member_1",
    name: "Upper Push",
    focus: "upper body",
    exercises: [
      { exerciseId: "bench", name: "Bench Press", sets: 3, reps: 8, notes: "controlled tempo" },
    ],
    createdAt: new Date("2026-04-18T09:00:00.000Z"),
    updatedAt: new Date("2026-04-20T09:30:00.000Z"),
  });
});

describe("workouts routes", () => {
  it("returns the caller's saved workout plans", async () => {
    const response = await request(app).get("/workouts/member-plans");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, [
      {
        id: "plan_1",
        gymId: "gymos-main",
        memberClerkId: "member_1",
        name: "Upper Push",
        focus: "upper body",
        exercises: [
          { exerciseId: "bench", name: "Bench Press", sets: 3, reps: 8, notes: "controlled tempo" },
        ],
        createdAt: "2026-04-18T09:00:00.000Z",
        updatedAt: "2026-04-20T09:30:00.000Z",
        source: "member",
      },
    ]);
  });

  it("returns unauthorized when the caller has no auth context", async () => {
    authState.userId = null;

    const response = await request(app).get("/workouts/member-plans");

    assert.equal(response.status, 401);
    assert.deepEqual(response.body, { error: "Unauthorized" });
  });

  it("creates completed sessions and persists personal records", async () => {
    const response = await request(app).post("/workouts/sessions").send(workoutSessionPayload());

    assert.equal(response.status, 201);
    assert.equal(response.body.session.id, "session_1");
    assert.equal(response.body.session.completed, true);
    assert.equal(response.body.personalRecords.length, 1);
    assert.equal(response.body.personalRecords[0].exerciseId, "bench");

    const recordsResponse = await request(app).get("/workouts/personal-records");
    assert.equal(recordsResponse.status, 200);
    assert.equal(recordsResponse.body.bench.weight, 100);
    assert.equal(recordsResponse.body.bench.reps, 5);
  });

  it("rejects workout sessions with exercises that have no valid sets", async () => {
    const response = await request(app)
      .post("/workouts/sessions")
      .send(
        workoutSessionPayload({
          exercises: [{ id: "exercise_1", exerciseId: "bench", name: "Bench Press", sets: [] }],
        }),
      );

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, { error: "Invalid workout session payload" });
    assert.equal(sessionsById.size, 0);
  });

  it("lists sessions and records only for the signed-in member", async () => {
    await request(app).post("/workouts/sessions").send(workoutSessionPayload());

    const memberOneResponse = await request(app).get("/workouts/sessions");
    assert.equal(memberOneResponse.status, 200);
    assert.equal(memberOneResponse.body.length, 1);

    authState.userId = "member_2";
    const memberTwoSessionsResponse = await request(app).get("/workouts/sessions");
    assert.equal(memberTwoSessionsResponse.status, 200);
    assert.deepEqual(memberTwoSessionsResponse.body, []);

    const memberTwoRecordsResponse = await request(app).get("/workouts/personal-records");
    assert.equal(memberTwoRecordsResponse.status, 200);
    assert.deepEqual(memberTwoRecordsResponse.body, {});
  });

  it("updates sessions without duplicating rows and improves personal records", async () => {
    await request(app).post("/workouts/sessions").send(workoutSessionPayload());

    const response = await request(app)
      .patch("/workouts/sessions/session_1")
      .send(
        workoutSessionPayload({
          exercises: [
            {
              id: "exercise_1",
              exerciseId: "bench",
              name: "Bench Press",
              sets: [{ id: "set_1", weight: 110, reps: 5, completed: true }],
            },
          ],
          totalVolume: 550,
        }),
      );

    assert.equal(response.status, 200);
    assert.equal(response.body.session.totalVolume, 550);
    assert.equal(response.body.personalRecords[0].weight, 110);
    assert.equal(sessionsById.size, 1);
  });

  it("deletes only the caller's workout sessions", async () => {
    await request(app).post("/workouts/sessions").send(workoutSessionPayload());

    authState.userId = "member_2";
    const forbiddenDelete = await request(app).delete("/workouts/sessions/session_1");
    assert.equal(forbiddenDelete.status, 404);
    assert.equal(sessionsById.size, 1);

    authState.userId = "member_1";
    const deleteResponse = await request(app).delete("/workouts/sessions/session_1");
    assert.equal(deleteResponse.status, 200);
    assert.deepEqual(deleteResponse.body, { success: true });
    assert.equal(sessionsById.size, 0);
  });

  it("keeps workout sessions and records isolated by gym for the same Clerk user", async () => {
    await request(app).post("/workouts/sessions").send(workoutSessionPayload());

    authState.gymId = "other-gym";

    const otherGymSessions = await request(app).get("/workouts/sessions");
    assert.equal(otherGymSessions.status, 200);
    assert.deepEqual(otherGymSessions.body, []);

    const otherGymRecords = await request(app).get("/workouts/personal-records");
    assert.equal(otherGymRecords.status, 200);
    assert.deepEqual(otherGymRecords.body, {});

    const otherGymDelete = await request(app).delete("/workouts/sessions/session_1");
    assert.equal(otherGymDelete.status, 404);
    assert.deepEqual(otherGymDelete.body, { error: "Workout session not found" });
    assert.equal(sessionsById.size, 1);

    const duplicateSessionId = await request(app)
      .post("/workouts/sessions")
      .send(workoutSessionPayload());
    assert.equal(duplicateSessionId.status, 409);
    assert.deepEqual(duplicateSessionId.body, { error: "Workout session id already exists" });

    authState.gymId = "gymos-main";
    const mainGymSessions = await request(app).get("/workouts/sessions");
    assert.equal(mainGymSessions.status, 200);
    assert.equal(mainGymSessions.body.length, 1);
    assert.equal(mainGymSessions.body[0].id, "session_1");
  });

  it("does not allow a caller to overwrite another user's session id", async () => {
    await request(app).post("/workouts/sessions").send(workoutSessionPayload());

    authState.userId = "member_2";
    const response = await request(app).post("/workouts/sessions").send(workoutSessionPayload());

    assert.equal(response.status, 409);
    assert.deepEqual(response.body, { error: "Workout session id already exists" });
  });
});
