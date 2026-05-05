CREATE TABLE IF NOT EXISTS "monthly_reviews" (
  "id" text PRIMARY KEY NOT NULL,
  "gym_id" text DEFAULT 'gymos-main' NOT NULL,
  "member_clerk_id" text NOT NULL,
  "month" text NOT NULL,
  "metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "badges" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "ai_summary" text DEFAULT '' NOT NULL,
  "coach_note" text DEFAULT '' NOT NULL,
  "suggested_adjustments" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "status" text DEFAULT 'generated' NOT NULL,
  "generated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "reviewed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "monthly_reviews_gym_member_month_idx"
  ON "monthly_reviews" ("gym_id", "member_clerk_id", "month");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "monthly_reviews_gym_member_idx"
  ON "monthly_reviews" ("gym_id", "member_clerk_id");
