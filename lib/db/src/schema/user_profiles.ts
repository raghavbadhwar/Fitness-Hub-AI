import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userRoleEnum = ["member", "trainer", "owner"] as const;
export type UserRole = (typeof userRoleEnum)[number];

export const userProfiles = pgTable("user_profiles", {
  clerkId: text("clerk_id").primaryKey(),
  name: text("name").notNull().default(""),
  role: text("role").notNull().default("member"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const upsertUserProfileSchema = createInsertSchema(userProfiles);
export type UserProfile = typeof userProfiles.$inferSelect;
export type UpsertUserProfile = z.infer<typeof upsertUserProfileSchema>;
