import { Router, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";
import { db, memberAiProfiles } from "@workspace/db";
import { requireApiAuth } from "../middlewares/apiAuth.ts";
import { requireApprovedAccess } from "../lib/user-access.ts";
import {
  createFixedWindowRateLimiter,
  createFixedWindowRateLimitStore,
} from "../lib/fixed-window-rate-limit.ts";
import {
  appendRecentMessages,
  AI_SAFETY_INSTRUCTION,
  buildSystemInstruction,
  detectAiSafetyConcern,
  MAX_CLIENT_HISTORY_MESSAGES,
  mergeMemoryUpdate,
  normalizeStoredMessages,
  parseMemoryExtraction,
  sanitizeIncomingMessages,
  toGeminiHistory,
} from "../lib/member-ai-memory.ts";

const router = Router();

interface AiFoodAnalysis {
  dishName: string;
  cuisine: string;
  servingSize: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  confidence: "high" | "medium" | "low";
  ingredients: string[];
  healthTip: string;
}

interface AiWorkoutSuggestionExercise {
  name: string;
  sets: number;
  reps: string;
  restSeconds: number;
  notes?: string | null;
}

interface AiWorkoutSuggestion {
  workoutName: string;
  focus: string;
  duration: number;
  exercises: AiWorkoutSuggestionExercise[];
  warmup: string;
  cooldown: string;
  motivationalTip: string;
}

function getPositiveIntegerEnv(key: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[key] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_PER_WINDOW = getPositiveIntegerEnv("AI_RATE_LIMIT_MAX_PER_MINUTE", 20);
const RATE_LIMIT_MAX_KEYS = getPositiveIntegerEnv("AI_RATE_LIMIT_MAX_KEYS", 10_000);
const rateLimitStore = createFixedWindowRateLimitStore({
  maxKeys: RATE_LIMIT_MAX_KEYS,
  pruneIntervalMs: Math.min(RATE_LIMIT_WINDOW_MS, 10_000),
});
const ACTIVITY_SNAPSHOT_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ACTIVITY_SNAPSHOT_CHARS = 8_000;
const MAX_IMAGE_BASE64_BYTES = getPositiveIntegerEnv("AI_MAX_IMAGE_BASE64_BYTES", 5_000_000);
const MAX_CHAT_MESSAGES = getPositiveIntegerEnv(
  "AI_MAX_CHAT_MESSAGES",
  MAX_CLIENT_HISTORY_MESSAGES,
);
const MAX_CHAT_MESSAGE_CHARS = getPositiveIntegerEnv("AI_MAX_CHAT_MESSAGE_CHARS", 4_000);
const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
const rateLimit = createFixedWindowRateLimiter({
  windowMs: RATE_LIMIT_WINDOW_MS,
  maxRequests: RATE_LIMIT_MAX_PER_WINDOW,
  store: rateLimitStore,
  getKey(req) {
    return getAiRateLimitKey(req);
  },
  onLimitExceeded({ req, key, count, resetAt }) {
    req.log?.warn?.(
      {
        route: "ai",
        rateLimitKey: key,
        count,
        resetAt: new Date(resetAt).toISOString(),
      },
      "AI rate limit exceeded",
    );
  },
  onStoreError({ req, error }) {
    req.log?.error?.({ err: error, route: "ai" }, "AI rate limit store error");
  },
});

function getAiRateLimitKey(req: Request) {
  const userId = getAuth(req)?.userId;
  return `user:${userId ?? "unauthenticated"}`;
}

async function requireApprovedAiAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const access = await requireApprovedAccess(req, res);
    if (!access) {
      req.log?.warn?.(
        {
          route: "ai",
          userId: getAuth(req)?.userId ?? null,
          statusCode: res.statusCode,
        },
        "AI access denied",
      );
      return;
    }

    res.locals.aiUserId = access.userId;
    next();
  } catch (err) {
    req.log.error({ err }, "Failed to verify AI access");
    res.status(500).json({ error: "Failed to verify access" });
  }
}

function getAiUserId(res: Response): string | null {
  return typeof res.locals.aiUserId === "string" ? res.locals.aiUserId : null;
}

function buildActivityMemoryPrompt(args: {
  memoryProfile:
    | {
        memorySummary?: string;
        goals?: unknown;
        preferences?: unknown;
        barriers?: unknown;
        motivators?: unknown;
        injuries?: unknown;
      }
    | null
    | undefined;
  snapshot: Record<string, unknown>;
}) {
  const snapshotJson = JSON.stringify(args.snapshot).slice(0, MAX_ACTIVITY_SNAPSHOT_CHARS);

  return `Update the member memory for a fitness coaching app using this passive daily activity snapshot.

Keep only durable coaching information that should improve future nutrition and workout guidance. Do not store raw logs, exact calorie totals for a single ordinary day, or noisy one-off events unless they clearly reveal a pattern. Prefer patterns, constraints, preferences, consistency, recovery state, likely adherence barriers, and injury limitations.

Return JSON only with this shape:
{
  "memorySummary": "short paragraph",
  "goals": ["..."],
  "preferences": ["..."],
  "barriers": ["..."],
  "motivators": ["..."],
  "injuries": ["..."]
}

Current memory:
${JSON.stringify({
  memorySummary: args.memoryProfile?.memorySummary ?? "",
  goals: args.memoryProfile?.goals ?? [],
  preferences: args.memoryProfile?.preferences ?? [],
  barriers: args.memoryProfile?.barriers ?? [],
  motivators: args.memoryProfile?.motivators ?? [],
  injuries: args.memoryProfile?.injuries ?? [],
})}

Latest activity snapshot:
${snapshotJson}`;
}

function parseModelJsonResponse(rawText: string): unknown {
  const cleaned = rawText
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  return JSON.parse(cleaned);
}

function hasText(value: string, maxLength = 240): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength;
}

function isFiniteInRange(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

function validateFoodAnalysis(raw: unknown): AiFoodAnalysis {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("AI food analysis did not match the expected schema");
  }

  const result = raw as Partial<AiFoodAnalysis>;
  const confidence = result.confidence;
  const ingredients = result.ingredients;
  const validTextFields =
    typeof result.dishName === "string" &&
    hasText(result.dishName, 120) &&
    typeof result.cuisine === "string" &&
    hasText(result.cuisine, 80) &&
    typeof result.servingSize === "string" &&
    hasText(result.servingSize, 80) &&
    typeof result.healthTip === "string" &&
    hasText(result.healthTip, 300);
  const validNutrition =
    typeof result.calories === "number" &&
    isFiniteInRange(result.calories, 0, 2500) &&
    typeof result.protein === "number" &&
    isFiniteInRange(result.protein, 0, 250) &&
    typeof result.carbs === "number" &&
    isFiniteInRange(result.carbs, 0, 400) &&
    typeof result.fat === "number" &&
    isFiniteInRange(result.fat, 0, 250) &&
    typeof result.fiber === "number" &&
    isFiniteInRange(result.fiber, 0, 100);
  const validConfidence =
    confidence === "high" || confidence === "medium" || confidence === "low";
  const validIngredients =
    Array.isArray(ingredients) &&
    ingredients.length > 0 &&
    ingredients.length <= 20 &&
    ingredients.every((ingredient) => hasText(ingredient, 80));

  if (!validTextFields || !validNutrition || !validConfidence || !validIngredients) {
    throw new Error("AI food analysis contained unsafe or unrealistic values");
  }

  return result as AiFoodAnalysis;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function collectWorkoutInjuries(args: {
  userProfile?: Record<string, unknown>;
  memoryProfile?:
    | {
        injuries?: unknown;
      }
    | null
    | undefined;
}): string[] {
  return [
    ...normalizeStringArray(args.userProfile?.injuries),
    ...normalizeStringArray(args.memoryProfile?.injuries),
  ];
}

function exerciseConflictsWithInjuries(exerciseName: string, injuries: string[]): string | null {
  const normalizedName = exerciseName.toLowerCase();
  const conflictRules: Array<{ injury: string; pattern: RegExp }> = [
    { injury: "lower_back", pattern: /\b(deadlift|rdl|good morning|back squat|barbell row)\b/ },
    { injury: "knee", pattern: /\b(jump|lunge|pistol squat|box jump|deep squat)\b/ },
    { injury: "shoulder", pattern: /\b(overhead press|dips?|upright row|behind neck)\b/ },
    { injury: "wrist", pattern: /\b(push-?up|plank|burpee|bench press|front rack)\b/ },
  ];

  for (const rule of conflictRules) {
    if (injuries.includes(rule.injury) && rule.pattern.test(normalizedName)) {
      return rule.injury;
    }
  }

  return null;
}

function validateWorkoutSuggestion(
  raw: unknown,
  args: {
    requestedMinutes: number;
    injuries: string[];
  },
): AiWorkoutSuggestion {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("AI workout suggestion did not match the expected schema");
  }

  const result = raw as Partial<AiWorkoutSuggestion>;
  const exercises = result.exercises;
  const validSummary =
    typeof result.workoutName === "string" &&
    hasText(result.workoutName, 120) &&
    typeof result.focus === "string" &&
    hasText(result.focus, 80) &&
    typeof result.warmup === "string" &&
    hasText(result.warmup, 400) &&
    typeof result.cooldown === "string" &&
    hasText(result.cooldown, 400) &&
    typeof result.motivationalTip === "string" &&
    hasText(result.motivationalTip, 300) &&
    typeof result.duration === "number" &&
    isFiniteInRange(result.duration, 5, Math.max(10, args.requestedMinutes + 15));
  const validExercises =
    Array.isArray(exercises) &&
    exercises.length > 0 &&
    exercises.length <= 12 &&
    exercises.every((exercise) => {
      if (!exercise || typeof exercise !== "object") {
        return false;
      }

      return (
        typeof exercise.name === "string" &&
        hasText(exercise.name, 100) &&
        typeof exercise.reps === "string" &&
        hasText(exercise.reps, 40) &&
        typeof exercise.sets === "number" &&
        isFiniteInRange(exercise.sets, 1, 8) &&
        typeof exercise.restSeconds === "number" &&
        isFiniteInRange(exercise.restSeconds, 0, 300) &&
        (exercise.notes == null ||
          (typeof exercise.notes === "string" && hasText(exercise.notes, 240)))
      );
    });

  if (!validSummary || !validExercises) {
    throw new Error("AI workout suggestion contained unsafe or unrealistic values");
  }

  const conflictingExercise = exercises.find((exercise) =>
    exerciseConflictsWithInjuries(exercise.name, args.injuries),
  );
  if (conflictingExercise) {
    throw new Error("AI workout suggestion conflicted with member injury constraints");
  }

  return result as AiWorkoutSuggestion;
}

router.use(requireApiAuth);
router.use(rateLimit);
router.use(requireApprovedAiAccess);

router.get("/history", async (req: Request, res: Response) => {
  try {
    const userId = getAiUserId(res);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const [profile] = await db
      .select()
      .from(memberAiProfiles)
      .where(eq(memberAiProfiles.memberClerkId, userId))
      .limit(1);

    const recentMessages = normalizeStoredMessages(profile?.recentMessages ?? []);

    res.json({
      messages: recentMessages,
      memorySummary: profile?.memorySummary ?? "",
      updatedAt: profile?.updatedAt?.toISOString() ?? null,
      lastConversationAt: profile?.lastConversationAt?.toISOString() ?? null,
    });
  } catch (err: unknown) {
    req.log.error({ err }, "AI history load error");
    res.status(500).json({ error: "Failed to load AI history" });
  }
});

router.delete("/history", async (req: Request, res: Response) => {
  try {
    const userId = getAiUserId(res);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    await db
      .insert(memberAiProfiles)
      .values({
        memberClerkId: userId,
        recentMessages: [],
        memorySummary: "",
        goals: [],
        preferences: [],
        barriers: [],
        motivators: [],
        injuries: [],
        lastConversationAt: null,
      })
      .onConflictDoUpdate({
        target: memberAiProfiles.memberClerkId,
        set: {
          recentMessages: [],
          memorySummary: "",
          goals: [],
          preferences: [],
          barriers: [],
          motivators: [],
          injuries: [],
          lastConversationAt: null,
          updatedAt: new Date(),
        },
      });

    res.json({ ok: true });
  } catch (err: unknown) {
    req.log.error({ err }, "AI history clear error");
    res.status(500).json({ error: "Failed to clear AI history" });
  }
});

router.post("/analyze-food", async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType = "image/jpeg" } = (req.body ?? {}) as {
      imageBase64?: string;
      mimeType?: string;
    };

    if (!imageBase64 || typeof imageBase64 !== "string") {
      res.status(400).json({ error: "imageBase64 is required" });
      return;
    }

    const imageSizeBytes = Buffer.byteLength(imageBase64, "utf8");
    if (imageSizeBytes > MAX_IMAGE_BASE64_BYTES) {
      req.log?.warn?.(
        {
          route: "ai.analyzeFood",
          userId: getAiUserId(res),
          imageSizeBytes,
          maxImageBase64Bytes: MAX_IMAGE_BASE64_BYTES,
        },
        "AI food image payload rejected",
      );
      res.status(413).json({ error: "imageBase64 exceeds the maximum allowed size" });
      return;
    }

    req.log?.info?.(
      {
        route: "ai.analyzeFood",
        userId: getAiUserId(res),
        model: GEMINI_MODEL,
        mimeType,
        imageSizeBytes,
      },
      "AI food analysis request",
    );

    const prompt = `You are an expert nutritionist specializing in Indian cuisine. Analyze this food image and provide detailed nutritional information.

If this is an Indian dish, identify it accurately (e.g., Butter Chicken, Palak Paneer, Biryani, Roti, Dal Tadka, Idli, Dosa, Samosa, Chole Bhature, etc.).
If it's not Indian food, still provide accurate nutritional data.
Do not frame the result as a prescription for extreme dieting, medical treatment, or eating-disorder behavior. Keep the health tip conservative and food-neutral.

For the portion visible in the image, estimate a typical serving size and return ONLY this JSON (no markdown, no extra text):
{
  "dishName": "Name of the dish",
  "cuisine": "Indian/Continental/Chinese/etc",
  "servingSize": "1 serving (200g)",
  "calories": 350,
  "protein": 15,
  "carbs": 45,
  "fat": 12,
  "fiber": 4,
  "confidence": "high/medium/low",
  "ingredients": ["ingredient1", "ingredient2"],
  "healthTip": "A short health insight about this dish in context of Indian diet"
}

Return only the JSON, no other text.`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [{ inlineData: { mimeType, data: imageBase64 } }, { text: prompt }],
        },
      ],
    });

    try {
      const parsed = validateFoodAnalysis(parseModelJsonResponse(response.text ?? ""));
      res.json(parsed);
    } catch (parseErr) {
      req.log?.error?.(
        {
          err: parseErr,
          model: GEMINI_MODEL,
          rawTextLength: response.text?.length ?? 0,
        },
        "Food analysis JSON parse error",
      );
      res.status(502).json({ error: "AI returned malformed food analysis JSON" });
    }
  } catch (err: unknown) {
    req.log.error({ err }, "Food analysis error");
    res.status(500).json({ error: "Failed to analyze food" });
  }
});

router.post("/chat", async (req: Request, res: Response) => {
  try {
    const userId = getAiUserId(res);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { messages, userProfile, todayStats, behaviorProfile, savedPlans } = (req.body ?? {}) as {
      messages?: Array<{ role: string; content: string }>;
      userProfile?: Record<string, unknown>;
      todayStats?: Record<string, unknown>;
      behaviorProfile?: Record<string, unknown>;
      savedPlans?: unknown[];
    };

    const sanitizedIncomingMessages = sanitizeIncomingMessages(messages);

    if (sanitizedIncomingMessages.length === 0) {
      res.status(400).json({ error: "messages array is required" });
      return;
    }

    if (sanitizedIncomingMessages.length > MAX_CHAT_MESSAGES) {
      res.status(400).json({ error: "Too many messages in history" });
      return;
    }

    if (
      sanitizedIncomingMessages.some(
        (message) => Buffer.byteLength(message.content, "utf8") > MAX_CHAT_MESSAGE_CHARS,
      )
    ) {
      res.status(400).json({ error: "Message is too long" });
      return;
    }

    const safetyConcern = detectAiSafetyConcern(
      sanitizedIncomingMessages.map((message) => message.content).join("\n"),
    );
    if (safetyConcern) {
      req.log?.warn?.(
        {
          route: "ai.chat",
          userId,
          safetyCategory: safetyConcern.category,
        },
        "AI chat safety guardrail triggered",
      );
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.write(`data: ${JSON.stringify({ text: safetyConcern.response })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    req.log?.info?.(
      {
        route: "ai.chat",
        userId,
        model: GEMINI_MODEL,
        messageCount: sanitizedIncomingMessages.length,
      },
      "AI chat request",
    );

    const [memoryProfile] = await db
      .select()
      .from(memberAiProfiles)
      .where(eq(memberAiProfiles.memberClerkId, userId))
      .limit(1);

    const storedMessages = normalizeStoredMessages(memoryProfile?.recentMessages ?? []);
    const fallbackMessages = sanitizedIncomingMessages.map((message) => ({
      role: message.role,
      content: message.content,
      timestamp: new Date().toISOString(),
    }));
    const workingMessages = storedMessages.length > 0 ? storedMessages : fallbackMessages;
    const lastMessage = workingMessages[workingMessages.length - 1];
    const history = toGeminiHistory(workingMessages.slice(0, -1));

    if (!lastMessage) {
      res.status(400).json({ error: "A user message is required" });
      return;
    }

    const systemContext = buildSystemInstruction({
      userProfile,
      todayStats,
      behaviorProfile,
      savedPlans,
      memory: memoryProfile,
    });

    const chatSession = ai.chats.create({
      model: GEMINI_MODEL,
      history,
      config: {
        systemInstruction: systemContext,
        maxOutputTokens: 800,
      },
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = await chatSession.sendMessageStream({ message: lastMessage.content });
    let finalAssistantText = "";

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        finalAssistantText += text;
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    const persistedMessages = appendRecentMessages(memoryProfile?.recentMessages ?? [], [
      { role: "user", content: lastMessage.content },
      {
        role: "assistant",
        content:
          finalAssistantText.trim() ||
          "I apologize, but I could not generate a helpful response this time.",
      },
    ]);

    let mergedMemory = mergeMemoryUpdate(memoryProfile, undefined);

    try {
      const memoryUpdateResponse = await ai.models.generateContent({
        model: GEMINI_MODEL,
        config: {
          responseMimeType: "application/json",
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Update the member memory for a fitness coaching app using only durable details worth remembering across future chats.

Return JSON only with this shape:
{
  "memorySummary": "short paragraph",
  "goals": ["..."],
  "preferences": ["..."],
  "barriers": ["..."],
  "motivators": ["..."],
  "injuries": ["..."]
}

Current memory:
${JSON.stringify({
  memorySummary: memoryProfile?.memorySummary ?? "",
  goals: memoryProfile?.goals ?? [],
  preferences: memoryProfile?.preferences ?? [],
  barriers: memoryProfile?.barriers ?? [],
  motivators: memoryProfile?.motivators ?? [],
  injuries: memoryProfile?.injuries ?? [],
})}

Latest context:
${JSON.stringify({
  userProfile: userProfile ?? {},
  todayStats: todayStats ?? {},
  behaviorProfile: behaviorProfile ?? {},
  savedPlans: savedPlans ?? [],
  recentMessages: persistedMessages.slice(-6),
})}`,
              },
            ],
          },
        ],
      });

      mergedMemory = mergeMemoryUpdate(
        memoryProfile,
        parseMemoryExtraction(memoryUpdateResponse.text),
      );
    } catch (memoryErr) {
      req.log.error({ err: memoryErr, route: "ai.chat", userId }, "AI memory extraction error");
    }

    await db
      .insert(memberAiProfiles)
      .values({
        memberClerkId: userId,
        memorySummary: mergedMemory.memorySummary,
        goals: mergedMemory.goals,
        preferences: mergedMemory.preferences,
        barriers: mergedMemory.barriers,
        motivators: mergedMemory.motivators,
        injuries: mergedMemory.injuries,
        recentMessages: persistedMessages,
        lastConversationAt: new Date(),
      })
      .onConflictDoUpdate({
        target: memberAiProfiles.memberClerkId,
        set: {
          memorySummary: mergedMemory.memorySummary,
          goals: mergedMemory.goals,
          preferences: mergedMemory.preferences,
          barriers: mergedMemory.barriers,
          motivators: mergedMemory.motivators,
          injuries: mergedMemory.injuries,
          recentMessages: persistedMessages,
          lastConversationAt: new Date(),
          updatedAt: new Date(),
        },
      });

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err: unknown) {
    req.log.error({ err, route: "ai.chat" }, "AI chat error");
    if (!res.headersSent) {
      res.status(500).json({ error: "AI chat failed" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "AI chat failed" })}\n\n`);
      res.end();
    }
  }
});

router.post("/activity-snapshot", async (req: Request, res: Response) => {
  try {
    const userId = getAiUserId(res);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const snapshot = req.body as Record<string, unknown> | undefined;
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
      res.status(400).json({ error: "activity snapshot is required" });
      return;
    }

    if (typeof snapshot.date !== "string" || !ACTIVITY_SNAPSHOT_DATE_RE.test(snapshot.date)) {
      res.status(400).json({ error: "date must be YYYY-MM-DD" });
      return;
    }

    const [memoryProfile] = await db
      .select()
      .from(memberAiProfiles)
      .where(eq(memberAiProfiles.memberClerkId, userId))
      .limit(1);

    let mergedMemory = mergeMemoryUpdate(memoryProfile, undefined);

    try {
      const memoryUpdateResponse = await ai.models.generateContent({
        model: GEMINI_MODEL,
        config: {
          responseMimeType: "application/json",
        },
        contents: [
          {
            role: "user",
            parts: [{ text: buildActivityMemoryPrompt({ memoryProfile, snapshot }) }],
          },
        ],
      });

      mergedMemory = mergeMemoryUpdate(
        memoryProfile,
        parseMemoryExtraction(memoryUpdateResponse.text),
      );
    } catch (memoryErr) {
      req.log?.error?.(
        { err: memoryErr, route: "ai.activitySnapshot", userId },
        "AI activity memory extraction error",
      );
    }

    const updatedAt = new Date();
    await db
      .insert(memberAiProfiles)
      .values({
        memberClerkId: userId,
        memorySummary: mergedMemory.memorySummary,
        goals: mergedMemory.goals,
        preferences: mergedMemory.preferences,
        barriers: mergedMemory.barriers,
        motivators: mergedMemory.motivators,
        injuries: mergedMemory.injuries,
        recentMessages: memoryProfile?.recentMessages ?? [],
        lastConversationAt: memoryProfile?.lastConversationAt ?? null,
      })
      .onConflictDoUpdate({
        target: memberAiProfiles.memberClerkId,
        set: {
          memorySummary: mergedMemory.memorySummary,
          goals: mergedMemory.goals,
          preferences: mergedMemory.preferences,
          barriers: mergedMemory.barriers,
          motivators: mergedMemory.motivators,
          injuries: mergedMemory.injuries,
          recentMessages: memoryProfile?.recentMessages ?? [],
          updatedAt,
        },
      });

    res.json({
      ok: true,
      memorySummary: mergedMemory.memorySummary,
      updatedAt: updatedAt.toISOString(),
    });
  } catch (err: unknown) {
    req.log.error({ err }, "AI activity snapshot error");
    res.status(500).json({ error: "Failed to update activity memory" });
  }
});

router.post("/workout-suggestion", async (req: Request, res: Response) => {
  try {
    const {
      recentWorkouts,
      goals,
      fitnessLevel,
      availableTime,
      todayStats,
      behaviorProfile,
      savedPlans,
      userProfile,
    } = (req.body ?? {}) as {
      recentWorkouts?: unknown[];
      goals?: string;
      fitnessLevel?: string;
      availableTime?: number;
      todayStats?: Record<string, unknown>;
      behaviorProfile?: Record<string, unknown>;
      savedPlans?: unknown[];
      userProfile?: Record<string, unknown>;
    };
    const userId = getAiUserId(res);
    const [memoryProfile] = userId
      ? await db
          .select()
          .from(memberAiProfiles)
          .where(eq(memberAiProfiles.memberClerkId, userId))
          .limit(1)
      : [];

    const prompt = `You are a professional fitness coach. Based on the following user data, suggest a workout plan.

Recent Workouts: ${JSON.stringify(recentWorkouts ?? [])}
Goals: ${goals ?? "general fitness"}
Fitness Level: ${fitnessLevel ?? "intermediate"}
Available Time: ${availableTime ?? 45} minutes
Member Profile Constraints: ${JSON.stringify(userProfile ?? {})}
Today's Nutrition/Recovery Context: ${JSON.stringify(todayStats ?? {})}
Behavior Profile: ${JSON.stringify(behaviorProfile ?? {})}
Saved Plans: ${JSON.stringify(savedPlans ?? [])}
Durable Member Memory: ${JSON.stringify({
      memorySummary: memoryProfile?.memorySummary ?? "",
      goals: memoryProfile?.goals ?? [],
      preferences: memoryProfile?.preferences ?? [],
      barriers: memoryProfile?.barriers ?? [],
      motivators: memoryProfile?.motivators ?? [],
      injuries: memoryProfile?.injuries ?? [],
    })}

Make the workout feel premium but easy to execute. Auto-adjust volume, intensity, exercise choice, and recovery demand from the member profile constraints, behavior profile, today's nutrition/recovery context, saved plans, and durable memory. Reuse familiar movement patterns when the user is building consistency, bias toward saved-plan themes before inventing a completely different routine, match the user's available equipment, and avoid exercises that conflict with profile or remembered injuries and limitations.

${AI_SAFETY_INSTRUCTION}

Return ONLY this JSON (no markdown):
{
  "workoutName": "Name of the workout",
  "focus": "muscle group or type",
  "duration": 45,
  "exercises": [
    {
      "name": "Exercise Name",
      "sets": 3,
      "reps": "10-12",
      "restSeconds": 60,
      "notes": "form tip"
    }
  ],
  "warmup": "2-minute warmup description",
  "cooldown": "2-minute cooldown description",
  "motivationalTip": "A motivating message"
}`;

    req.log?.info?.(
      {
        route: "ai.workoutSuggestion",
        userId,
        model: GEMINI_MODEL,
        recentWorkoutCount: recentWorkouts?.length ?? 0,
        savedPlanCount: savedPlans?.length ?? 0,
      },
      "AI workout suggestion request",
    );

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    try {
      const parsed = validateWorkoutSuggestion(parseModelJsonResponse(response.text ?? ""), {
        requestedMinutes: availableTime ?? 45,
        injuries: collectWorkoutInjuries({ userProfile, memoryProfile }),
      });
      res.json(parsed);
    } catch (parseErr) {
      req.log?.error?.(
        {
          err: parseErr,
          model: GEMINI_MODEL,
          rawTextLength: response.text?.length ?? 0,
        },
        "Workout suggestion JSON parse error",
      );
      res.status(502).json({ error: "AI returned malformed workout suggestion JSON" });
    }
  } catch (err: unknown) {
    req.log.error({ err }, "Workout suggestion error");
    res.status(500).json({ error: "Failed to generate workout" });
  }
});

export default router;
