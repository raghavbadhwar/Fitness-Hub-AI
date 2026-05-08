import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type AdminAuditMetadata = Record<string, unknown>;

export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: text("id").primaryKey(),
  gymId: text("gym_id").notNull(),
  actorClerkId: text("actor_clerk_id").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id"),
  metadata: jsonb("metadata").notNull().default({}).$type<AdminAuditMetadata>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertAdminAuditLogSchema = createInsertSchema(adminAuditLogs);
export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;
export type InsertAdminAuditLog = z.infer<typeof insertAdminAuditLogSchema>;
