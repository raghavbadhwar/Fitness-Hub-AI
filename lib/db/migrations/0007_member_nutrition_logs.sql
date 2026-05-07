CREATE TABLE IF NOT EXISTS "member_nutrition_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "gym_id" text DEFAULT 'gymos-main' NOT NULL,
  "member_clerk_id" text NOT NULL,
  "date" text NOT NULL,
  "entries" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "water_intake" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "member_nutrition_logs_gym_member_date_idx"
  ON "member_nutrition_logs" ("gym_id", "member_clerk_id", "date");
