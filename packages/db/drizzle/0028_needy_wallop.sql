ALTER TABLE "games" ADD COLUMN "recommendation_score" double precision;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "recommendation_version" varchar(64);--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "recommendation_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "game_mode_ids" integer[];--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "game_modes_checked_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "games_recommendation_score_idx" ON "games" USING btree ("recommendation_score" DESC NULLS LAST,"popularity_score" DESC NULLS LAST,"title","id");--> statement-breakpoint
CREATE INDEX "games_game_modes_refresh_idx" ON "games" USING btree ("game_modes_checked_at","id");