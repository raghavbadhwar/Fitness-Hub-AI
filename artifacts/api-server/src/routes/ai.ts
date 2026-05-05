import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "@clerk/express";
import { ai } from "@workspace/integrations-gemini-ai";

const router = Router();

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_PER_WINDOW = 20;
const ipRequestCounts = new Map<string, { count: number; resetAt: number }>();

function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "unknown";
  const now = Date.now();
  const entry = ipRequestCounts.get(ip);

  if (!entry || now > entry.resetAt) {
    ipRequestCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    next();
    return;
  }

  if (entry.count >= RATE_LIMIT_MAX_PER_WINDOW) {
    res.status(429).json({ error: "Too many requests. Please wait a moment and try again." });
    return;
  }

  entry.count += 1;
  next();
}

router.use(requireAuth());
router.use(rateLimit);

router.post("/analyze-food", async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType = "image/jpeg" } = req.body as { imageBase64?: string; mimeType?: string };

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
      model: "gemini-2.5-flash-preview-04-17",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: imageBase64 } },
            { text: prompt },
          ],
        },
      ],
    });

    const text = response.text ?? "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    try {
      const parsed: unknown = JSON.parse(cleaned);
      res.json(parsed);
    } catch {
      res.json({
        dishName: "Unknown Food",
        cuisine: "Unknown",
        servingSize: "1 serving",
        calories: 250,
        protein: 10,
        carbs: 30,
        fat: 8,
        fiber: 2,
        confidence: "low",
        ingredients: [],
        healthTip: "Unable to analyze this food item accurately.",
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Food analysis error:", err);
    res.status(500).json({ error: "Failed to analyze food", details: message });
  }
});

router.post("/chat", async (req: Request, res: Response) => {
  try {
    const { messages, userProfile, todayStats, behaviorProfile, savedPlans } =
      req.body as {
      messages?: Array<{ role: string; content: string }>;
      userProfile?: Record<string, unknown>;
      todayStats?: Record<string, unknown>;
      behaviorProfile?: Record<string, unknown>;
      savedPlans?: unknown[];
    };

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: "messages array is required" });
      return;
    }

    if (messages.length > 30) {
      res.status(400).json({ error: "Too many messages in history" });
      return;
    }

    const systemContext = `You are GymOS AI, a personal health and fitness coach integrated into a gym management app. You specialize in:
- Indian nutrition and meal planning (familiar with roti, dal, sabzi, biryani, idli, dosa, paneer dishes etc.)
- Workout programming and gym coaching
- Weight management tailored to South Asian body types
- Ayurvedic-inspired wellness advice
- Motivation and habit building

User Profile: ${JSON.stringify(userProfile ?? {})}
Today's Stats: ${JSON.stringify(todayStats ?? {})}
Behavior Profile: ${JSON.stringify(behaviorProfile ?? {})}
Saved Plans: ${JSON.stringify(savedPlans ?? [])}

Adapt to the user's actual workout rhythm. If their consistency is still building, prefer simpler guidance and fewer changes. If they already have saved plans, reference them before inventing something new. Keep responses concise, actionable, and encouraging. Use Indian food examples when relevant. Address the user warmly.`;

    const geminiMessages = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const lastMessage = geminiMessages.pop();
    const history = geminiMessages;

    const chatSession = ai.chats.create({
      model: "gemini-2.5-flash-preview-04-17",
      history,
      config: {
        systemInstruction: systemContext,
        maxOutputTokens: 800,
      },
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = await chatSession.sendMessageStream({ message: lastMessage?.parts[0]?.text ?? "" });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("AI chat error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "AI chat failed", details: message });
    } else {
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      res.end();
    }
  }
});

router.post("/workout-suggestion", async (req: Request, res: Response) => {
  try {
    const {
      recentWorkouts,
      goals,
      fitnessLevel,
      availableTime,
      behaviorProfile,
      savedPlans,
    } = req.body as {
      recentWorkouts?: unknown[];
      goals?: string;
      fitnessLevel?: string;
      availableTime?: number;
      behaviorProfile?: Record<string, unknown>;
      savedPlans?: unknown[];
    };

    const prompt = `You are a professional fitness coach. Based on the following user data, suggest a workout plan.

Recent Workouts: ${JSON.stringify(recentWorkouts ?? [])}
Goals: ${goals ?? "general fitness"}
Fitness Level: ${fitnessLevel ?? "intermediate"}
Available Time: ${availableTime ?? 45} minutes
Behavior Profile: ${JSON.stringify(behaviorProfile ?? {})}
Saved Plans: ${JSON.stringify(savedPlans ?? [])}

Make the plan feel premium but simple to follow. Reuse familiar movement patterns when the behavior profile shows the user values consistency. If saved plans exist, suggest something adjacent to those habits instead of a random overhaul.

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
      model: "gemini-2.5-flash-preview-04-17",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const text = response.text ?? "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    try {
      const parsed: unknown = JSON.parse(cleaned);
      res.json(parsed);
    } catch {
      res.status(500).json({ error: "Failed to parse workout suggestion" });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Workout suggestion error:", err);
    res.status(500).json({ error: "Failed to generate workout", details: message });
  }
});

export default router;
