ALTER TABLE "recurring_jobs" ALTER COLUMN "cron" DROP NOT NULL;--> statement-breakpoint
-- Data step: registered jobs (id = type, no cron = manual only). Idempotent.
INSERT INTO "recurring_jobs" ("id", "type", "cron", "payload", "enabled", "next_run_at")
VALUES
  ('search.reindex', 'search.reindex', NULL, '{}'::jsonb, true, NULL),
  ('search.sync', 'search.sync', NULL, '{}'::jsonb, true, NULL)
ON CONFLICT ("id") DO UPDATE SET
  "type" = EXCLUDED."type",
  "cron" = NULL,
  "payload" = '{}'::jsonb,
  "enabled" = true,
  "next_run_at" = NULL,
  "updated_at" = now();--> statement-breakpoint
-- Move the history of the old daily definition (and unlinked runs) under the registered row.
UPDATE "jobs" SET "recurring_job_id" = 'search.reindex'
WHERE "type" = 'search.reindex' AND ("recurring_job_id" IS NULL OR "recurring_job_id" = 'search.reindex.daily');--> statement-breakpoint
DELETE FROM "recurring_jobs" WHERE "id" = 'search.reindex.daily';--> statement-breakpoint
-- search.reindex and search.sync share one concurrency key.
UPDATE "jobs" SET "concurrency_key" = 'search.index'
WHERE "type" IN ('search.reindex', 'search.sync') AND "concurrency_key" = 'search.reindex';
