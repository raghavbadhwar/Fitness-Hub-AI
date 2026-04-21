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

Use Indian food examples when relevant. Keep the advice grounded in what this member is likely to follow consistently.`;
}
