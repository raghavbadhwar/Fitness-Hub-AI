import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const gymSettingsTable = pgTable("gym_settings", {
  id: serial("id").primaryKey(),
  gymName: text("gym_name").notNull().default("GymOS"),
  address: text("address").notNull().default(""),
  phone: text("phone").notNull().default(""),
  workingHours: text("working_hours").notNull().default("Mon-Fri: 6am-10pm, Sat-Sun: 7am-8pm"),
  description: text("description").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertGymSettingsSchema = createInsertSchema(gymSettingsTable).omit({
  id: true,
  updatedAt: true,
});

export type GymSettingsRow = typeof gymSettingsTable.$inferSelect;
export type InsertGymSettings = z.infer<typeof insertGymSettingsSchema>;
