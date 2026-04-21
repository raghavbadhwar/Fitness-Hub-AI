import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export interface MemberAiMemoryMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export const memberAiProfiles = pgTable("member_ai_profiles", {
  memberClerkId: text("member_clerk_id").primaryKey(),
  memorySummary: text("memory_summary").notNull().default(""),
  goals: jsonb("goals").notNull().default([]).$type<string[]>(),
  preferences: jsonb("preferences").notNull().default([]).$type<string[]>(),
  barriers: jsonb("barriers").notNull().default([]).$type<string[]>(),
  motivators: jsonb("motivators").notNull().default([]).$type<string[]>(),
  injuries: jsonb("injuries").notNull().default([]).$type<string[]>(),
  recentMessages: jsonb("recent_messages").notNull().default([]).$type<MemberAiMemoryMessage[]>(),
  lastConversationAt: timestamp("last_conversation_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type MemberAiProfile = typeof memberAiProfiles.$inferSelect;
