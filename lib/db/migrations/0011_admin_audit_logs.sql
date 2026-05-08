CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "gym_id" text NOT NULL,
  "actor_clerk_id" text NOT NULL,
  "action" text NOT NULL,
  "target_type" text NOT NULL,
  "target_id" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "admin_audit_logs_gym_created_idx"
  ON "admin_audit_logs" ("gym_id", "created_at");

CREATE INDEX IF NOT EXISTS "admin_audit_logs_actor_idx"
  ON "admin_audit_logs" ("actor_clerk_id");

CREATE INDEX IF NOT EXISTS "admin_audit_logs_target_idx"
  ON "admin_audit_logs" ("target_type", "target_id");
