import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import express from "express";
import request from "supertest";

const authState = {
  userId: "member_1",
  role: "member",
  gymId: "gym_1",
  allowed: true,
};
const aiState = { shouldThrow: false };
const reviews = new Map();
const profiles = new Map([
  ["member_1", { clerkId: "member_1", gymId: "gym_1", role: "member", name: "Member One" }],
  ["member_2", { clerkId: "member_2", gymId: "gym_1", role: "member", name: "Member Two" }],
  ["member_3", { clerkId: "member_3", gymId: "gym_2", role: "member", name: "Member Three" }],
]);

const monthlyReviews = {
  id: Symbol("monthlyReviews.id"),
  gymId: Symbol("monthlyReviews.gymId"),
  memberClerkId: Symbol("monthlyReviews.memberClerkId"),
  month: Symbol("monthlyReviews.month"),
};
const userProfiles = {
  clerkId: Symbol("userProfiles.clerkId"),
  gymId: Symbol("userProfiles.gymId"),
  role: Symbol("userProfiles.role"),
};
const fieldNames = new Map([
  [monthlyReviews.id, "id"],
  [monthlyReviews.gymId, "gymId"],
  [monthlyReviews.memberClerkId, "memberClerkId"],
  [monthlyReviews.month, "month"],
  [userProfiles.clerkId, "clerkId"],
  [userProfiles.gymId, "gymId"],
  [userProfiles.role, "role"],
]);

function cloneReview(review) {
  return {
    ...review,
    metrics: { ...review.metrics },
    badges: review.badges.map((badge) => ({ ...badge })),
    suggestedAdjustments: review.suggestedAdjustments.map((suggestion) => ({ ...suggestion })),
    generatedAt: new Date(review.generatedAt),
    reviewedAt: review.reviewedAt ? new Date(review.reviewedAt) : null,
    createdAt: new Date(review.createdAt),
    updatedAt: new Date(review.updatedAt),
  };
}

function matchesCondition(row, condition) {
  if (!condition) return true;
  if (condition.op === "and") {
    return condition.conditions.every((entry) => matchesCondition(row, entry));
  }
  if (condition.op === "eq") {
    return row[fieldNames.get(condition.field)] === condition.value;
  }
  return true;
}

function selectRows(table, condition, selection) {
  const source =
    table === monthlyReviews
      ? [...reviews.values()].map(cloneReview)
      : [...profiles.values()].map((profile) => ({ ...profile }));
  const rows = source.filter((row) => matchesCondition(row, condition));

  if (!selection) return rows;
  return rows.map((row) => {
    const selected = {};
    for (const [key, field] of Object.entries(selection)) {
      selected[key] = row[fieldNames.get(field)];
    }
    return selected;
  });
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
      return (_req, _res, next) => next();
    },
    getAuth() {
      return { userId: authState.userId };
    },
  },
});

mock.module("@workspace/integrations-gemini-ai", {
  namedExports: {
    ai: {
      models: {
        async generateContent() {
          if (aiState.shouldThrow) {
            throw new Error("AI unavailable");
          }

          return {
            text: JSON.stringify({
              aiSummary: "Strong month with clear training momentum.",
              coachNote:
                "Keep the current weekly rhythm and make one nutrition adjustment. No changes should auto-apply.",
              suggestedAdjustments: [
                {
                  category: "workout",
                  title: "Repeat Push Day twice weekly",
                  detail: "Use the same main lift twice weekly for two weeks.",
                  priority: "medium",
                },
              ],
            }),
          };
        },
      },
    },
  },
});

mock.module("@workspace/db", {
  namedExports: {
    monthlyReviews,
    userProfiles,
    db: {
      select(selection) {
        return {
          from(table) {
            return {
              where(condition) {
                const rows = selectRows(table, condition, selection);
                return {
                  limit(limit) {
                    return Promise.resolve(rows.slice(0, limit));
                  },
                };
              },
            };
          },
        };
      },
      insert(table) {
        return {
          values(values) {
            return {
              returning() {
                const now = new Date("2026-05-05T12:00:00.000Z");
                const row = {
                  ...values,
                  createdAt: now,
                  updatedAt: now,
                  reviewedAt: null,
                };
                if (table === monthlyReviews) {
                  reviews.set(row.id, row);
                }
                return Promise.resolve([cloneReview(row)]);
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
                    if (table !== monthlyReviews) return Promise.resolve([]);
                    const updated = [];
                    for (const [id, row] of reviews.entries()) {
                      if (!matchesCondition(row, condition)) continue;
                      const next = { ...row, ...values };
                      reviews.set(id, next);
                      updated.push(cloneReview(next));
                    }
                    return Promise.resolve(updated);
                  },
                };
              },
            };
          },
        };
      },
    },
  },
});

mock.module("../../src/lib/user-access.ts", {
  namedExports: {
    async requireApprovedAccess(_req, res, roles) {
      if (!authState.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return null;
      }

      if (!authState.allowed) {
        res.status(403).json({ error: "Access revoked", status: "revoked" });
        return null;
      }

      if (roles && !roles.includes(authState.role)) {
        res.status(403).json({ error: "Forbidden" });
        return null;
      }

      return {
        allowed: true,
        userId: authState.userId,
        email: `${authState.userId}@example.com`,
        role: authState.role,
        gymId: authState.gymId,
        profile: null,
        control: null,
      };
    },
  },
});

const { default: monthlyReviewsRouter } = await import("../../src/routes/monthly-reviews.ts");

const app = express();
app.use(express.json());
app.use("/monthly-reviews", monthlyReviewsRouter);

beforeEach(() => {
  authState.userId = "member_1";
  authState.role = "member";
  authState.gymId = "gym_1";
  authState.allowed = true;
  aiState.shouldThrow = false;
  reviews.clear();
});

function reviewPayload() {
  return {
    month: "2026-05",
    metrics: {
      monthLabel: "May 2026",
      elapsedDays: 5,
      completedWorkouts: 3,
      workoutDays: 3,
      consistencyRate: 60,
      nutritionLoggedDays: 4,
      proteinAdherenceRate: 50,
      prCount: 1,
      risks: [],
    },
    badges: [
      {
        id: "consistency",
        label: "Consistency",
        detail: "3 training days",
        tone: "success",
      },
    ],
    suggestedAdjustments: [
      {
        id: "protein",
        category: "nutrition",
        title: "Increase protein consistency",
        detail: "Add one planned high-protein meal on training days.",
        priority: "medium",
        source: "deterministic",
      },
    ],
  };
}

describe("monthly review routes", () => {
  it("generates and retrieves a saved member monthly review", async () => {
    const generated = await request(app).post("/monthly-reviews/generate").send(reviewPayload());

    assert.equal(generated.status, 201);
    assert.equal(generated.body.review.memberClerkId, "member_1");
    assert.equal(generated.body.review.aiSummary, "Strong month with clear training momentum.");
    assert.equal(generated.body.review.status, "generated");

    const fetched = await request(app).get("/monthly-reviews?month=2026-05");

    assert.equal(fetched.status, 200);
    assert.equal(fetched.body.review.id, generated.body.review.id);
    assert.equal(fetched.body.review.metrics.completedWorkouts, 3);
  });

  it("falls back to deterministic review text when AI generation fails", async () => {
    aiState.shouldThrow = true;

    const response = await request(app).post("/monthly-reviews/generate").send(reviewPayload());

    assert.equal(response.status, 201);
    assert.match(response.body.review.aiSummary, /month saved|strong month|starting point/i);
    assert.ok(response.body.review.suggestedAdjustments.length > 0);
  });

  it("lets trainers fetch and mark a member monthly review as reviewed", async () => {
    const generated = await request(app).post("/monthly-reviews/generate").send(reviewPayload());
    authState.userId = "trainer_1";
    authState.role = "trainer";

    const fetched = await request(app).get("/monthly-reviews?memberId=member_1&month=2026-05");

    assert.equal(fetched.status, 200);
    assert.equal(fetched.body.review.id, generated.body.review.id);

    const reviewed = await request(app)
      .patch(`/monthly-reviews/${generated.body.review.id}/review`)
      .send({ reviewed: true });

    assert.equal(reviewed.status, 200);
    assert.equal(reviewed.body.review.status, "reviewed");
    assert.ok(reviewed.body.review.reviewedAt);
  });

  it("keeps trainer monthly review access scoped to the trainer's gym", async () => {
    authState.userId = "member_3";
    authState.role = "member";
    authState.gymId = "gym_2";
    const generated = await request(app).post("/monthly-reviews/generate").send(reviewPayload());
    assert.equal(generated.status, 201);

    authState.userId = "trainer_1";
    authState.role = "trainer";
    authState.gymId = "gym_1";

    const crossGymFetch = await request(app).get(
      "/monthly-reviews?memberId=member_3&month=2026-05",
    );
    assert.equal(crossGymFetch.status, 404);
    assert.deepEqual(crossGymFetch.body, { error: "Member not found" });

    const crossGymReview = await request(app)
      .patch(`/monthly-reviews/${generated.body.review.id}/review`)
      .send({ reviewed: true });
    assert.equal(crossGymReview.status, 404);
    assert.deepEqual(crossGymReview.body, { error: "Monthly review not found" });
    assert.equal(reviews.get(generated.body.review.id).status, "generated");

    authState.userId = "trainer_2";
    authState.role = "trainer";
    authState.gymId = "gym_2";
    const sameGymFetch = await request(app).get("/monthly-reviews?memberId=member_3&month=2026-05");
    assert.equal(sameGymFetch.status, 200);
    assert.equal(sameGymFetch.body.review.id, generated.body.review.id);
  });

  it("rejects invalid months and cross-member member access", async () => {
    const invalidMonth = await request(app).get("/monthly-reviews?month=2026-13");
    assert.equal(invalidMonth.status, 400);

    const crossMember = await request(app).get("/monthly-reviews?memberId=member_2&month=2026-05");
    assert.equal(crossMember.status, 403);
  });

  it("blocks revoked access before returning review data", async () => {
    authState.allowed = false;

    const response = await request(app).post("/monthly-reviews/generate").send(reviewPayload());

    assert.equal(response.status, 403);
    assert.deepEqual(response.body, { error: "Access revoked", status: "revoked" });
  });
});
