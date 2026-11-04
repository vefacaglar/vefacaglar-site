CREATE TABLE "game_popularity_signals" (
	"game_id" uuid NOT NULL,
	"popularity_type" integer NOT NULL,
	"value" double precision NOT NULL,
	"calculated_at" timestamp with time zone,
	CONSTRAINT "game_popularity_signals_game_id_popularity_type_pk" PRIMARY KEY("game_id","popularity_type")
);
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "igdb_rating_count" integer;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "popularity_score" double precision;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "popularity_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "game_popularity_signals" ADD CONSTRAINT "game_popularity_signals_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "games_popularity_score_idx" ON "games" USING btree ("popularity_score" DESC NULLS LAST,"release_date" DESC NULLS LAST,"title");