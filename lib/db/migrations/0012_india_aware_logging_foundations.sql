CREATE TABLE IF NOT EXISTS "food_catalog_items" (
  "id" text PRIMARY KEY NOT NULL,
  "source" text NOT NULL,
  "source_product_id" text,
  "barcode" text,
  "name" text NOT NULL,
  "brand" text,
  "food_category" text,
  "default_serving_label" text,
  "default_serving_grams" integer,
  "calories_per_100g" integer,
  "protein_per_100g" double precision,
  "carbs_per_100g" double precision,
  "fat_per_100g" double precision,
  "fiber_per_100g" double precision,
  "sugar_per_100g" double precision,
  "sodium_mg_per_100g" double precision,
  "micronutrients" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "ingredients" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "allergens" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "portion_options" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "raw_provider_payload" jsonb,
  "quality_score" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "food_catalog_items_source_product_idx"
  ON "food_catalog_items" ("source", "source_product_id");
CREATE INDEX IF NOT EXISTS "food_catalog_items_barcode_idx"
  ON "food_catalog_items" ("barcode")
  WHERE "barcode" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "food_catalog_items_name_idx"
  ON "food_catalog_items" (lower("name"));
CREATE INDEX IF NOT EXISTS "food_catalog_items_category_idx"
  ON "food_catalog_items" ("food_category");

CREATE TABLE IF NOT EXISTS "member_food_items" (
  "id" text PRIMARY KEY NOT NULL,
  "gym_id" text DEFAULT 'gymos-main' NOT NULL,
  "member_clerk_id" text NOT NULL,
  "catalog_item_id" text,
  "name" text NOT NULL,
  "brand" text,
  "serving_label" text NOT NULL,
  "serving_grams" integer,
  "calories" integer NOT NULL,
  "protein" double precision NOT NULL,
  "carbs" double precision NOT NULL,
  "fat" double precision NOT NULL,
  "fiber" double precision DEFAULT 0 NOT NULL,
  "micronutrients" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "portion_options" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "source" text NOT NULL,
  "confidence" text DEFAULT 'medium' NOT NULL,
  "is_favorite" boolean DEFAULT false NOT NULL,
  "last_logged_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "member_food_items_member_updated_idx"
  ON "member_food_items" ("gym_id", "member_clerk_id", "updated_at");
CREATE INDEX IF NOT EXISTS "member_food_items_favorite_idx"
  ON "member_food_items" ("gym_id", "member_clerk_id", "is_favorite");
CREATE INDEX IF NOT EXISTS "member_food_items_name_idx"
  ON "member_food_items" ("gym_id", "member_clerk_id", lower("name"));

CREATE TABLE IF NOT EXISTS "food_lookup_events" (
  "id" text PRIMARY KEY NOT NULL,
  "gym_id" text DEFAULT 'gymos-main' NOT NULL,
  "member_clerk_id" text NOT NULL,
  "lookup_type" text NOT NULL,
  "input_hash" text,
  "barcode" text,
  "provider" text,
  "status" text NOT NULL,
  "confidence" text,
  "selected_catalog_item_id" text,
  "latency_ms" integer,
  "error_code" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "food_lookup_events_member_created_idx"
  ON "food_lookup_events" ("gym_id", "member_clerk_id", "created_at");
CREATE INDEX IF NOT EXISTS "food_lookup_events_barcode_idx"
  ON "food_lookup_events" ("barcode")
  WHERE "barcode" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "food_lookup_events_provider_status_idx"
  ON "food_lookup_events" ("provider", "status", "created_at");

CREATE TABLE IF NOT EXISTS "exercise_catalog_items" (
  "id" text PRIMARY KEY NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "primary_muscles" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "secondary_muscles" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "equipment" text,
  "exercise_type" text NOT NULL,
  "instructions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "is_system" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "exercise_catalog_items_slug_idx"
  ON "exercise_catalog_items" ("slug");
CREATE INDEX IF NOT EXISTS "exercise_catalog_items_name_idx"
  ON "exercise_catalog_items" (lower("name"));
CREATE INDEX IF NOT EXISTS "exercise_catalog_items_equipment_idx"
  ON "exercise_catalog_items" ("equipment");
CREATE INDEX IF NOT EXISTS "exercise_catalog_items_type_idx"
  ON "exercise_catalog_items" ("exercise_type");

CREATE TABLE IF NOT EXISTS "member_exercises" (
  "id" text PRIMARY KEY NOT NULL,
  "gym_id" text DEFAULT 'gymos-main' NOT NULL,
  "member_clerk_id" text NOT NULL,
  "base_exercise_id" text,
  "name" text NOT NULL,
  "aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "primary_muscles" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "equipment" text,
  "exercise_type" text NOT NULL,
  "notes" text,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "member_exercises_member_name_idx"
  ON "member_exercises" ("gym_id", "member_clerk_id", lower("name"));
CREATE INDEX IF NOT EXISTS "member_exercises_archive_idx"
  ON "member_exercises" ("gym_id", "member_clerk_id", "archived_at");

CREATE TABLE IF NOT EXISTS "member_workout_sets" (
  "id" text PRIMARY KEY NOT NULL,
  "gym_id" text DEFAULT 'gymos-main' NOT NULL,
  "member_clerk_id" text NOT NULL,
  "session_id" text NOT NULL,
  "exercise_id" text NOT NULL,
  "exercise_name" text NOT NULL,
  "set_id" text NOT NULL,
  "set_index" integer NOT NULL,
  "set_type" text DEFAULT 'normal' NOT NULL,
  "weight" double precision DEFAULT 0 NOT NULL,
  "reps" integer DEFAULT 0 NOT NULL,
  "duration_seconds" integer,
  "distance_meters" double precision,
  "rpe" double precision,
  "rir" double precision,
  "completed" boolean DEFAULT false NOT NULL,
  "performed_at" timestamp with time zone NOT NULL,
  "date" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "member_workout_sets_session_set_idx"
  ON "member_workout_sets" ("session_id", "set_id");
CREATE INDEX IF NOT EXISTS "member_workout_sets_exercise_history_idx"
  ON "member_workout_sets" ("gym_id", "member_clerk_id", "exercise_id", "performed_at");
CREATE INDEX IF NOT EXISTS "member_workout_sets_member_date_idx"
  ON "member_workout_sets" ("gym_id", "member_clerk_id", "date");
CREATE INDEX IF NOT EXISTS "member_workout_sets_session_idx"
  ON "member_workout_sets" ("gym_id", "member_clerk_id", "session_id");

CREATE TABLE IF NOT EXISTS "member_exercise_prs" (
  "id" text PRIMARY KEY NOT NULL,
  "gym_id" text DEFAULT 'gymos-main' NOT NULL,
  "member_clerk_id" text NOT NULL,
  "exercise_id" text NOT NULL,
  "metric" text NOT NULL,
  "value" double precision NOT NULL,
  "weight" double precision,
  "reps" integer,
  "session_id" text,
  "set_id" text,
  "achieved_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "member_exercise_prs_metric_idx"
  ON "member_exercise_prs" ("gym_id", "member_clerk_id", "exercise_id", "metric");
CREATE INDEX IF NOT EXISTS "member_exercise_prs_achieved_idx"
  ON "member_exercise_prs" ("gym_id", "member_clerk_id", "achieved_at");

CREATE TABLE IF NOT EXISTS "ai_prompt_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "task" text NOT NULL,
  "provider" text NOT NULL,
  "model" text NOT NULL,
  "prompt_version" text NOT NULL,
  "schema_version" text NOT NULL,
  "is_active" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ai_prompt_versions_task_version_idx"
  ON "ai_prompt_versions" ("task", "prompt_version");
CREATE INDEX IF NOT EXISTS "ai_prompt_versions_active_idx"
  ON "ai_prompt_versions" ("task", "is_active");

CREATE TABLE IF NOT EXISTS "ai_inference_events" (
  "id" text PRIMARY KEY NOT NULL,
  "gym_id" text,
  "member_clerk_id" text,
  "task" text NOT NULL,
  "prompt_version" text,
  "model" text,
  "input_hash" text,
  "output_schema_version" text,
  "confidence" text,
  "latency_ms" integer,
  "status" text NOT NULL,
  "fallback_used" text,
  "user_corrected" boolean DEFAULT false NOT NULL,
  "correction_distance" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ai_inference_events_task_created_idx"
  ON "ai_inference_events" ("task", "created_at");
CREATE INDEX IF NOT EXISTS "ai_inference_events_member_created_idx"
  ON "ai_inference_events" ("gym_id", "member_clerk_id", "created_at");
CREATE INDEX IF NOT EXISTS "ai_inference_events_status_fallback_idx"
  ON "ai_inference_events" ("status", "fallback_used");

DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'food_catalog_items',
    'member_food_items',
    'food_lookup_events',
    'exercise_catalog_items',
    'member_exercises',
    'member_workout_sets',
    'member_exercise_prs',
    'ai_prompt_versions',
    'ai_inference_events'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table);

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fitness_hub_app')
      AND NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = target_table
          AND policyname = 'fitness_hub_app_full_access'
      )
    THEN
      EXECUTE format(
        'CREATE POLICY fitness_hub_app_full_access ON public.%I AS PERMISSIVE FOR ALL TO fitness_hub_app USING (true) WITH CHECK (true)',
        target_table
      );
    END IF;
  END LOOP;
END $$;
