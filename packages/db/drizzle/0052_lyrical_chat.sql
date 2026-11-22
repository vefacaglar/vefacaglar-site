CREATE TABLE "game_igdb_completion_times" (
	"igdb_id" integer PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"hastily_seconds" integer,
	"normally_seconds" integer,
	"completely_seconds" integer,
	"sample_count" integer NOT NULL,
	"source_updated_at" timestamp with time zone,
	"refreshed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Daily full provider snapshot, independent from ranking and search jobs.
INSERT INTO "recurring_jobs" ("id", "type", "cron", "payload", "enabled")
VALUES ('catalog.games.completion_times.refresh', 'catalog.games.completion_times.refresh', '10 4 * * *', '{}'::jsonb, true)
ON CONFLICT ("id") DO NOTHING;
