CREATE TABLE IF NOT EXISTS "gym_classes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'Other' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"trainer" text NOT NULL,
	"date" text NOT NULL,
	"start_time" text NOT NULL,
	"duration" integer NOT NULL,
	"max_participants" integer NOT NULL,
	"enrolled_count" integer DEFAULT 0 NOT NULL,
	"enrolled_member_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"room" text NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"color" text DEFAULT '#9096B3' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gym_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"gym_name" text DEFAULT 'GymOS' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"working_hours" text DEFAULT 'Mon-Fri: 6am-10pm, Sat-Sun: 7am-8pm' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "member_workout_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"member_clerk_id" text NOT NULL,
	"name" text NOT NULL,
	"focus" text,
	"exercises" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
