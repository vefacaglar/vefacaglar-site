CREATE TABLE "user_game_playtime_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_game_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"delta_hours" numeric(7, 1) NOT NULL,
	"previous_hours" numeric(7, 1),
	"new_hours" numeric(7, 1) NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_game_playtime_entries" ADD CONSTRAINT "user_game_playtime_entries_user_game_id_user_games_id_fk" FOREIGN KEY ("user_game_id") REFERENCES "public"."user_games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_game_playtime_entries" ADD CONSTRAINT "user_game_playtime_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_game_playtime_entries" ADD CONSTRAINT "user_game_playtime_entries_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_game_playtime_entries_user_id_recorded_at_idx" ON "user_game_playtime_entries" USING btree ("user_id","recorded_at");--> statement-breakpoint
CREATE INDEX "user_game_playtime_entries_user_game_id_idx" ON "user_game_playtime_entries" USING btree ("user_game_id");--> statement-breakpoint
-- Backfill: one entry per existing log with playtime, as if it was all recorded when the log was created.
INSERT INTO "user_game_playtime_entries" ("user_game_id", "user_id", "game_id", "delta_hours", "previous_hours", "new_hours", "recorded_at")
SELECT "id", "user_id", "game_id", "playtime_hours", NULL, "playtime_hours", "created_at"
FROM "user_games"
WHERE "playtime_hours" > 0;