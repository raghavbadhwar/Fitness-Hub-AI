import { primaryKey, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userRoleEnum = ["member", "trainer", "owner"] as const;
export type UserRole = (typeof userRoleEnum)[number];
export const userAccessStatusEnum = ["pending", "approved", "revoked"] as const;
export type UserAccessStatus = (typeof userAccessStatusEnum)[number];

export const userProfiles = pgTable("user_profiles", {
  clerkId: text("clerk_id").primaryKey(),
  gymId: text("gym_id").notNull().default("gymos-main"),
  name: text("name").notNull().default(""),
  role: text("role").notNull().default("member"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userAccessControls = pgTable(
  "user_access_controls",
  {
    gymId: text("gym_id").notNull().default("gymos-main"),
    email: text("email").notNull(),
    role: text("role").notNull().default("member"),
    status: text("status").notNull().default("pending"),
    note: text("note").notNull().default(""),
    createdByClerkId: text("created_by_clerk_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.gymId, table.email] })],
);

export const upsertUserProfileSchema = createInsertSchema(userProfiles);
export const upsertUserAccessControlSchema = createInsertSchema(userAccessControls);
export type UserProfile = typeof userProfiles.$inferSelect;
export type UserAccessControl = typeof userAccessControls.$inferSelect;
export type UpsertUserProfile = z.infer<typeof upsertUserProfileSchema>;
export type UpsertUserAccessControl = z.infer<typeof upsertUserAccessControlSchema>;
