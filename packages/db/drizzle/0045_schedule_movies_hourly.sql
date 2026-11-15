-- Custom SQL migration file, put your code below! --
-- Upgrade only the default daily schedule. Preserve disabled registrations and
-- any cron expression chosen by an administrator. Recompute the next run.
UPDATE "recurring_jobs"
SET "cron" = '0 * * * *', "next_run_at" = NULL, "updated_at" = now()
WHERE "id" = 'catalog.movies.sync' AND "type" = 'catalog.movies.sync'
  AND "cron" = '0 3 * * *';
