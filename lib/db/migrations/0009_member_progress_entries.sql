CREATE TABLE IF NOT EXISTS "member_progress_entries" (
  "id" text PRIMARY KEY NOT NULL,
  "gym_id" text DEFAULT 'gymos-main' NOT NULL,
  "member_clerk_id" text NOT NULL,
  "date" text NOT NULL,
  "weight" double precision,
  "chest" double precision,
  "waist" double precision,
  "hips" double precision,
  "biceps" double precision,
  "thighs" double precision,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "member_progress_entries_gym_member_date_idx"
  ON "member_progress_entries" ("gym_id", "member_clerk_id", "date");
