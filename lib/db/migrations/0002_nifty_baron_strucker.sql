CREATE TABLE "member_ai_profiles" (
	"member_clerk_id" text PRIMARY KEY NOT NULL,
	"memory_summary" text DEFAULT '' NOT NULL,
	"goals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preferences" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"barriers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"motivators" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"injuries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recent_messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_conversation_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
