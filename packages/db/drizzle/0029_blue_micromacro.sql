CREATE TABLE "game_hltb_lookups" (
	"game_id" uuid PRIMARY KEY NOT NULL,
	"receipt_id" uuid NOT NULL,
	"query" varchar(250) NOT NULL,
	"expected_version" text NOT NULL,
	"candidates" jsonb NOT NULL,
	"outcome" text NOT NULL,
	"checked_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"retry_after" timestamp with time zone,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"pending_search_sync" boolean DEFAULT false NOT NULL,
	"sync_version" uuid,
	CONSTRAINT "game_hltb_lookups_receipt_id_unique" UNIQUE("receipt_id")
);
--> statement-breakpoint
CREATE TABLE "hltb_provider_state" (
	"id" text PRIMARY KEY NOT NULL,
	"lease_owner" uuid,
	"lease_until" timestamp with time zone,
	"next_request_at" timestamp with time zone NOT NULL,
	"cooldown_until" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "game_hltb_popularity" ALTER COLUMN "updated_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "game_hltb_popularity" ADD COLUMN "mapping_source" text DEFAULT 'imported' NOT NULL;--> statement-breakpoint
ALTER TABLE "game_hltb_popularity" ADD COLUMN "mapping_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "game_hltb_lookups" ADD CONSTRAINT "game_hltb_lookups_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;