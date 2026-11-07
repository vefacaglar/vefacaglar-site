CREATE TABLE "user_movie_ratings" (
	"user_id" uuid NOT NULL,
	"movie_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_movie_ratings_user_id_movie_id_pk" PRIMARY KEY("user_id","movie_id"),
	CONSTRAINT "user_movie_ratings_rating_range" CHECK ("user_movie_ratings"."rating" >= 1 and "user_movie_ratings"."rating" <= 10)
);
--> statement-breakpoint
CREATE TABLE "user_movie_watches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"movie_id" uuid NOT NULL,
	"watched_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_movie_ratings" ADD CONSTRAINT "user_movie_ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_movie_ratings" ADD CONSTRAINT "user_movie_ratings_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_movie_watches" ADD CONSTRAINT "user_movie_watches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_movie_watches" ADD CONSTRAINT "user_movie_watches_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_movie_watches_movie_history_idx" ON "user_movie_watches" USING btree ("user_id","movie_id","watched_on","id");--> statement-breakpoint
CREATE INDEX "user_movie_watches_user_history_idx" ON "user_movie_watches" USING btree ("user_id","watched_on","id");