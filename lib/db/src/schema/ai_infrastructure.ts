import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const aiPromptVersions = pgTable(
  "ai_prompt_versions",
  {
    id: text("id").primaryKey(),
    task: text("task").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    schemaVersion: text("schema_version").notNull(),
    isActive: boolean("is_active").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("ai_prompt_versions_task_version_idx").on(table.task, table.promptVersion),
    index("ai_prompt_versions_active_idx").on(table.task, table.isActive),
  ],
);

export const aiInferenceEvents = pgTable(
  "ai_inference_events",
  {
    id: text("id").primaryKey(),
    gymId: text("gym_id"),
    memberClerkId: text("member_clerk_id"),
    task: text("task").notNull(),
    promptVersion: text("prompt_version"),
    model: text("model"),
    inputHash: text("input_hash"),
    outputSchemaVersion: text("output_schema_version"),
    confidence: text("confidence"),
    latencyMs: integer("latency_ms"),
    status: text("status").notNull(),
    fallbackUsed: text("fallback_used"),
    userCorrected: boolean("user_corrected").notNull().default(false),
    correctionDistance: jsonb("correction_distance"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("ai_inference_events_task_created_idx").on(table.task, table.createdAt),
    index("ai_inference_events_member_created_idx").on(
      table.gymId,
      table.memberClerkId,
      table.createdAt,
    ),
    index("ai_inference_events_status_fallback_idx").on(table.status, table.fallbackUsed),
  ],
);

export type AiPromptVersion = typeof aiPromptVersions.$inferSelect;
export type AiInferenceEvent = typeof aiInferenceEvents.$inferSelect;
