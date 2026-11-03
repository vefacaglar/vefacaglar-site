CREATE INDEX "game_developers_developer_id_idx" ON "game_developers" USING btree ("developer_id");--> statement-breakpoint
CREATE INDEX "game_platforms_platform_id_idx" ON "game_platforms" USING btree ("platform_id");--> statement-breakpoint
CREATE INDEX "game_publishers_publisher_id_idx" ON "game_publishers" USING btree ("publisher_id");--> statement-breakpoint
CREATE INDEX "games_release_date_title_idx" ON "games" USING btree ("release_date" DESC NULLS LAST,"title");--> statement-breakpoint
CREATE INDEX "games_created_at_id_idx" ON "games" USING btree ("created_at" DESC NULLS FIRST,"id");