ALTER TABLE "user_games" ADD COLUMN "shared_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_movie_watches" ADD COLUMN "shared_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "user_games_shared_game_idx" ON "user_games" USING btree ("game_id","shared_at","id") WHERE "user_games"."shared_at" is not null;--> statement-breakpoint
CREATE INDEX "user_games_latest_rating_idx" ON "user_games" USING btree ("game_id","user_id","created_at","id") WHERE "user_games"."rating" > 0 and "user_games"."rating" <= 100;--> statement-breakpoint
CREATE INDEX "user_movie_ratings_movie_id_idx" ON "user_movie_ratings" USING btree ("movie_id");--> statement-breakpoint
CREATE INDEX "user_movie_watches_shared_movie_idx" ON "user_movie_watches" USING btree ("movie_id","shared_at","id") WHERE "user_movie_watches"."shared_at" is not null;