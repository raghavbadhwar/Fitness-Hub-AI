ALTER TABLE "gym_classes"
  ADD COLUMN IF NOT EXISTS "waitlisted_member_ids" jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "gym_classes"
  ADD COLUMN IF NOT EXISTS "attendance_records" jsonb NOT NULL DEFAULT '[]'::jsonb;
