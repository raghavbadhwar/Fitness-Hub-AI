import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import express from "express";
import request from "supertest";

const authState = { userId: "member_1" };
const accessState = { allowed: true };
const dbState = {
  selectedProfiles: [],
  lastInsert: null,
  lastUpdate: null,
};
const memoryExtractionState = { value: null };
const aiState = { generateContentCalls: 0 };

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
          from() {
            return {
              where() {
                return {
                  limit() {
                    return Promise.resolve(dbState.selectedProfiles);
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
            dbState.lastInsert = values;
            return {
              onConflictDoUpdate(update) {
                dbState.lastUpdate = update?.set ?? null;
                return Promise.resolve();
              },
            };
          },
        };
      },
    },
    memberAiProfiles: {
      memberClerkId: Symbol("memberClerkId"),
    },
  },
});

mock.module("../../src/lib/member-ai-memory.ts", {
  namedExports: {
    appendRecentMessages(existingMessages) {
      return Array.isArray(existingMessages) ? existingMessages : [];
    },
    buildSystemInstruction() {
      return "test-system-instruction";
    },
    MAX_CLIENT_HISTORY_MESSAGES: 30,
    mergeMemoryUpdate(existing, update) {
      return {
        memorySummary: update?.memorySummary ?? existing?.memorySummary ?? "",
        goals: update?.goals ?? existing?.goals ?? [],
        preferences: update?.preferences ?? existing?.preferences ?? [],
        barriers: update?.barriers ?? existing?.barriers ?? [],
        motivators: update?.motivators ?? existing?.motivators ?? [],
        injuries: update?.injuries ?? existing?.injuries ?? [],
      };
    },
    normalizeStoredMessages(messages) {
      return Array.isArray(messages) ? messages : [];
    },
    parseMemoryExtraction() {
      return memoryExtractionState.value;
    },
    sanitizeIncomingMessages(messages) {
      return Array.isArray(messages) ? messages : [];
    },
    toGeminiHistory(messages) {
      return Array.isArray(messages) ? messages : [];
    },
  },
});

mock.module("@workspace/integrations-gemini-ai", {
  namedExports: {
    ai: {
      models: {
        async generateContent() {
          aiState.generateContentCalls += 1;
          return {
            text: JSON.stringify({
              workoutName: "Upper Body Strength",
              focus: "push",
              duration: 45,
              exercises: [
                {
                  name: "Bench Press",
                  sets: 3,
                  reps: "8-10",
                  restSeconds: 60,
                  notes: "keep the shoulder blades set",
                },
              ],
              warmup: "5 minutes of light cardio and shoulder circles",
              cooldown: "2 minutes of chest and triceps stretching",
              motivationalTip: "Stay consistent and finish strong.",
            }),
          };
        },
      },
      chats: {
        create() {
          return {
            async sendMessageStream() {
              return [];
            },
          };
        },
      },
    },
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
        res.status(403).json({
          error: "Your gym team has turned off member app access for this email.",
          status: "revoked",
          email: "member@example.com",
          role: "member",
        });
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

const { default: aiRouter } = await import("../../src/routes/ai.ts");

const app = express();
app.use(express.json());
app.use("/ai", aiRouter);

beforeEach(() => {
  authState.userId = "member_1";
  accessState.allowed = true;
  dbState.selectedProfiles = [];
  dbState.lastInsert = null;
  dbState.lastUpdate = null;
  memoryExtractionState.value = null;
  aiState.generateContentCalls = 0;
});

describe("ai routes", () => {
  it("returns a parsed workout suggestion payload", async () => {
    const response = await request(app).post("/ai/workout-suggestion").send({
      recentWorkouts: [],
      goals: "build strength",
      fitnessLevel: "intermediate",
      availableTime: 45,
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      workoutName: "Upper Body Strength",
      focus: "push",
      duration: 45,
      exercises: [
        {
          name: "Bench Press",
          sets: 3,
          reps: "8-10",
          restSeconds: 60,
          notes: "keep the shoulder blades set",
        },
      ],
      warmup: "5 minutes of light cardio and shoulder circles",
      cooldown: "2 minutes of chest and triceps stretching",
      motivationalTip: "Stay consistent and finish strong.",
    });
  });

  it("blocks AI endpoints when member access is revoked", async () => {
    accessState.allowed = false;

    const response = await request(app).post("/ai/workout-suggestion").send({
      recentWorkouts: [],
      goals: "build strength",
    });

    assert.equal(response.status, 403);
    assert.deepEqual(response.body, {
      error: "Your gym team has turned off member app access for this email.",
      status: "revoked",
      email: "member@example.com",
      role: "member",
    });
  });

  it("updates durable memory from daily activity snapshots", async () => {
    memoryExtractionState.value = {
      memorySummary: "Prefers repeatable strength sessions and responds to morning training.",
      goals: ["build strength"],
      preferences: ["morning sessions", "repeatable plans"],
      barriers: ["misses meals on busy days"],
      motivators: ["visible progress"],
      injuries: ["lower back limitation"],
    };

    const response = await request(app)
      .post("/ai/activity-snapshot")
      .send({
        date: "2026-05-05",
        timezone: "Asia/Kolkata",
        nutrition: { calories: 1900, protein: 120, entriesCount: 4, waterIntake: 6 },
        workout: { completedToday: 1, totalVolumeToday: 4200 },
        behaviorProfile: { consistencyLabel: "building", preferredTrainingWindow: "morning" },
      });

    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.equal(
      dbState.lastInsert.memorySummary,
      "Prefers repeatable strength sessions and responds to morning training.",
    );
    assert.deepEqual(dbState.lastUpdate.goals, ["build strength"]);
    assert.deepEqual(dbState.lastUpdate.preferences, ["morning sessions", "repeatable plans"]);
  });

  it("rate limits by authenticated user instead of spoofed forwarded IP", async () => {
    authState.userId = "rate_limited_member";

    for (let i = 0; i < 20; i += 1) {
      const response = await request(app)
        .post("/ai/workout-suggestion")
        .set("x-forwarded-for", `203.0.113.${i}`)
        .send({
          recentWorkouts: [],
          goals: "build strength",
        });

      assert.equal(response.status, 200);
    }

    const response = await request(app)
      .post("/ai/workout-suggestion")
      .set("x-forwarded-for", "198.51.100.250")
      .send({
        recentWorkouts: [],
        goals: "build strength",
      });

    assert.equal(response.status, 429);
    assert.deepEqual(response.body, {
      error: "Too many requests. Please wait a moment and try again.",
    });
  });

  it("keeps separate rate-limit buckets for different authenticated users", async () => {
    authState.userId = "member_with_full_bucket";

    for (let i = 0; i < 20; i += 1) {
      const response = await request(app).post("/ai/workout-suggestion").send({
        recentWorkouts: [],
        goals: "build strength",
      });

      assert.equal(response.status, 200);
    }

    const limitedResponse = await request(app).post("/ai/workout-suggestion").send({
      recentWorkouts: [],
      goals: "build strength",
    });

    assert.equal(limitedResponse.status, 429);

    authState.userId = "member_with_fresh_bucket";
    const freshUserResponse = await request(app).post("/ai/workout-suggestion").send({
      recentWorkouts: [],
      goals: "build strength",
    });

    assert.equal(freshUserResponse.status, 200);
  });

  it("rejects unauthenticated AI requests before AI generation", async () => {
    authState.userId = null;

    const response = await request(app).post("/ai/workout-suggestion").send({
      recentWorkouts: [],
      goals: "build strength",
    });

    assert.equal(response.status, 401);
    assert.deepEqual(response.body, { error: "Unauthorized" });
    assert.equal(aiState.generateContentCalls, 0);
  });
});
