CREATE TABLE "job_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"job_id" uuid NOT NULL,
	"level" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"progress" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"checkpoint" jsonb,
	"concurrency_key" text,
	"cancel_requested" boolean DEFAULT false NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_by" text,
	"locked_at" timestamp with time zone,
	"heartbeat_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"error" text,
	"recurring_job_id" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"cron" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"next_run_at" timestamp with time zone,
	"last_enqueued_at" timestamp with time zone,
	"last_job_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workers" (
	"id" text PRIMARY KEY NOT NULL,
	"hostname" text NOT NULL,
	"version" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_logs" ADD CONSTRAINT "job_logs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_recurring_job_id_recurring_jobs_id_fk" FOREIGN KEY ("recurring_job_id") REFERENCES "public"."recurring_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_logs_job_id_id_idx" ON "job_logs" USING btree ("job_id","id");--> statement-breakpoint
CREATE INDEX "jobs_status_run_at_idx" ON "jobs" USING btree ("status","run_at");--> statement-breakpoint
CREATE INDEX "jobs_type_created_at_idx" ON "jobs" USING btree ("type","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_active_concurrency_key_idx" ON "jobs" USING btree ("concurrency_key") WHERE "jobs"."status" in ('queued', 'running');