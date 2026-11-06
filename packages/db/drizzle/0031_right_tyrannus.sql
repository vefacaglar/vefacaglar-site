ALTER TABLE "movie_source_state" ADD COLUMN "artwork_cooldown_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "poster_file_name" text;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "poster_image_url" text;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "poster_attribution" jsonb;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "poster_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "poster_retry_after" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "poster_error_code" varchar(80);--> statement-breakpoint
CREATE INDEX "movies_poster_refresh_idx" ON "movies" USING btree ("poster_retry_after","poster_checked_at","id") WHERE "movies"."poster_file_name" is not null and "movies"."is_film" = true;--> statement-breakpoint
-- Upgrade manual-only movie synchronization to the requested daily schedule.
-- Preserve any existing explicit cron expression chosen by an administrator.
UPDATE "recurring_jobs"
SET "cron" = '0 3 * * *', "enabled" = true, "next_run_at" = NULL, "updated_at" = now()
WHERE "id" = 'catalog.movies.sync' AND "type" = 'catalog.movies.sync'
  AND "cron" IS NULL;
