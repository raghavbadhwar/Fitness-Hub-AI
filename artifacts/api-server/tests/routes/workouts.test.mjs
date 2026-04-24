import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import express from "express";
import request from "supertest";

const authState = { userId: "member_1" };
const plansByMemberClerkId = new Map();

const memberWorkoutPlans = {
  id: Symbol("id"),
  memberClerkId: Symbol("memberClerkId"),
  name: Symbol("name"),
  focus: Symbol("focus"),
  exercises: Symbol("exercises"),
  createdAt: Symbol("createdAt"),
  updatedAt: Symbol("updatedAt"),
};

const workoutAssignments = { id: Symbol("id") };
const workoutTemplates = { id: Symbol("id") };
const userProfiles = { clerkId: Symbol("clerkId"), name: Symbol("name"), role: Symbol("role") };

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

function clonePlan(plan) {
  return {
    ...plan,
    exercises: Array.isArray(plan.exercises)
      ? plan.exercises.map((exercise) => ({ ...exercise }))
      : plan.exercises,
    createdAt: new Date(plan.createdAt),
    updatedAt: new Date(plan.updatedAt),
  };
}

mock.module("@workspace/db", {
  namedExports: {
    db: {
      select() {
        return {
          from(table) {
            return {
              where(condition) {
                const rows =
                  table === memberWorkoutPlans && condition?.op === "eq"
                    ? [...plansByMemberClerkId.values()]
                        .filter((plan) => plan.memberClerkId === condition.value)
                        .map(clonePlan)
                    : [];

                return {
                  orderBy() {
                    return Promise.resolve(
                      rows
                        .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
                        .map((plan) => ({
                          ...plan,
                          source: "member",
                        })),
                    );
                  },
                };
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
    memberWorkoutPlans,
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

beforeEach(() => {
  authState.userId = "member_1";
  plansByMemberClerkId.clear();
  plansByMemberClerkId.set("member_1", {
    id: "plan_1",
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
});
