import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";
import { db, memberAiProfiles } from "@workspace/db";
import { requireApprovedAccess } from "../lib/user-access.ts";
import { getRequestUserId } from "../lib/clerk-request.ts";
import { createFixedWindowRateLimiter } from "../lib/fixed-window-rate-limit.ts";
import {
  appendRecentMessages,
  buildSystemInstruction,
  MAX_CLIENT_HISTORY_MESSAGES,
  mergeMemoryUpdate,
  normalizeStoredMessages,
  parseMemoryExtraction,
  sanitizeIncomingMessages,
  toGeminiHistory,
} from "../lib/member-ai-memory.ts";

const router = Router();

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_PER_WINDOW = 20;
const ACTIVITY_SNAPSHOT_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ACTIVITY_SNAPSHOT_CHARS = 8_000;
const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
const rateLimit = createFixedWindowRateLimiter({
  windowMs: RATE_LIMIT_WINDOW_MS,
  maxRequests: RATE_LIMIT_MAX_PER_WINDOW,
  getKey(req) {
    return getAiRateLimitKey(req);
  },
});

function getAiRateLimitKey(req: Request) {
  const userId = getRequestUserId(req);
  if (userId) {
    return `user:${userId}`;
  }

  return `ip:${req.ip || req.socket.remoteAddress || "unknown"}`;
}

async function requireApprovedAiAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const access = await requireApprovedAccess(req, res);
    if (!access) {
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

router.use(requireAuth());
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

    const prompt = `You are an expert nutritionist specializing in Indian cuisine. Analyze this food image and provide detailed nutritional information.

If this is an Indian dish, identify it accurately (e.g., Butter Chicken, Palak Paneer, Biryani, Roti, Dal Tadka, Idli, Dosa, Samosa, Chole Bhature, etc.).
If it's not Indian food, still provide accurate nutritional data.

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
      const parsed = parseModelJsonResponse(response.text ?? "");
      res.json(parsed);
    } catch (parseErr) {
      req.log.error(
        {
          err: parseErr,
          model: GEMINI_MODEL,
          rawText: response.text,
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

    if (sanitizedIncomingMessages.length > MAX_CLIENT_HISTORY_MESSAGES) {
      res.status(400).json({ error: "Too many messages in history" });
      return;
    }

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
      req.log.error({ err: memoryErr }, "AI memory extraction error");
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
    req.log.error({ err }, "AI chat error");
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
      req.log.error({ err: memoryErr }, "AI activity memory extraction error");
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
    } = (req.body ?? {}) as {
      recentWorkouts?: unknown[];
      goals?: string;
      fitnessLevel?: string;
      availableTime?: number;
      todayStats?: Record<string, unknown>;
      behaviorProfile?: Record<string, unknown>;
      savedPlans?: unknown[];
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

Make the workout feel premium but easy to execute. Auto-adjust volume, intensity, exercise choice, and recovery demand from the behavior profile, today's nutrition/recovery context, saved plans, and durable memory. Reuse familiar movement patterns when the user is building consistency, bias toward saved-plan themes before inventing a completely different routine, and avoid exercises that conflict with remembered injuries or limitations.

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

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    try {
      const parsed = parseModelJsonResponse(response.text ?? "");
      res.json(parsed);
    } catch (parseErr) {
      req.log.error(
        {
          err: parseErr,
          model: GEMINI_MODEL,
          rawText: response.text,
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
