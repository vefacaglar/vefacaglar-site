CREATE TABLE "movie_search_state" (
	"id" text PRIMARY KEY NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"active_collection" text,
	"building_collection" text,
	"bootstrap_phase" text DEFAULT 'scan' NOT NULL,
	"bootstrap_cursor" uuid,
	"ranking_generation" bigint DEFAULT 0 NOT NULL,
	"ranking_ready" boolean DEFAULT false NOT NULL,
	"published_source_date" date,
	"repair_cursor" uuid,
	"repair_completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movie_search_sync" (
	"movie_id" uuid PRIMARY KEY NOT NULL,
	"requested_revision" bigint DEFAULT 1 NOT NULL,
	"applied_revision" bigint DEFAULT 0 NOT NULL,
	"indexed_collection" text,
	"dirty_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "movie_search_sync_pending_idx" ON "movie_search_sync" USING btree ("movie_id") WHERE "movie_search_sync"."requested_revision" > "movie_search_sync"."applied_revision";--> statement-breakpoint
INSERT INTO "movie_search_state" ("id") VALUES ('movies_en') ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "recurring_jobs" ("id", "type", "cron", "payload", "enabled")
VALUES ('search.movies.sync', 'search.movies.sync', '*/5 * * * *', '{}'::jsonb, false)
ON CONFLICT DO NOTHING;
