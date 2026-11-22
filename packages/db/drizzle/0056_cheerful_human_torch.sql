CREATE TABLE "movie_person_aliases" (
	"alias_id" uuid PRIMARY KEY NOT NULL,
	"person_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "movie_person_aliases_not_self" CHECK ("movie_person_aliases"."alias_id"<>"movie_person_aliases"."person_id")
);
--> statement-breakpoint
CREATE TABLE "movie_person_sources" (
	"provider" varchar(32) NOT NULL,
	"external_id" varchar(64) NOT NULL,
	"person_id" uuid NOT NULL,
	"source_url" text NOT NULL,
	"source_name" text,
	"birth_date" date,
	"death_date" date,
	"gender" text,
	"country" text,
	"source_updated_at" timestamp with time zone,
	"fetched_at" timestamp with time zone NOT NULL,
	"identity_method" varchar(32),
	"verified_wikidata_id" varchar(24),
	"identity_checked_at" timestamp with time zone,
	CONSTRAINT "movie_person_sources_provider_external_id_pk" PRIMARY KEY("provider","external_id"),
	CONSTRAINT "movie_person_sources_owner_idx" UNIQUE("provider","person_id")
);
--> statement-breakpoint
CREATE TABLE "tv_cast" (
	"series_id" integer NOT NULL,
	"person_id" uuid NOT NULL,
	"character_id" integer NOT NULL,
	"character_name" text,
	"character_source_url" text NOT NULL,
	"cast_order" integer NOT NULL,
	"self" boolean,
	"voice" boolean,
	"source_url" text NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	CONSTRAINT "tv_cast_series_id_person_id_character_id_pk" PRIMARY KEY("series_id","person_id","character_id")
);
--> statement-breakpoint
CREATE TABLE "tv_cast_queue" (
	"series_id" integer PRIMARY KEY NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"due_at" timestamp with time zone DEFAULT now() NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"error_code" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "tv_cast_state" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"identity_map" jsonb,
	"identities_checked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "movie_people" ALTER COLUMN "wikidata_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tv_series" ADD COLUMN "cast_complete" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tv_series" ADD COLUMN "cast_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tv_source_state" ADD COLUMN "next_request_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "movie_person_aliases" ADD CONSTRAINT "movie_person_aliases_alias_id_movie_people_id_fk" FOREIGN KEY ("alias_id") REFERENCES "public"."movie_people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_person_aliases" ADD CONSTRAINT "movie_person_aliases_person_id_movie_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."movie_people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_person_sources" ADD CONSTRAINT "movie_person_sources_person_id_movie_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."movie_people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tv_cast" ADD CONSTRAINT "tv_cast_series_id_tv_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."tv_series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tv_cast" ADD CONSTRAINT "tv_cast_person_id_movie_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."movie_people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tv_cast_queue" ADD CONSTRAINT "tv_cast_queue_series_id_tv_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."tv_series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "movie_person_aliases_target_idx" ON "movie_person_aliases" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "tv_cast_person_idx" ON "tv_cast" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "tv_cast_queue_due_idx" ON "tv_cast_queue" USING btree ("due_at","requested_at","series_id");--> statement-breakpoint
INSERT INTO "tv_cast_state"("id") VALUES('tvmaze') ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "tv_cast_queue"("series_id") SELECT "id" FROM "tv_series" WHERE "hierarchy_complete" AND NOT "is_deleted" ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "recurring_jobs"("id","type","cron","payload","enabled") VALUES('catalog.tv-series.cast.refresh','catalog.tv-series.cast.refresh','15 3 * * *','{}',true) ON CONFLICT DO NOTHING;
