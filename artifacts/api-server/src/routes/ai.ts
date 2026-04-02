import { Router } from "express";
import { ai } from "@workspace/integrations-gemini-ai";

const router = Router();

router.post("/analyze-food", async (req, res) => {
  try {
    const { imageBase64, mimeType = "image/jpeg" } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "imageBase64 is required" });
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
            {
              inlineData: {
                mimeType,
                data: imageBase64,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      ],
    });

    const text = response.text ?? "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    try {
      const parsed = JSON.parse(cleaned);
      return res.json(parsed);
    } catch {
      return res.json({
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
        rawResponse: cleaned,
      });
    }
  } catch (err: any) {
    console.error("Food analysis error:", err);
    return res.status(500).json({ error: "Failed to analyze food", details: err.message });
  }
});

router.post("/chat", async (req, res) => {
  try {
    const { messages, userProfile, todayStats } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages array is required" });
    }

    const systemContext = `You are GymOS AI, a personal health and fitness coach integrated into a gym management app. You specialize in:
- Indian nutrition and meal planning (familiar with roti, dal, sabzi, biryani, idli, dosa, paneer dishes etc.)
- Workout programming and gym coaching
- Weight management tailored to South Asian body types
- Ayurvedic-inspired wellness advice
- Motivation and habit building

User Profile: ${JSON.stringify(userProfile || {})}
Today's Stats: ${JSON.stringify(todayStats || {})}

Keep responses concise, actionable, and encouraging. Use Indian food examples when relevant. Address the user warmly.`;

    const geminiMessages = messages.map((m: any) => ({
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
  } catch (err: any) {
    console.error("AI chat error:", err);
    if (!res.headersSent) {
      return res.status(500).json({ error: "AI chat failed", details: err.message });
    }
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

router.post("/workout-suggestion", async (req, res) => {
  try {
    const { recentWorkouts, goals, fitnessLevel, availableTime } = req.body;

    const prompt = `You are a professional fitness coach. Based on the following user data, suggest a workout plan.

Recent Workouts: ${JSON.stringify(recentWorkouts || [])}
Goals: ${goals || "general fitness"}
Fitness Level: ${fitnessLevel || "intermediate"}
Available Time: ${availableTime || 45} minutes

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
      const parsed = JSON.parse(cleaned);
      return res.json(parsed);
    } catch {
      return res.status(500).json({ error: "Failed to parse workout suggestion" });
    }
  } catch (err: any) {
    console.error("Workout suggestion error:", err);
    return res.status(500).json({ error: "Failed to generate workout", details: err.message });
  }
});

export default router;
