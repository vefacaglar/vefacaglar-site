ALTER TABLE "games" ADD COLUMN "igdb_id" integer;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_igdb_id_unique" UNIQUE("igdb_id");