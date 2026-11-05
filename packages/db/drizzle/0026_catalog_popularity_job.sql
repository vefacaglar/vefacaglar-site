-- Data step: register the daily catalog refresh, disabled until its worker image is deployed.
-- This does not enable a schedule on an older worker that cannot execute this type.
INSERT INTO "recurring_jobs" ("id", "type", "cron", "payload", "enabled", "next_run_at")
VALUES ('catalog.popularity.refresh', 'catalog.popularity.refresh', '15 7 * * *', '{}'::jsonb, false, NULL)
ON CONFLICT ("id") DO NOTHING;
