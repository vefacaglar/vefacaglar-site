-- Custom SQL migration file, put your code below! --
-- Data step: run search.sync hourly and once right away. The Meilisearch
-- sync escalates to a full rebuild when an index is missing or its settings
-- changed, so this bootstraps the indexes after the Typesense cutover and
-- keeps them healed. Only touches the manual-only row created by 0023, so a
-- schedule set from the dashboard is kept. Idempotent.
UPDATE "recurring_jobs"
SET "cron" = '17 * * * *', "next_run_at" = now(), "updated_at" = now()
WHERE "id" = 'search.sync' AND "cron" IS NULL;
