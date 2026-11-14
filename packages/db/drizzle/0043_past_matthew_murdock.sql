CREATE TABLE "movie_english_title_state" (
	"id" text PRIMARY KEY NOT NULL,
	"cursor" uuid,
	"pass_started_at" timestamp with time zone,
	"last_pass_completed_at" timestamp with time zone,
	"pass_scanned" integer DEFAULT 0 NOT NULL,
	"pass_changed" integer DEFAULT 0 NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"error_code" varchar(80),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Data step: register the English-title correction job. Each daily run starts a
-- bounded continuation chain that resumes the durable cursor until a pass ends;
-- a new pass starts at most every 30 days. Never overwrite an admin's choice.
INSERT INTO "recurring_jobs" ("id", "type", "cron", "payload", "enabled", "next_run_at")
VALUES ('catalog.movies.english_titles', 'catalog.movies.english_titles', '30 4 * * *', '{}'::jsonb, true, NULL)
ON CONFLICT ("id") DO NOTHING;
