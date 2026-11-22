ALTER TABLE "movies" ADD COLUMN "popularity_source_mask" integer;
--> statement-breakpoint
-- TMDB's complete daily export is available by 08:00 UTC. Preserve custom schedules.
UPDATE "recurring_jobs"
SET "cron" = '15 8 * * *', "next_run_at" = NULL, "updated_at" = now()
WHERE "id" = 'catalog.movies.popularity.refresh' AND "type" = 'catalog.movies.popularity.refresh'
  AND "cron" = '50 5 * * *';
--> statement-breakpoint
UPDATE "recurring_jobs"
SET "cron" = '30 8 * * *', "next_run_at" = NULL, "updated_at" = now()
WHERE "id" = 'search.movies.sync' AND "type" = 'search.movies.sync'
  AND "cron" = '50 7 * * *';
