ALTER TABLE "docs" ALTER COLUMN "file_path" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "docs" ADD COLUMN "content" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "packages" ADD COLUMN "content" text DEFAULT '' NOT NULL;