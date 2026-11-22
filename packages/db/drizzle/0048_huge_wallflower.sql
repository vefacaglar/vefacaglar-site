ALTER TABLE "workers" ADD COLUMN "concurrency" integer;--> statement-breakpoint
ALTER TABLE "workers" ADD COLUMN "active_jobs" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_active_movie_sync_idx" ON "jobs" USING btree ("type") WHERE "jobs"."status" in ('queued', 'running') and "jobs"."type" = 'search.movies.sync';