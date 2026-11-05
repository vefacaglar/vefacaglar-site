CREATE TABLE "game_hltb_popularity" (
	"game_id" uuid PRIMARY KEY NOT NULL,
	"hltb_id" integer NOT NULL,
	"completed" integer,
	"backlog" integer,
	"playing" integer,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "game_hltb_popularity_hltb_id_unique" UNIQUE("hltb_id")
);
--> statement-breakpoint
ALTER TABLE "game_hltb_popularity" ADD CONSTRAINT "game_hltb_popularity_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;