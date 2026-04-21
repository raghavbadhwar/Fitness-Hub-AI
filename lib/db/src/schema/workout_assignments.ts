import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workoutTemplates } from "./workout_templates";

export const workoutAssignments = pgTable("workout_assignments", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id")
    .notNull()
    .references(() => workoutTemplates.id),
  trainerId: text("trainer_id").notNull(),
  memberName: text("member_name").notNull(),
  memberClerkId: text("member_clerk_id"),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const insertWorkoutAssignmentSchema = createInsertSchema(workoutAssignments).omit({
  id: true,
  assignedAt: true,
  completedAt: true,
  memberClerkId: true,
});

export type WorkoutAssignment = typeof workoutAssignments.$inferSelect;
export type InsertWorkoutAssignment = z.infer<typeof insertWorkoutAssignmentSchema>;
