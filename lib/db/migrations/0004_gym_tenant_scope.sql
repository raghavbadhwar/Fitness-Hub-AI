ALTER TABLE "gym_classes"
  ADD COLUMN IF NOT EXISTS "gym_id" text DEFAULT 'gymos-main' NOT NULL;
--> statement-breakpoint
ALTER TABLE "gym_settings"
  ADD COLUMN IF NOT EXISTS "gym_id" text DEFAULT 'gymos-main' NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_profiles"
  ADD COLUMN IF NOT EXISTS "gym_id" text DEFAULT 'gymos-main' NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_access_controls"
  ADD COLUMN IF NOT EXISTS "gym_id" text DEFAULT 'gymos-main' NOT NULL;
--> statement-breakpoint
ALTER TABLE "workout_templates"
  ADD COLUMN IF NOT EXISTS "gym_id" text DEFAULT 'gymos-main' NOT NULL;
--> statement-breakpoint
ALTER TABLE "workout_assignments"
  ADD COLUMN IF NOT EXISTS "gym_id" text DEFAULT 'gymos-main' NOT NULL;
--> statement-breakpoint
ALTER TABLE "member_workout_plans"
  ADD COLUMN IF NOT EXISTS "gym_id" text DEFAULT 'gymos-main' NOT NULL;
--> statement-breakpoint
ALTER TABLE "member_ai_profiles"
  ADD COLUMN IF NOT EXISTS "gym_id" text DEFAULT 'gymos-main' NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_access_controls"
  DROP CONSTRAINT IF EXISTS "user_access_controls_pkey";
--> statement-breakpoint
ALTER TABLE "user_access_controls"
  ADD CONSTRAINT "user_access_controls_gym_id_email_pk" PRIMARY KEY ("gym_id", "email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gym_classes_gym_id_idx" ON "gym_classes" ("gym_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "gym_settings_gym_id_unique" ON "gym_settings" ("gym_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_profiles_gym_id_idx" ON "user_profiles" ("gym_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workout_templates_gym_id_idx" ON "workout_templates" ("gym_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workout_assignments_gym_id_idx" ON "workout_assignments" ("gym_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_workout_plans_gym_id_idx" ON "member_workout_plans" ("gym_id");
