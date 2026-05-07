CREATE TABLE IF NOT EXISTS "member_workout_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "gym_id" text DEFAULT 'gymos-main' NOT NULL,
  "member_clerk_id" text NOT NULL,
  "name" text NOT NULL,
  "date" text NOT NULL,
  "start_time" timestamp with time zone NOT NULL,
  "end_time" timestamp with time zone,
  "duration" integer,
  "exercises" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "notes" text,
  "total_volume" integer DEFAULT 0 NOT NULL,
  "calories_burned" integer DEFAULT 0 NOT NULL,
  "completed" boolean DEFAULT false NOT NULL,
  "ai_generated" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "member_personal_records" (
  "id" text PRIMARY KEY NOT NULL,
  "gym_id" text DEFAULT 'gymos-main' NOT NULL,
  "member_clerk_id" text NOT NULL,
  "exercise_id" text NOT NULL,
  "name" text NOT NULL,
  "weight" integer NOT NULL,
  "reps" integer NOT NULL,
  "date" text NOT NULL,
  "session_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "member_personal_records_gym_member_exercise_idx"
  ON "member_personal_records" ("gym_id", "member_clerk_id", "exercise_id");
