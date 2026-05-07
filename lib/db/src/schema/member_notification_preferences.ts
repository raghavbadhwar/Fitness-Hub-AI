import { boolean, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const memberNotificationPreferences = pgTable(
  "member_notification_preferences",
  {
    id: text("id").primaryKey(),
    gymId: text("gym_id").notNull().default("gymos-main"),
    memberClerkId: text("member_clerk_id").notNull(),
    classRemindersEnabled: boolean("class_reminders_enabled").notNull().default(true),
    workoutRemindersEnabled: boolean("workout_reminders_enabled").notNull().default(true),
    reminderLeadMinutes: integer("reminder_lead_minutes").notNull().default(60),
    emailEnabled: boolean("email_enabled").notNull().default(true),
    pushEnabled: boolean("push_enabled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("member_notification_preferences_gym_member_idx").on(
      table.gymId,
      table.memberClerkId,
    ),
  ],
);

export type MemberNotificationPreference = typeof memberNotificationPreferences.$inferSelect;
