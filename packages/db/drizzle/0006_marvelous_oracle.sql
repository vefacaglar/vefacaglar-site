CREATE TABLE "doc_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "docs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"category_id" uuid,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"file_path" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"nuget_url" text,
	"github_url" text,
	"latest_version" text DEFAULT '1.0.0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "packages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "doc_categories" ADD CONSTRAINT "doc_categories_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs" ADD CONSTRAINT "docs_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs" ADD CONSTRAINT "docs_category_id_doc_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."doc_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "doc_categories_package_id_slug_idx" ON "doc_categories" USING btree ("package_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "docs_package_id_slug_idx" ON "docs" USING btree ("package_id","slug");