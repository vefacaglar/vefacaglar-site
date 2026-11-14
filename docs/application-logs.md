# Application logs

The API and worker write structured JSON lines to stdout/stderr. The VPS log
shipper collects container output into VictoriaLogs; there is no separate log
sink or collection to provision, and no log credentials to configure.

The API (pino) logs HTTP 4xx and 5xx responses and runtime failures, including
dependency failures and fallback paths that do not fail the request. HTTP
events carry the matched route template when available and the request ID
returned in `X-Request-Id`. `LOG_ENVIRONMENT` can override the API's default
environment label (`NODE_ENV`).

The worker (tracing JSON) logs lifecycle, job failure and infrastructure events.
Events tagged with an `application_event` field (for example `worker_failed`,
`job_claim_failed`, `worker_panicked`) also carry derived diagnostics when they
report an error: `error_code` (such as a Postgres SQLSTATE or
`meilisearch_task_<code>`), `response_message`, `diagnostic`, and for warnings
and errors `error_source` and `stack` (Rust line tables; stacks captured at the
reporting site are labelled as such). Fields set explicitly on the event win.

Messages are redacted before they are written: credentials in URLs, API key
headers and the values of secrets such as `DATABASE_URL` and
`MEILISEARCH_API_KEY` are masked. Job progress and per-job logs remain in the
job dashboard. Request bodies, raw URLs and job payloads are not logged.
