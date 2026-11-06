CREATE TABLE "movie_popularity_state" (
	"id" text PRIMARY KEY NOT NULL,
	"source_date" date,
	"published_at" timestamp with time zone,
	"cooldown_until" timestamp with time zone,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"error_code" varchar(80),
	"article_count" integer,
	"mapped_article_count" integer,
	"missing_article_count" integer,
	"duplicate_qid_count" integer,
	"observed_movie_count" integer
);
--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "wikipedia_views" integer;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "wikipedia_source_date" date;
--> statement-breakpoint
-- Data step: manual-only until the first complete projection is verified in production.
INSERT INTO "recurring_jobs" ("id", "type", "cron", "payload", "enabled", "next_run_at")
VALUES ('catalog.movies.popularity.refresh', 'catalog.movies.popularity.refresh', NULL, '{}'::jsonb, false, NULL)
ON CONFLICT ("id") DO NOTHING;
