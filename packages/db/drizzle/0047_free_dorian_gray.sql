CREATE TABLE "catalog_import_state" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"last_id" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Data steps: preserve administrator schedules and disabled registrations.
UPDATE "recurring_jobs"
SET "cron" = '50 7 * * *', "next_run_at" = NULL, "updated_at" = now()
WHERE "id" = 'search.movies.sync' AND "type" = 'search.movies.sync'
  AND "cron" = '*/5 * * * *';
--> statement-breakpoint
INSERT INTO "catalog_import_state" ("id", "last_id") VALUES ('igdb', 0)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
-- Enable after the one-time production checkpoint transfer, or immediately on
-- a fresh installation when an idempotent scan from zero is desired.
INSERT INTO "recurring_jobs" ("id", "type", "cron", "payload", "enabled")
VALUES ('catalog.games.import', 'catalog.games.import', '0 */6 * * *', '{}'::jsonb, false)
ON CONFLICT ("id") DO NOTHING;
