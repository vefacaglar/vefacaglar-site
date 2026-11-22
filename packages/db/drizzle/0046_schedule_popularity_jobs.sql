-- Custom SQL migration file, put your code below! --
-- Data step: enable daily popularity schedules and default movie search sync,
-- preserving any administrator-customized cron expressions. Recompute next_run_at.
UPDATE "recurring_jobs"
SET "cron" = '50 5 * * *', "enabled" = true, "next_run_at" = NULL, "updated_at" = now()
WHERE "id" = 'catalog.movies.popularity.refresh'
  AND "type" = 'catalog.movies.popularity.refresh'
  AND "cron" IS NULL;--> statement-breakpoint
UPDATE "recurring_jobs"
SET "cron" = '52 6 * * *', "enabled" = true, "next_run_at" = NULL, "updated_at" = now()
WHERE "id" = 'catalog.popularity.refresh'
  AND "type" = 'catalog.popularity.refresh'
  AND ("cron" IS NULL OR "cron" = '15 7 * * *');--> statement-breakpoint
UPDATE "recurring_jobs"
SET "enabled" = true, "next_run_at" = NULL, "updated_at" = now()
WHERE "id" = 'search.movies.sync'
  AND "type" = 'search.movies.sync'
  AND "cron" = '*/5 * * * *'
  AND "enabled" = false;
