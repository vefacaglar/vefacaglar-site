CREATE TABLE "tv_job_campaign_items" (
	"job_id" uuid NOT NULL,
	"series_id" integer NOT NULL,
	"failed" boolean DEFAULT false NOT NULL,
	"requested_at" timestamp with time zone,
	"revision" integer,
	CONSTRAINT "tv_job_campaign_items_job_id_series_id_pk" PRIMARY KEY("job_id","series_id")
);
--> statement-breakpoint
CREATE TABLE "tv_job_campaigns" (
	"job_id" uuid PRIMARY KEY NOT NULL,
	"type" varchar(80) NOT NULL,
	"stage" varchar(24) DEFAULT 'init' NOT NULL,
	"horizon" timestamp with time zone DEFAULT now() NOT NULL,
	"ceiling" integer,
	"processed" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tv_job_campaign_items" ADD CONSTRAINT "tv_job_campaign_items_job_id_tv_job_campaigns_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."tv_job_campaigns"("job_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tv_job_campaigns" ADD CONSTRAINT "tv_job_campaigns_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;