CREATE TABLE "package_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"github_url" text,
	"docs" text,
	"latest_version" text DEFAULT '1.0.0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "package_groups_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
INSERT INTO "package_groups" (
	"id",
	"slug",
	"name",
	"description",
	"github_url",
	"docs",
	"latest_version",
	"is_active",
	"content",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"slug",
	"name",
	"description",
	"github_url",
	"docs",
	"latest_version",
	"is_active",
	"content",
	"created_at",
	"updated_at"
FROM "packages";
--> statement-breakpoint
ALTER TABLE "doc_categories" RENAME COLUMN "package_id" TO "group_id";--> statement-breakpoint
ALTER TABLE "docs" RENAME COLUMN "package_id" TO "group_id";--> statement-breakpoint
ALTER TABLE "doc_categories" DROP CONSTRAINT "doc_categories_package_id_packages_id_fk";
--> statement-breakpoint
ALTER TABLE "docs" DROP CONSTRAINT "docs_package_id_packages_id_fk";
--> statement-breakpoint
DROP INDEX "doc_categories_package_id_slug_idx";--> statement-breakpoint
DROP INDEX "docs_package_id_slug_idx";--> statement-breakpoint
DROP INDEX "packages_is_active_created_at_idx";--> statement-breakpoint
ALTER TABLE "packages" ADD COLUMN "group_id" uuid;--> statement-breakpoint
UPDATE "packages" SET "group_id" = "id";--> statement-breakpoint
ALTER TABLE "packages" ALTER COLUMN "group_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "package_groups_is_active_created_at_idx" ON "package_groups" USING btree ("is_active","created_at");--> statement-breakpoint
ALTER TABLE "doc_categories" ADD CONSTRAINT "doc_categories_group_id_package_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."package_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs" ADD CONSTRAINT "docs_group_id_package_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."package_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packages" ADD CONSTRAINT "packages_group_id_package_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."package_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "doc_categories_group_id_slug_idx" ON "doc_categories" USING btree ("group_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "docs_group_id_slug_idx" ON "docs" USING btree ("group_id","slug");--> statement-breakpoint
CREATE INDEX "packages_group_id_created_at_idx" ON "packages" USING btree ("group_id","created_at");--> statement-breakpoint
ALTER TABLE "packages" DROP COLUMN "docs";--> statement-breakpoint
ALTER TABLE "packages" DROP COLUMN "content";
