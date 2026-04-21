import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import express from "express";
import request from "supertest";

const authState = { userId: "member_1" };

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
      return (_req, _res, next) => next();
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
                    return Promise.resolve([]);
                  },
                };
              },
            };
          },
          insert() {
            return {
              values() {
                return {
                  onConflictDoUpdate() {
                    return Promise.resolve();
                  },
                };
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
    mergeMemoryUpdate(existing) {
      return {
        memorySummary: existing?.memorySummary ?? "",
        goals: existing?.goals ?? [],
        preferences: existing?.preferences ?? [],
        barriers: existing?.barriers ?? [],
        motivators: existing?.motivators ?? [],
        injuries: existing?.injuries ?? [],
      };
    },
    normalizeStoredMessages(messages) {
      return Array.isArray(messages) ? messages : [];
    },
    parseMemoryExtraction() {
      return null;
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

const { default: aiRouter } = await import("../../src/routes/ai.ts");

const app = express();
app.use(express.json());
app.use("/ai", aiRouter);

beforeEach(() => {
  authState.userId = "member_1";
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
});
