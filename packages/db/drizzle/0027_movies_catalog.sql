CREATE TABLE "movie_companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wikidata_id" varchar(24) NOT NULL,
	"name" text,
	"label_checked_at" timestamp with time zone,
	CONSTRAINT "movie_companies_wikidata_id_unique" UNIQUE("wikidata_id")
);
--> statement-breakpoint
CREATE TABLE "movie_company_links" (
	"movie_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	CONSTRAINT "movie_company_links_movie_id_company_id_pk" PRIMARY KEY("movie_id","company_id")
);
--> statement-breakpoint
CREATE TABLE "movie_credits" (
	"movie_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"statement_id" text NOT NULL,
	"role_property" varchar(8) NOT NULL,
	"rank" varchar(16) NOT NULL,
	"qualifiers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"character_names" text[] DEFAULT '{}'::text[] NOT NULL,
	CONSTRAINT "movie_credits_movie_id_statement_id_pk" PRIMARY KEY("movie_id","statement_id")
);
--> statement-breakpoint
CREATE TABLE "movie_entity_labels" (
	"wikidata_id" varchar(24) PRIMARY KEY NOT NULL,
	"name" text,
	"checked_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movie_genre_links" (
	"movie_id" uuid NOT NULL,
	"genre_id" uuid NOT NULL,
	CONSTRAINT "movie_genre_links_movie_id_genre_id_pk" PRIMARY KEY("movie_id","genre_id")
);
--> statement-breakpoint
CREATE TABLE "movie_genres" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wikidata_id" varchar(24) NOT NULL,
	"name" text,
	"slug" varchar(250) NOT NULL,
	"label_checked_at" timestamp with time zone,
	CONSTRAINT "movie_genres_wikidata_id_unique" UNIQUE("wikidata_id"),
	CONSTRAINT "movie_genres_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "movie_people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wikidata_id" varchar(24) NOT NULL,
	"name" text,
	"label_checked_at" timestamp with time zone,
	CONSTRAINT "movie_people_wikidata_id_unique" UNIQUE("wikidata_id")
);
--> statement-breakpoint
CREATE TABLE "movie_source_state" (
	"id" text PRIMARY KEY NOT NULL,
	"discovery_strategy" text,
	"discovery_cycle" integer DEFAULT 0 NOT NULL,
	"discovery_complete" boolean DEFAULT false NOT NULL,
	"next_discovery_at" timestamp with time zone,
	"refresh_cursor" uuid,
	"cooldown_until" timestamp with time zone,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_success_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wikidata_id" varchar(24) NOT NULL,
	"imdb_id" varchar(16),
	"imdb_conflict" boolean DEFAULT false NOT NULL,
	"slug" varchar(250) NOT NULL,
	"title" text,
	"original_title" text,
	"description" text,
	"release_date" text,
	"release_year" integer,
	"release_precision" integer,
	"runtime_minutes" double precision,
	"is_film" boolean DEFAULT false NOT NULL,
	"source_revision" bigint,
	"source_modified_at" timestamp with time zone,
	"hydrated_at" timestamp with time zone,
	"checked_at" timestamp with time zone,
	"retry_after" timestamp with time zone,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"error_code" varchar(80),
	"seed_priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "movies_wikidata_id_unique" UNIQUE("wikidata_id"),
	CONSTRAINT "movies_imdb_id_unique" UNIQUE("imdb_id"),
	CONSTRAINT "movies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "movie_company_links" ADD CONSTRAINT "movie_company_links_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_company_links" ADD CONSTRAINT "movie_company_links_company_id_movie_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."movie_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_credits" ADD CONSTRAINT "movie_credits_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_credits" ADD CONSTRAINT "movie_credits_person_id_movie_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."movie_people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_genre_links" ADD CONSTRAINT "movie_genre_links_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_genre_links" ADD CONSTRAINT "movie_genre_links_genre_id_movie_genres_id_fk" FOREIGN KEY ("genre_id") REFERENCES "public"."movie_genres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "movie_credits_person_idx" ON "movie_credits" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "movies_public_title_idx" ON "movies" USING btree ("title","id") WHERE "movies"."is_film" = true and "movies"."hydrated_at" is not null and "movies"."title" is not null;--> statement-breakpoint
CREATE INDEX "movies_title_search_idx" ON "movies" USING gin (to_tsvector('simple', coalesce("title", '')));--> statement-breakpoint
CREATE INDEX "movies_hydration_idx" ON "movies" USING btree ("hydrated_at","seed_priority","retry_after","created_at");--> statement-breakpoint
CREATE INDEX "movies_refresh_idx" ON "movies" USING btree ("checked_at","id");--> statement-breakpoint
-- Data step: manual-only until the movie worker and initial catalog fill are verified.
INSERT INTO "recurring_jobs" ("id", "type", "cron", "payload", "enabled", "next_run_at")
VALUES ('catalog.movies.sync', 'catalog.movies.sync', NULL, '{}'::jsonb, false, NULL)
ON CONFLICT ("id") DO NOTHING;
