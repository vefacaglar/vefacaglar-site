CREATE TABLE "tv_episodes" (
	"id" integer PRIMARY KEY NOT NULL,
	"series_id" integer NOT NULL,
	"season_id" integer,
	"season_number" integer,
	"number" integer,
	"name" text,
	"summary" text,
	"type" varchar(40) NOT NULL,
	"is_special" boolean NOT NULL,
	"airdate" date,
	"airstamp" timestamp with time zone,
	"runtime" integer,
	"rating" double precision,
	"source_url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tv_genres" (
	"name" varchar(120) PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tv_popularity_scores" (
	"series_id" integer PRIMARY KEY NOT NULL,
	"score" double precision NOT NULL,
	"generation" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tv_popularity_state" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"generation" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"identity_map" jsonb,
	"identities_checked_at" timestamp with time zone,
	"cooldown_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tv_refresh_queue" (
	"series_id" integer PRIMARY KEY NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"source_updated_at" timestamp with time zone,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"due_at" timestamp with time zone DEFAULT now() NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"error_code" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "tv_search_dirty" (
	"series_id" integer PRIMARY KEY NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tv_search_state" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"phase" varchar(24) DEFAULT 'scan' NOT NULL,
	"scan_cursor" integer,
	"ranking_ready" boolean DEFAULT false NOT NULL,
	"published_generation" integer DEFAULT 0 NOT NULL,
	"build_index" text,
	"build_token" varchar(64),
	"pending_generation" integer
);
--> statement-breakpoint
CREATE TABLE "tv_seasons" (
	"id" integer PRIMARY KEY NOT NULL,
	"series_id" integer NOT NULL,
	"number" integer,
	"name" text,
	"summary" text,
	"premiered" date,
	"ended" date,
	"episode_order" integer,
	"network" text,
	"source_url" text NOT NULL,
	CONSTRAINT "tv_seasons_identity_idx" UNIQUE("id","series_id")
);
--> statement-breakpoint
CREATE TABLE "tv_series" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"summary" text,
	"premiered" date,
	"ended" date,
	"first_aired" date,
	"last_aired" date,
	"status" text,
	"type" text,
	"language" text,
	"runtime" integer,
	"average_runtime" integer,
	"network" text,
	"web_channel" text,
	"rating" double precision,
	"source_url" text NOT NULL,
	"official_site" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"hierarchy_complete" boolean DEFAULT false NOT NULL,
	"hierarchy_updated_at" timestamp with time zone,
	"season_count" integer DEFAULT 0 NOT NULL,
	"episode_count" integer DEFAULT 0 NOT NULL,
	"special_count" integer DEFAULT 0 NOT NULL,
	"source_updated_at" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"popularity_score" double precision,
	"popularity_generation" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tv_series_genres" (
	"series_id" integer NOT NULL,
	"genre_name" varchar(120) NOT NULL,
	CONSTRAINT "tv_series_genres_series_id_genre_name_pk" PRIMARY KEY("series_id","genre_name")
);
--> statement-breakpoint
CREATE TABLE "tv_source_state" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"next_page" integer DEFAULT 0 NOT NULL,
	"index_complete" boolean DEFAULT false NOT NULL,
	"index_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"catalog_completed_at" timestamp with time zone,
	"updates_checked_at" timestamp with time zone,
	"cooldown_until" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "tv_episodes" ADD CONSTRAINT "tv_episodes_series_id_tv_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."tv_series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tv_episodes" ADD CONSTRAINT "tv_episodes_season_series_fk" FOREIGN KEY ("season_id","series_id") REFERENCES "public"."tv_seasons"("id","series_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tv_search_dirty" ADD CONSTRAINT "tv_search_dirty_series_id_tv_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."tv_series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tv_seasons" ADD CONSTRAINT "tv_seasons_series_id_tv_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."tv_series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tv_series_genres" ADD CONSTRAINT "tv_series_genres_series_id_tv_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."tv_series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tv_series_genres" ADD CONSTRAINT "tv_series_genres_genre_name_tv_genres_name_fk" FOREIGN KEY ("genre_name") REFERENCES "public"."tv_genres"("name") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tv_episodes_series_idx" ON "tv_episodes" USING btree ("series_id");--> statement-breakpoint
CREATE INDEX "tv_episodes_season_idx" ON "tv_episodes" USING btree ("season_id");--> statement-breakpoint
CREATE INDEX "tv_refresh_queue_due_idx" ON "tv_refresh_queue" USING btree ("due_at","priority","series_id");--> statement-breakpoint
CREATE INDEX "tv_seasons_series_idx" ON "tv_seasons" USING btree ("series_id");--> statement-breakpoint
CREATE INDEX "tv_series_popularity_idx" ON "tv_series" USING btree ("popularity_score","id");--> statement-breakpoint
CREATE INDEX "tv_series_hydration_idx" ON "tv_series" USING btree ("hierarchy_complete","id");--> statement-breakpoint
-- Register bounded TV campaigns and the independently owned TV search index.
INSERT INTO "tv_source_state" ("id") VALUES ('tvmaze') ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "tv_popularity_state" ("id") VALUES ('current') ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "tv_search_state" ("id") VALUES ('tv_series_en') ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "recurring_jobs" ("id", "type", "cron", "payload", "enabled") VALUES
('catalog.tv-series.sync', 'catalog.tv-series.sync', '0 2 * * *', '{}'::jsonb, true),
('catalog.tv-series.popularity.refresh', 'catalog.tv-series.popularity.refresh', '20 8 * * *', '{}'::jsonb, true),
('search.tv-series.sync', 'search.tv-series.sync', '35 8 * * *', '{}'::jsonb, true)
ON CONFLICT ("id") DO NOTHING;
