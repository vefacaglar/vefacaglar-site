CREATE TABLE "game_completion_provider_state" (
	"provider" varchar(24) PRIMARY KEY NOT NULL,
	"cooldown_until" timestamp with time zone,
	"error_code" varchar(64),
	"identity_map" jsonb,
	"map_checked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "game_completion_reports" (
	"igdb_id" integer NOT NULL,
	"provider" varchar(24) NOT NULL,
	"external_id" varchar(180) NOT NULL,
	"source_url" text NOT NULL,
	"scope" text NOT NULL,
	"statistic" varchar(32) NOT NULL,
	"finish_seconds" integer,
	"master_seconds" integer,
	"playtime_seconds" integer,
	"sample_count" integer,
	"source_updated_at" timestamp with time zone,
	"observed_at" timestamp with time zone,
	"checked_at" timestamp with time zone NOT NULL,
	"next_check_at" timestamp with time zone NOT NULL,
	CONSTRAINT "game_completion_reports_igdb_id_provider_pk" PRIMARY KEY("igdb_id","provider")
);
