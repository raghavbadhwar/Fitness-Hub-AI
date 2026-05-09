CREATE TABLE IF NOT EXISTS "member_notification_preferences" (
  "id" text PRIMARY KEY NOT NULL,
  "gym_id" text DEFAULT 'gymos-main' NOT NULL,
  "member_clerk_id" text NOT NULL,
  "class_reminders_enabled" boolean DEFAULT true NOT NULL,
  "workout_reminders_enabled" boolean DEFAULT true NOT NULL,
  "reminder_lead_minutes" integer DEFAULT 60 NOT NULL,
  "email_enabled" boolean DEFAULT true NOT NULL,
  "push_enabled" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "member_notification_preferences_gym_member_idx"
  ON "member_notification_preferences" ("gym_id", "member_clerk_id");
