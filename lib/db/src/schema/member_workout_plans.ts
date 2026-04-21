import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export interface MemberWorkoutPlanExercise {
  exerciseId: string;
  name: string;
  sets: number;
  reps: number;
  notes?: string;
}

export const memberWorkoutPlans = pgTable("member_workout_plans", {
  id: text("id").primaryKey(),
  memberClerkId: text("member_clerk_id").notNull(),
  name: text("name").notNull(),
  focus: text("focus"),
  exercises: jsonb("exercises").notNull().$type<MemberWorkoutPlanExercise[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const insertMemberWorkoutPlanSchema = createInsertSchema(memberWorkoutPlans).omit({
  id: true,
  memberClerkId: true,
  createdAt: true,
  updatedAt: true,
});

export type MemberWorkoutPlan = typeof memberWorkoutPlans.$inferSelect;
export type InsertMemberWorkoutPlan = z.infer<typeof insertMemberWorkoutPlanSchema>;
