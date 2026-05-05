import { pgTable, serial, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const workoutTemplates = pgTable("workout_templates", {
  id: serial("id").primaryKey(),
  gymId: text("gym_id").notNull().default("gymos-main"),
  trainerId: text("trainer_id").notNull(),
  trainerName: text("trainer_name").notNull(),
  name: text("name").notNull(),
  exercises: jsonb("exercises").notNull().$type<TemplateExercise[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export interface TemplateExercise {
  exerciseId: string;
  name: string;
  sets: number;
  reps: number;
  notes?: string;
}

export const insertWorkoutTemplateSchema = createInsertSchema(workoutTemplates).omit({
  id: true,
  createdAt: true,
});

export type WorkoutTemplate = typeof workoutTemplates.$inferSelect;
export type InsertWorkoutTemplate = z.infer<typeof insertWorkoutTemplateSchema>;
