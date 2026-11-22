CREATE TABLE "user_tv_series_preferences" (
	"user_id" uuid NOT NULL,
	"series_id" integer NOT NULL,
	"rating" integer,
	"note" text,
	"rating_version" integer DEFAULT 0 NOT NULL,
	"note_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_tv_series_preferences_user_id_series_id_pk" PRIMARY KEY("user_id","series_id"),
	CONSTRAINT "user_tv_series_preferences_rating_range" CHECK ("user_tv_series_preferences"."rating" between 1 and 10),
	CONSTRAINT "user_tv_series_preferences_note_length" CHECK (char_length("user_tv_series_preferences"."note") <= 2000),
	CONSTRAINT "user_tv_series_preferences_versions" CHECK ("user_tv_series_preferences"."rating_version" >= 0 and "user_tv_series_preferences"."note_version" >= 0)
);
--> statement-breakpoint
ALTER TABLE "user_tv_series_preferences" ADD CONSTRAINT "user_tv_series_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tv_series_preferences" ADD CONSTRAINT "user_tv_series_preferences_series_id_tv_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."tv_series"("id") ON DELETE cascade ON UPDATE no action;