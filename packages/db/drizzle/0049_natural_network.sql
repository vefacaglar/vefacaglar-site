CREATE TABLE "movie_audience_identities" (
	"provider" varchar(16) NOT NULL,
	"external_id" text NOT NULL,
	"wikidata_id" varchar(24),
	"checked_at" timestamp with time zone NOT NULL,
	CONSTRAINT "movie_audience_identities_provider_external_id_pk" PRIMARY KEY("provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "movie_audience_sources" (
	"provider" varchar(16) PRIMARY KEY NOT NULL,
	"snapshot" jsonb,
	"accepted_at" timestamp with time zone,
	"last_attempt_at" timestamp with time zone,
	"cooldown_until" timestamp with time zone,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"error_code" varchar(80)
);
--> statement-breakpoint
ALTER TABLE "movie_popularity_state" ADD COLUMN "source_details" jsonb;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "popularity_score" integer;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "popularity_source_date" date;