import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import express from "express";
import request from "supertest";

process.env.AI_MAX_IMAGE_BASE64_BYTES = "12";
process.env.AI_MAX_CHAT_MESSAGES = "2";
process.env.AI_MAX_CHAT_MESSAGE_CHARS = "20";

const authState = { userId: "member_1" };
const accessState = { allowed: true };
const dbState = {
  selectedProfiles: [],
  lastInsert: null,
  lastUpdate: null,
};
const memoryExtractionState = { value: null };
const defaultWorkoutSuggestion = {
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
};
const aiState = {
  generateContentCalls: 0,
  chatCreateCalls: 0,
  generateContentTexts: [],
  promptTexts: [],
};

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
    AI_SAFETY_INSTRUCTION: "test safety instruction",
    detectAiSafetyConcern(text) {
      const normalized = text.toLowerCase();
      if (normalized.includes("chest pain")) {
        return {
          category: "medical_emergency",
          response:
            "Stop exercising and seek urgent medical care now. Chest pain should be handled by emergency professionals.",
        };
      }
      if (normalized.includes("purge")) {
        return {
          category: "eating_disorder",
          response:
            "I cannot help with purging or eating-disorder behavior. Speak with a qualified clinician or trusted support person.",
        };
      }
      if (normalized.includes("500 calorie")) {
        return {
          category: "extreme_dieting",
          response:
            "I cannot support extreme calorie restriction. Use a moderate deficit and involve a qualified professional.",
        };
      }
      if (normalized.includes("clenbuterol")) {
        return {
          category: "unsafe_supplement",
          response:
            "I cannot advise unsafe supplement, stimulant, steroid, or drug dosing. Check with a qualified medical professional.",
        };
      }
      if (normalized.includes("sharp pain")) {
        return {
          category: "injury_pain",
          response:
            "Do not train through sharp pain. Stop the painful movement and get medical or physiotherapy guidance.",
        };
      }
      return null;
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
        async generateContent(args) {
          aiState.generateContentCalls += 1;
          const promptText =
            args?.contents?.[0]?.parts?.find?.((part) => typeof part.text === "string")?.text ?? "";
          aiState.promptTexts.push(promptText);
          const queuedText = aiState.generateContentTexts.shift();
          return {
            text: queuedText ?? JSON.stringify(defaultWorkoutSuggestion),
          };
        },
      },
      chats: {
        create() {
          aiState.chatCreateCalls += 1;
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
  aiState.chatCreateCalls = 0;
  aiState.generateContentTexts = [];
  aiState.promptTexts = [];
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
    assert.deepEqual(response.body, defaultWorkoutSuggestion);
  });

  it("sends full member constraints and durable memory to workout generation", async () => {
    dbState.selectedProfiles = [
      {
        memorySummary: "Prefers repeatable strength work and short morning sessions.",
        goals: ["build muscle"],
        preferences: ["dumbbell work"],
        barriers: ["limited time"],
        motivators: ["visible strength progress"],
        injuries: ["lower_back"],
      },
    ];

    const response = await request(app)
      .post("/ai/workout-suggestion")
      .send({
        recentWorkouts: [{ name: "Push Day", exercises: ["Bench Press"] }],
        goals: "build_muscle",
        fitnessLevel: "beginner",
        availableTime: 30,
        userProfile: {
          equipment: "home_gym",
          injuries: ["lower_back"],
          workoutTime: "morning",
          activityLevel: "light",
        },
        behaviorProfile: {
          consistencyLabel: "building",
          preferredTrainingWindow: "morning",
        },
        savedPlans: [{ name: "Saved Strength", exerciseCount: 4 }],
      });

    assert.equal(response.status, 200);
    assert.match(aiState.promptTexts[0], /Member Profile Constraints:/);
    assert.match(aiState.promptTexts[0], /home_gym/);
    assert.match(aiState.promptTexts[0], /lower_back/);
    assert.match(aiState.promptTexts[0], /morning/);
    assert.match(aiState.promptTexts[0], /Saved Strength/);
    assert.match(aiState.promptTexts[0], /Durable Member Memory:/);
    assert.match(aiState.promptTexts[0], /repeatable strength work/);
  });

  it("rejects malformed workout suggestion payloads from AI", async () => {
    aiState.generateContentTexts.push(
      JSON.stringify({
        ...defaultWorkoutSuggestion,
        exercises: [],
      }),
    );

    const response = await request(app).post("/ai/workout-suggestion").send({
      recentWorkouts: [],
      goals: "build strength",
    });

    assert.equal(response.status, 502);
    assert.deepEqual(response.body, { error: "AI returned malformed workout suggestion JSON" });
  });

  it("rejects workout suggestions that conflict with injury constraints", async () => {
    aiState.generateContentTexts.push(
      JSON.stringify({
        ...defaultWorkoutSuggestion,
        workoutName: "Heavy Pull Day",
        exercises: [
          {
            name: "Deadlift",
            sets: 4,
            reps: "5",
            restSeconds: 120,
            notes: "brace hard",
          },
        ],
      }),
    );

    const response = await request(app)
      .post("/ai/workout-suggestion")
      .send({
        recentWorkouts: [],
        goals: "build strength",
        userProfile: { injuries: ["lower_back"] },
      });

    assert.equal(response.status, 502);
    assert.deepEqual(response.body, { error: "AI returned malformed workout suggestion JSON" });
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

  it("rejects oversized food image payloads before AI generation", async () => {
    authState.userId = "image_limit_member";

    const response = await request(app)
      .post("/ai/analyze-food")
      .send({ imageBase64: "x".repeat(13), mimeType: "image/jpeg" });

    assert.equal(response.status, 413);
    assert.deepEqual(response.body, { error: "imageBase64 exceeds the maximum allowed size" });
    assert.equal(aiState.generateContentCalls, 0);
  });

  it("rejects malformed food analysis payloads from AI", async () => {
    aiState.generateContentTexts.push(
      JSON.stringify({
        dishName: "Paneer Bowl",
        cuisine: "Indian",
        servingSize: "1 serving",
        calories: 99999,
        protein: 30,
        carbs: 40,
        fat: 20,
        fiber: 5,
        confidence: "certain",
        ingredients: [],
        healthTip: "Balanced enough for a normal meal.",
      }),
    );

    const response = await request(app)
      .post("/ai/analyze-food")
      .send({ imageBase64: "small", mimeType: "image/jpeg" });

    assert.equal(response.status, 502);
    assert.deepEqual(response.body, { error: "AI returned malformed food analysis JSON" });
  });

  it("rejects chat requests with too many messages", async () => {
    authState.userId = "chat_limit_member";

    const response = await request(app)
      .post("/ai/chat")
      .send({
        messages: [
          { role: "user", content: "one" },
          { role: "assistant", content: "two" },
          { role: "user", content: "three" },
        ],
      });

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, { error: "Too many messages in history" });
    assert.equal(aiState.generateContentCalls, 0);
  });

  it("rejects chat requests with too-long messages", async () => {
    authState.userId = "chat_length_limit_member";

    const response = await request(app)
      .post("/ai/chat")
      .send({ messages: [{ role: "user", content: "x".repeat(21) }] });

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, { error: "Message is too long" });
    assert.equal(aiState.generateContentCalls, 0);
  });

  it("returns bounded safety responses for health-sensitive chat prompts before model calls", async () => {
    const cases = [
      {
        prompt: "chest pain",
        expected: /urgent medical care/i,
      },
      {
        prompt: "help me purge",
        expected: /cannot help with purging/i,
      },
      {
        prompt: "500 calorie diet",
        expected: /extreme calorie/i,
      },
      {
        prompt: "clenbuterol dose",
        expected: /cannot advise unsafe/i,
      },
      {
        prompt: "sharp pain",
        expected: /do not train through/i,
      },
    ];

    for (const [index, testCase] of cases.entries()) {
      authState.userId = `safety_member_${index}`;
      const response = await request(app)
        .post("/ai/chat")
        .send({ messages: [{ role: "user", content: testCase.prompt }] });

      assert.equal(response.status, 200);
      assert.match(response.headers["content-type"], /text\/event-stream/);
      assert.match(response.text, testCase.expected);
      assert.match(response.text, /data: \[DONE\]/);
    }

    assert.equal(aiState.generateContentCalls, 0);
    assert.equal(aiState.chatCreateCalls, 0);
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
    assert.equal(response.headers.location, undefined);
    assert.equal(aiState.generateContentCalls, 0);
  });
});
