import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export type ExerciseType = "weight_reps" | "bodyweight_reps" | "duration" | "distance_duration";

export const exerciseCatalogItems = pgTable(
  "exercise_catalog_items",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    aliases: jsonb("aliases").notNull().default([]).$type<string[]>(),
    primaryMuscles: jsonb("primary_muscles").notNull().default([]).$type<string[]>(),
    secondaryMuscles: jsonb("secondary_muscles").notNull().default([]).$type<string[]>(),
    equipment: text("equipment"),
    exerciseType: text("exercise_type").notNull().$type<ExerciseType>(),
    instructions: jsonb("instructions").notNull().default([]).$type<string[]>(),
    isSystem: boolean("is_system").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("exercise_catalog_items_slug_idx").on(table.slug),
    index("exercise_catalog_items_name_idx").on(table.name),
    index("exercise_catalog_items_equipment_idx").on(table.equipment),
    index("exercise_catalog_items_type_idx").on(table.exerciseType),
  ],
);

export const memberExercises = pgTable(
  "member_exercises",
  {
    id: text("id").primaryKey(),
    gymId: text("gym_id").notNull().default("gymos-main"),
    memberClerkId: text("member_clerk_id").notNull(),
    baseExerciseId: text("base_exercise_id"),
    name: text("name").notNull(),
    aliases: jsonb("aliases").notNull().default([]).$type<string[]>(),
    primaryMuscles: jsonb("primary_muscles").notNull().default([]).$type<string[]>(),
    equipment: text("equipment"),
    exerciseType: text("exercise_type").notNull().$type<ExerciseType>(),
    notes: text("notes"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("member_exercises_member_name_idx").on(table.gymId, table.memberClerkId, table.name),
    index("member_exercises_archive_idx").on(table.gymId, table.memberClerkId, table.archivedAt),
  ],
);

export const memberWorkoutSets = pgTable(
  "member_workout_sets",
  {
    id: text("id").primaryKey(),
    gymId: text("gym_id").notNull().default("gymos-main"),
    memberClerkId: text("member_clerk_id").notNull(),
    sessionId: text("session_id").notNull(),
    exerciseId: text("exercise_id").notNull(),
    exerciseName: text("exercise_name").notNull(),
    setId: text("set_id").notNull(),
    setIndex: integer("set_index").notNull(),
    setType: text("set_type").notNull().default("normal"),
    weight: doublePrecision("weight").notNull().default(0),
    reps: integer("reps").notNull().default(0),
    durationSeconds: integer("duration_seconds"),
    distanceMeters: doublePrecision("distance_meters"),
    rpe: doublePrecision("rpe"),
    rir: doublePrecision("rir"),
    completed: boolean("completed").notNull().default(false),
    performedAt: timestamp("performed_at", { withTimezone: true }).notNull(),
    date: text("date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("member_workout_sets_session_set_idx").on(table.sessionId, table.setId),
    index("member_workout_sets_exercise_history_idx").on(
      table.gymId,
      table.memberClerkId,
      table.exerciseId,
      table.performedAt,
    ),
    index("member_workout_sets_member_date_idx").on(table.gymId, table.memberClerkId, table.date),
    index("member_workout_sets_session_idx").on(table.gymId, table.memberClerkId, table.sessionId),
  ],
);

export const memberExercisePrs = pgTable(
  "member_exercise_prs",
  {
    id: text("id").primaryKey(),
    gymId: text("gym_id").notNull().default("gymos-main"),
    memberClerkId: text("member_clerk_id").notNull(),
    exerciseId: text("exercise_id").notNull(),
    metric: text("metric").notNull(),
    value: doublePrecision("value").notNull(),
    weight: doublePrecision("weight"),
    reps: integer("reps"),
    sessionId: text("session_id"),
    setId: text("set_id"),
    achievedAt: timestamp("achieved_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("member_exercise_prs_metric_idx").on(
      table.gymId,
      table.memberClerkId,
      table.exerciseId,
      table.metric,
    ),
    index("member_exercise_prs_achieved_idx").on(
      table.gymId,
      table.memberClerkId,
      table.achievedAt,
    ),
  ],
);

export type ExerciseCatalogItem = typeof exerciseCatalogItems.$inferSelect;
export type MemberExercise = typeof memberExercises.$inferSelect;
export type MemberWorkoutSet = typeof memberWorkoutSets.$inferSelect;
export type MemberExercisePr = typeof memberExercisePrs.$inferSelect;
