CREATE INDEX "user_games_user_id_idx" ON "user_games" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_games_game_id_idx" ON "user_games" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "user_games_user_id_status_idx" ON "user_games" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "packages_is_active_created_at_idx" ON "packages" USING btree ("is_active","created_at");--> statement-breakpoint
CREATE INDEX "pages_status_published_at_idx" ON "pages" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "posts_status_published_at_idx" ON "posts" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "posts_author_id_status_idx" ON "posts" USING btree ("author_id","status");--> statement-breakpoint
CREATE INDEX "projects_status_featured_sort_idx" ON "projects" USING btree ("status","featured","sort_order");--> statement-breakpoint
CREATE INDEX "projects_status_published_at_idx" ON "projects" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");