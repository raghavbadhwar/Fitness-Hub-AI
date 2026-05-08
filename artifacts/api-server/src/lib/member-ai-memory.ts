import type { MemberAiProfile, MemberAiMemoryMessage } from "@workspace/db";

export interface ChatMessageInput {
  role: string;
  content: string;
}

export interface MemoryExtractionResult {
  memorySummary: string;
  goals: string[];
  preferences: string[];
  barriers: string[];
  motivators: string[];
  injuries: string[];
}

export const MAX_SERVER_HISTORY_MESSAGES = 20;
export const MAX_CLIENT_HISTORY_MESSAGES = 30;
export const MAX_MESSAGE_CHARS = 2000;

export const EMPTY_MEMORY_UPDATE: MemoryExtractionResult = {
  memorySummary: "",
  goals: [],
  preferences: [],
  barriers: [],
  motivators: [],
  injuries: [],
};

export type AiSafetyConcern = {
  category:
    | "medical_emergency"
    | "eating_disorder"
    | "extreme_dieting"
    | "unsafe_supplement"
    | "injury_pain";
  response: string;
};

export const AI_SAFETY_INSTRUCTION = `Safety boundaries:
- Do not diagnose medical conditions, triage emergencies, prescribe treatment, or tell users to ignore symptoms.
- If the user describes chest pain, fainting, severe shortness of breath, stroke-like symptoms, seizures, or similar urgent symptoms, tell them to stop exercising and seek emergency medical care now.
- Do not reinforce eating-disorder behavior, purging, laxative misuse, starvation, or hiding food intake. Encourage professional support and a safer next meal.
- Do not recommend extreme dieting, very-low-calorie plans, rapid weight-loss targets, dehydration, or fasting as punishment.
- Do not give unsafe supplement, steroid, stimulant, fat-burner, or drug dosing advice.
- For sharp pain, swelling, numbness, severe injury pain, or loss of function, avoid training through it and recommend medical or physiotherapy review.
- Keep fitness advice educational and conservative, with human approval for health-sensitive changes.`;

export function detectAiSafetyConcern(text: string): AiSafetyConcern | null {
  const normalized = text.toLowerCase();

  if (
    /\b(chest pain|heart attack|stroke|seizure|faint(?:ed|ing)?|severe shortness of breath|can't breathe|cannot breathe)\b/.test(
      normalized,
    )
  ) {
    return {
      category: "medical_emergency",
      response:
        "Stop exercising and seek urgent medical care now. Chest pain, fainting, severe breathing trouble, seizures, or stroke-like symptoms should be handled by emergency professionals, not a workout plan.",
    };
  }

  if (
    /\b(purge|purging|laxative|vomit(?:ing)?|starv(?:e|ing)|binge|eating disorder|hide food|skip meals to punish)\b/.test(
      normalized,
    )
  ) {
    return {
      category: "eating_disorder",
      response:
        "I cannot help with purging, starvation, laxative misuse, or hiding food. A safer next step is to eat a normal balanced meal, avoid compensating with exercise, and speak with a qualified clinician or trusted support person.",
    };
  }

  if (
    /\b([1-8]\d{2}\s*(calories|calorie|kcal)|no food|water fast|rapid weight loss|lose\s+\d+\s*(kg|kgs|pounds|lbs)\s+in\s+(a\s+)?week)\b/.test(
      normalized,
    )
  ) {
    return {
      category: "extreme_dieting",
      response:
        "I cannot support extreme calorie restriction, dehydration, or rapid weight-loss targets. Use a moderate deficit, keep protein and hydration steady, and involve a qualified professional if weight loss feels urgent or compulsive.",
    };
  }

  if (
    /\b(clenbuterol|dnp|anabolic|steroid|ephedrine|fat burner|double dose|mega ?dose|unsafe supplement)\b/.test(
      normalized,
    )
  ) {
    return {
      category: "unsafe_supplement",
      response:
        "I cannot advise unsafe supplement, stimulant, steroid, or drug dosing. Check with a qualified medical professional, and keep training focused on sleep, nutrition, hydration, and progressive exercise.",
    };
  }

  if (
    /\b(sharp pain|severe pain|swollen|numb|tingling|injured|injury|can't move|cannot move|loss of function)\b/.test(
      normalized,
    )
  ) {
    return {
      category: "injury_pain",
      response:
        "Do not train through sharp pain, swelling, numbness, severe injury pain, or loss of function. Stop the painful movement, choose gentle non-painful mobility only if comfortable, and get medical or physiotherapy guidance.",
    };
  }

  return null;
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const items: string[] = [];

  for (const entry of value) {
    if (typeof entry !== "string") {
      continue;
    }

    const cleaned = entry.trim().slice(0, 160);
    if (!cleaned) {
      continue;
    }

    const key = cleaned.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    items.push(cleaned);
  }

  return items.slice(0, 8);
}

function normalizeMessage(entry: unknown): MemberAiMemoryMessage | null {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const candidate = entry as Partial<MemberAiMemoryMessage>;
  if (
    (candidate.role !== "user" && candidate.role !== "assistant") ||
    typeof candidate.content !== "string"
  ) {
    return null;
  }

  const content = candidate.content.trim().slice(0, MAX_MESSAGE_CHARS);
  if (!content) {
    return null;
  }

  const timestamp =
    typeof candidate.timestamp === "string" && !Number.isNaN(Date.parse(candidate.timestamp))
      ? candidate.timestamp
      : new Date().toISOString();

  return {
    role: candidate.role,
    content,
    timestamp,
  };
}

export function sanitizeIncomingMessages(
  messages: unknown,
): Array<{ role: "user" | "assistant"; content: string }> {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const candidate = entry as ChatMessageInput;
      const role =
        candidate.role === "assistant" ? "assistant" : candidate.role === "user" ? "user" : null;
      const content =
        typeof candidate.content === "string"
          ? candidate.content.trim().slice(0, MAX_MESSAGE_CHARS)
          : "";

      if (!role || !content) {
        return null;
      }

      return { role, content };
    })
    .filter((entry): entry is { role: "user" | "assistant"; content: string } => Boolean(entry))
    .slice(-MAX_CLIENT_HISTORY_MESSAGES);
}

export function normalizeStoredMessages(messages: unknown): MemberAiMemoryMessage[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .map(normalizeMessage)
    .filter((entry): entry is MemberAiMemoryMessage => Boolean(entry))
    .slice(-MAX_SERVER_HISTORY_MESSAGES);
}

export function appendRecentMessages(
  existingMessages: unknown,
  newMessages: Array<{ role: "user" | "assistant"; content: string }>,
): MemberAiMemoryMessage[] {
  const normalizedExisting = normalizeStoredMessages(existingMessages);
  const stamped = newMessages
    .map((message) =>
      normalizeMessage({
        ...message,
        timestamp: new Date().toISOString(),
      }),
    )
    .filter((entry): entry is MemberAiMemoryMessage => Boolean(entry));

  return [...normalizedExisting, ...stamped].slice(-MAX_SERVER_HISTORY_MESSAGES);
}

export function toGeminiHistory(
  messages: MemberAiMemoryMessage[],
): Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> {
  return messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));
}

export function mergeMemoryUpdate(
  existing: MemberAiProfile | undefined,
  update: Partial<MemoryExtractionResult> | null | undefined,
): MemoryExtractionResult {
  return {
    memorySummary:
      typeof update?.memorySummary === "string" && update.memorySummary.trim()
        ? update.memorySummary.trim().slice(0, 1200)
        : (existing?.memorySummary ?? ""),
    goals: normalizeStringList(update?.goals ?? existing?.goals ?? []),
    preferences: normalizeStringList(update?.preferences ?? existing?.preferences ?? []),
    barriers: normalizeStringList(update?.barriers ?? existing?.barriers ?? []),
    motivators: normalizeStringList(update?.motivators ?? existing?.motivators ?? []),
    injuries: normalizeStringList(update?.injuries ?? existing?.injuries ?? []),
  };
}

export function parseMemoryExtraction(
  rawText: string | undefined,
): Partial<MemoryExtractionResult> | null {
  if (!rawText) {
    return null;
  }

  const cleaned = rawText
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();
  if (!cleaned) {
    return null;
  }

  try {
    return JSON.parse(cleaned) as Partial<MemoryExtractionResult>;
  } catch {
    return null;
  }
}

export function buildSystemInstruction(args: {
  userProfile?: Record<string, unknown>;
  todayStats?: Record<string, unknown>;
  behaviorProfile?: Record<string, unknown>;
  savedPlans?: unknown[];
  memory?: MemberAiProfile | undefined;
}): string {
  const memory = args.memory;
  const recentMessages = normalizeStoredMessages(memory?.recentMessages ?? []).slice(-6);

  return `You are GymOS AI, a premium personal health and fitness coach integrated into a gym management app.

You specialize in:
- Indian nutrition and meal planning
- Workout programming and gym coaching
- Weight management tailored to South Asian body types
- Habit formation, accountability, and practical wellness guidance

Always be concise, warm, and actionable. Prefer continuity over reinvention: build on the user's existing routines, saved plans, and earlier struggles before proposing a full reset.

Live Member Context:
User Profile: ${JSON.stringify(args.userProfile ?? {})}
Today's Stats: ${JSON.stringify(args.todayStats ?? {})}
Behavior Profile: ${JSON.stringify(args.behaviorProfile ?? {})}
Saved Plans: ${JSON.stringify(args.savedPlans ?? [])}

Durable Member Memory:
Summary: ${memory?.memorySummary || "No long-term summary saved yet."}
Goals: ${JSON.stringify(memory?.goals ?? [])}
Preferences: ${JSON.stringify(memory?.preferences ?? [])}
Barriers: ${JSON.stringify(memory?.barriers ?? [])}
Motivators: ${JSON.stringify(memory?.motivators ?? [])}
Injuries/limitations: ${JSON.stringify(memory?.injuries ?? [])}
Recent conversation snippets: ${JSON.stringify(recentMessages)}

${AI_SAFETY_INSTRUCTION}

Use Indian food examples when relevant. Keep the advice grounded in what this member is likely to follow consistently.`;
}
