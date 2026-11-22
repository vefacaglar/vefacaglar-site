CREATE TABLE "game_wikipedia_interest" (
	"game_id" uuid PRIMARY KEY NOT NULL,
	"article" text NOT NULL,
	"source_date" date NOT NULL,
	"current_views" bigint NOT NULL,
	"baseline_views" bigint NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_wikipedia_provider_state" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"cooldown_until" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "popularity_version" varchar(64);--> statement-breakpoint
ALTER TABLE "game_wikipedia_interest" ADD CONSTRAINT "game_wikipedia_interest_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;