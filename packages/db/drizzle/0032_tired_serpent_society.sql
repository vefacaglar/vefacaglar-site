ALTER TABLE "movie_source_state" ADD COLUMN "wikipedia_artwork_cooldown_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "enwiki_article" text;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "poster_inputs_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "poster_candidate_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "poster_resolved_file_name" text;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "poster_resolved_from" varchar(16);--> statement-breakpoint
CREATE INDEX "movies_wikipedia_poster_refresh_idx" ON "movies" USING btree ("poster_retry_after","poster_checked_at","id") WHERE "movies"."enwiki_article" is not null and "movies"."is_film" = true;--> statement-breakpoint
CREATE INDEX "movies_poster_inputs_idx" ON "movies" USING btree ("poster_inputs_checked_at","id") WHERE "movies"."is_film" = true and "movies"."hydrated_at" is not null;