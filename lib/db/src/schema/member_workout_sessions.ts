import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export interface MemberWorkoutSessionSet {
  id: string;
  weight: number;
  reps: number;
  completed: boolean;
  type?: "warmup" | "normal" | "drop" | "failure";
  rpe?: number;
  rir?: number;
  notes?: string;
  previousWeight?: number;
  previousReps?: number;
  progressionHint?: string;
}

export interface MemberWorkoutSessionExercise {
  id: string;
  exerciseId: string;
  name: string;
  sets: MemberWorkoutSessionSet[];
  notes?: string;
}

export const memberWorkoutSessions = pgTable("member_workout_sessions", {
  id: text("id").primaryKey(),
  gymId: text("gym_id").notNull().default("gymos-main"),
  memberClerkId: text("member_clerk_id").notNull(),
  name: text("name").notNull(),
  date: text("date").notNull(),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }),
  duration: integer("duration"),
  exercises: jsonb("exercises").notNull().default([]).$type<MemberWorkoutSessionExercise[]>(),
  notes: text("notes"),
  totalVolume: integer("total_volume").notNull().default(0),
  caloriesBurned: integer("calories_burned").notNull().default(0),
  completed: boolean("completed").notNull().default(false),
  aiGenerated: boolean("ai_generated").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const memberPersonalRecords = pgTable(
  "member_personal_records",
  {
    id: text("id").primaryKey(),
    gymId: text("gym_id").notNull().default("gymos-main"),
    memberClerkId: text("member_clerk_id").notNull(),
    exerciseId: text("exercise_id").notNull(),
    name: text("name").notNull(),
    weight: integer("weight").notNull(),
    reps: integer("reps").notNull(),
    date: text("date").notNull(),
    sessionId: text("session_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("member_personal_records_gym_member_exercise_idx").on(
      table.gymId,
      table.memberClerkId,
      table.exerciseId,
    ),
  ],
);

export type MemberWorkoutSession = typeof memberWorkoutSessions.$inferSelect;
export type MemberPersonalRecord = typeof memberPersonalRecords.$inferSelect;
