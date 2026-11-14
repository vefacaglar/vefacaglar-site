CREATE TABLE "movie_people_search_state" (
	"id" text PRIMARY KEY NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"active_collection" text,
	"building_collection" text,
	"previous_collection" text,
	"build_cursor" uuid,
	"build_started_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
