# Background jobs worker

A small, Hangfire-style background job system. The API enqueues jobs, a separate
Rust worker (`apps/worker`) executes them, and the dashboard shows live progress.
Postgres is the only queue/backing store (no Redis).

```
dashboard (apps/web) ──HTTP──▶ api (apps/api) ──INSERT + pg_notify('jobs')──▶ Postgres
                                                                        ▲
                                     apps/worker (Rust) ── LISTEN / poll, claim, run, checkpoint
```

Job types: `search.reindex` (full reindex), `search.sync` (fill in missing
documents), and `catalog.popularity.refresh` (daily game popularity and optional
HowLongToBeat enrichment). All are registered jobs and share the `search.index`
concurrency key, so live popularity writes cannot race with search alias swaps.
The search jobs remain manual-only; game popularity runs daily at 07:15 UTC.

## Database (owned by `packages/db`, Drizzle schema + generated migration)

### `jobs`
| column | type | notes |
|---|---|---|
| id | uuid pk default gen_random_uuid() | |
| type | text not null | e.g. `search.reindex` |
| status | text not null default `'queued'` | `queued` \| `running` \| `succeeded` \| `failed` \| `cancelled` |
| payload | jsonb not null default `{}` | validated per type by the API |
| progress | jsonb not null default `{}` | `{ phase?: string, processed?: number, total?: number, message?: string }` |
| checkpoint | jsonb null | opaque to the API; owned by the job handler |
| concurrency_key | text null | partial UNIQUE index where status in (`queued`,`running`) — at most one active job per key |
| cancel_requested | boolean not null default false | |
| attempts | integer not null default 0 | incremented on claim |
| max_attempts | integer not null default 3 | |
| run_at | timestamptz not null default now() | |
| locked_by | text null | worker id |
| locked_at, heartbeat_at | timestamptz null | |
| started_at, finished_at | timestamptz null | |
| error | text null | last error message |
| recurring_job_id | text null fk → recurring_jobs.id on delete set null | |
| created_by | uuid null fk → users.id on delete set null | |
| created_at, updated_at | timestamptz not null default now() | |

Indexes: `(status, run_at)`, `(type, created_at desc)`, partial unique on `concurrency_key`.

### `job_logs`
`id bigserial pk`, `job_id uuid not null fk → jobs.id on delete cascade`, `level text not null` (`info`|`warn`|`error`), `message text not null`, `created_at timestamptz not null default now()`. Index `(job_id, id)`.

### `recurring_jobs`
Registered jobs (Hangfire's "recurring jobs", but the schedule is optional).
`id text pk` (= the job type for built-ins, e.g. `search.reindex`), `type text not null`, `cron text null` (5-field, UTC; **null = manual-only registered job**), `payload jsonb not null default {}`, `enabled boolean not null default true`, `next_run_at timestamptz null` (null = worker recomputes; always null while `cron` is null), `last_enqueued_at timestamptz null`, `last_job_id uuid null`, `created_at`, `updated_at`.

Seeded by the migration `packages/db/drizzle/0023_magical_storm.sql` (data step, idempotent upsert): `search.reindex` and `search.sync`, both `cron = null`, `payload = {}`, `enabled = true`. The same migration moves the history of the former `search.reindex.daily` row to `search.reindex` and deletes that row. The worker does **not** seed registered jobs.

`0026_catalog_popularity_job.sql` registers `catalog.popularity.refresh` with
`cron = '15 7 * * *'`, payload `{}`, initially disabled. Enable it after deploying
the updated worker and its IGDB credentials; existing workers cannot execute the
new type. A null `next_run_at` computes the next daily occurrence on enable.

### `workers`
`id text pk` (worker id), `hostname text not null`, `version text not null`, `started_at timestamptz not null`, `last_seen_at timestamptz not null`. Online = `last_seen_at` within 30 s. Maintenance removes rows last seen more than one hour ago, except workers still holding a running job. Jobs/logs retain their history independently of worker rows.

## Worker semantics (`apps/worker`)

Every process executes one job at a time. Production runs two replicas. Claims
share a transaction advisory lock and count all running jobs from a fresh READ
COMMITTED snapshot, enforcing a global maximum of two even if extra workers
connect. Cancellation requests continue using capacity until the job actually
leaves `running`; queued retries and continuations do not consume a slot. The
admission lock is released before the handler runs. Existing concurrency keys
still limit which jobs may coexist.

Managed generations read `WORKER_CONTROL_FILE` from a read-only bind-mounted
control directory. `standby` workers register and heartbeat but do not dispatch,
claim or maintain the queue; `active` admits work; `drain` permanently closes
admission for that process. Missing or invalid managed control fails closed to
standby. Unmanaged local workers without this setting retain the active default.
The control status acknowledgement is serialized with in-flight claims.
`worker --deployment-protocol` prints `1` without connecting to the database;
`worker --control-status` reads the local acknowledgement.

Deployment drain is independent of job cancellation and OS shutdown. A draining
worker keeps its job heartbeat, lets the already claimed handler and finalization
finish naturally, then exits successfully. There is no drain deadline, task abort
or subprocess cancellation. A persisted drained generation cannot claim again
after restart. Candidate generations remain healthy in standby until admitted;
draining and active generations share the same global two-running-job gate.

- **Claim**: `UPDATE jobs SET status='running', locked_by=$id, locked_at=now(), heartbeat_at=now(), started_at=coalesce(started_at, now()), attempts=attempts+1, updated_at=now() WHERE id = (SELECT id FROM jobs WHERE status='queued' AND run_at<=now() ORDER BY run_at, created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`.
- **Wake-up**: `LISTEN jobs` (payload = job id) plus a 5 s poll fallback.
- **Live events**: after every progress/checkpoint update, every `job_logs` insert and every status change (claim, success, failure, retry back to queued, cancel, reaper requeue, shutdown pause) the worker runs `SELECT pg_notify('job_events', <job id as text>)`, ideally in the same transaction as the change (see "Live stream" below). Log lines that belong to a final status must be committed **before or together with** that terminal status update, otherwise the dashboard stream may already have sent `done`.
- **Heartbeat**: every 10 s for running jobs (`heartbeat_at`) and for the worker row (`workers.last_seen_at`).
- **Reaper**: running jobs whose `heartbeat_at` is older than 60 s go back to `queued` with `locked_by = null`; the checkpoint is kept so the job resumes. Log `warn` "worker lost, resuming from checkpoint".
- **Checkpoint**: handlers persist progress + checkpoint after every batch in a single UPDATE.
- **Cancel**: handlers check `cancel_requested` between batches; on cancel → `status='cancelled'`, `finished_at=now()`.
- **Explicit OS shutdown (SIGTERM/SIGINT)**: stop claiming, ask the handler to stop, save its checkpoint, set the job back to `queued` (`locked_by=null`), log "paused for shutdown", exit. Must finish well inside the container stop grace period (120 s). Deployment uses the independent drain protocol above, which allows the running job to finish instead.
- **Failure**: error → if `attempts < max_attempts`, `status='queued'`, `run_at = now() + 30s * 2^(attempts-1)`, checkpoint kept; else `status='failed'`, `finished_at=now()`. `error` holds the message; a log line is written.
- **Success**: `status='succeeded'`, `finished_at=now()`, `checkpoint=null`.
- **Scheduler**: every 30 s, lock due `recurring_jobs` (`enabled AND cron IS NOT NULL AND (next_run_at IS NULL OR next_run_at <= now())`, `FOR UPDATE SKIP LOCKED`) — rows with `cron IS NULL` are manual-only and must be ignored entirely (`cron` is nullable, so decode it as an optional value); if `next_run_at` is null just compute it; otherwise insert a job (respecting `concurrency_key`; skip if one is active), set `last_enqueued_at`, `last_job_id`, and the next `next_run_at`. Invalid cron → log and skip.
- **Seeding**: none in the worker. Registered jobs are seeded by the DB migration (see `recurring_jobs`); the old built-in `search.reindex.daily` (cron `0 3 * * *`) is gone.
- **Extensibility**: a `JobHandler` trait + registry; adding a job type = one module implementing the trait + one registration line. Handlers get a context with `progress()`, `log()`, `checkpoint()`, `should_stop()` (shutdown or cancel).

### Search jobs (`search.reindex`, `search.sync`)

These generic jobs own only the seven collections below. Movies are owned exclusively by `search.movies.sync`, documented in [movie search](movie-search.md).
Both: payload `{}` (no options; the old `drop` flag is removed), concurrency key **`search.index`** (shared → never run at the same time; the API answers `409` while one is queued/running). Both reproduce the API's Typesense collection schemas and document mappers exactly (see `apps/api/src/shared/search/`), English-only collections (`games_en`, `developers_en`, `publishers_en`, `genres_en`, `platforms_en`, `themes_en`, `posts_en`), read source rows with keyset pagination (by primary key) in batches of 500 and import via `POST /collections/{name}/documents/import?action=upsert` (JSONL); per-document import errors are logged and fail the job.

**`search.reindex` — full reindex, zero downtime:**
1. For **each of the seven generic** collections create a new physical collection `{alias}__{yyyymmddhhmmss}` (one shared timestamp per run).
2. Index **all** documents into the new physical collections.
3. Only after **every generic** collection is fully loaded, point **all** aliases `{alias}` at their new physical collections (live search switches atomically per alias, never to a half-filled collection).
4. Delete the previous physical collections. If a legacy *real* collection named `{alias}` exists, it must be deleted right before that alias is created (one-time brief gap, logged as `warn`).
- Checkpoint: `{ suffix: "yyyymmddhhmmss", collectionIndex, lastId }` — resuming reuses the same physical collections; nothing is swapped until the import phase is complete. A fresh run (no checkpoint) first deletes stale `{alias}__*` collections that no alias points to (and legacy `*_tr` collections).
- Cancel deletes this run's half-built collections and clears the checkpoint (a retry starts over); a failure keeps both so the retry resumes. Progress phases: `preparing`, `counting`, `indexing:<alias>`, `swapping aliases`, `cleanup`; `total` = sum of source row counts, known before indexing starts.

**`search.sync` — fill missing documents:**
- For each live collection (resolve the alias), list the document ids in Typesense (e.g. export with `include_fields=id`) and the source ids in Postgres; upsert **only** the documents that exist in Postgres but are missing from the collection. Existing documents are not touched; nothing is deleted. Missing live collections are created by the API's bootstrap, not by this job.
- A missing alias/collection fails the job immediately (permanent, no retries) with a message to run `search.reindex` first.
- Progress: all collections are diffed first (phase `diffing:<alias>`), so `total` = total missing count before indexing (phase `indexing:<alias>`). Logs per collection: `N missing, M orphaned` and `N missing, M indexed`; orphans are only counted. Checkpoint `{ collectionIndex }` — resume skips finished collections.

- Parity: shared golden fixtures (input rows → expected documents) are asserted by both a TS spec and a Rust test so mappers cannot drift.

### Game popularity (`catalog.popularity.refresh`)

Payload `{}` only; concurrency key `search.index`, shared with both search jobs.
The Rust handler starts `/usr/local/bin/node` with the compiled existing
`/app/apps/api/dist/scripts/refresh-popularity.js`, without a shell or command
arguments from a job payload. Scoring stays in TypeScript. The image includes
Node 24, API/DB production dependencies and the compiled CLI; runtime settings
reuse `DATABASE_URL` and Typesense, plus `IGDB_CLIENT_ID` / `IGDB_CLIENT_SECRET`.
Missing configuration fails permanently with a controlled message.

The worker heartbeat continues while the child runs. Bounded, sanitized CLI
output updates the job log/progress; raw credentials and provider payloads are
not forwarded. There is no short task timeout: a roughly 308,000-game catalog
can take tens of minutes and over 1 GiB RSS for its initial full refresh.
HLTB reads remain capped at 100 popular entries. Strict indexing failures fail
the job and retries replay the refresh, including indexing unchanged scores to
repair a previously committed database update. No provider-scan checkpoint is
saved. Cancel, shutdown or lost lease kills and reaps the child; abrupt task
drop also requests child termination. A later attempt safely starts over.

## API (`apps/api`, module `jobs`, all `preHandler: app.requireAdmin`)

| method | path | body / query | response |
|---|---|---|---|
| GET | `/api/jobs/dashboard` | `?status=&type=&recurringJobId=&page=&limit=` | `{ items: JobSummary[], total, page, limit }`; `status` is a job status or `processing` (= queued + running) |
| POST | `/api/jobs/dashboard` | `{ type, payload }` | `201 JobSummary`; `409` if an active job with the same concurrency key exists. If a registered job with that `type` exists, the run is linked to it (`recurringJobId`) |
| GET | `/api/jobs/dashboard/:id` | `?afterLogId=` | `{ job: JobSummary, logs: JobLog[] }` (logs after `afterLogId`, max 200, ascending) |
| POST | `/api/jobs/dashboard/:id/stream-token` | – | `201 { token, expiresAt, streamPath }` (`Cache-Control: no-store`); `400` invalid id, `404` unknown job |
| GET | `/api/jobs/dashboard/:id/stream` | `?afterLogId=&token=`, header `Last-Event-ID` | `text/event-stream` (see "Live stream"). Auth: Bearer admin **or** `?token=`; `400` invalid id, `401` (`err_stream_token_invalid` for a bad token), `404` unknown job — JSON, before streaming |
| OPTIONS | `/api/jobs/dashboard/:id/stream` | – | CORS preflight: `204`, `Access-Control-Allow-Methods: GET`, `Access-Control-Allow-Headers: Last-Event-ID` |
| POST | `/api/jobs/dashboard/:id/cancel` | – | `JobSummary` (queued → `cancelled` immediately; running → `cancelRequested=true`) |
| POST | `/api/jobs/dashboard/:id/retry` | – | `JobSummary` (failed/cancelled → `queued`, attempts reset, checkpoint kept = resume) |
| GET | `/api/jobs/dashboard/recurring` | – | `{ items: RegisteredJob[] }` |
| PUT | `/api/jobs/dashboard/recurring/:id` | `{ enabled?, cron?: string \| null }` | `RecurringJob` (`null` clears the cron = manual only; any cron change sets `next_run_at=null`) |
| POST | `/api/jobs/dashboard/recurring/:id/run` | – | `201 JobSummary` (linked via `recurringJobId`; `409` if the concurrency key is busy) |
| GET | `/api/jobs/dashboard/workers` | – | `{ items: Worker[] }` |

Enqueue = INSERT + `pg_notify('jobs', id)` + `pg_notify('job_events', id)` in one transaction; cancel and retry also notify `job_events` in their transaction. Job types are an allowlist (`apps/api/src/modules/jobs/job-types.ts`) with a static English description, a TypeBox payload schema and a concurrency key per type (`search.reindex` and `search.sync`: payload `{}`, key `search.index`).

```ts
JobSummary = { id, type, status, payload, progress: { phase?, processed?, total?, message? },
  cancelRequested, lockedBy: string | null, hasCheckpoint: boolean,
  attempts, maxAttempts, runAt, startedAt, finishedAt, error,
  recurringJobId, createdAt, updatedAt }            // timestamps ISO strings or null
JobLog = { id: number, level: "info" | "warn" | "error", message, createdAt }
RecurringJob = { id, type, cron: string | null, payload, enabled, nextRunAt, lastEnqueuedAt, lastJobId }
RegisteredJob = RecurringJob & { description: string | null,   // static per type; null if not allowlisted
  currentJob: JobSummary | null,   // newest queued/running run (by recurringJobId or type)
  lastJob: JobSummary | null }     // most recently finished (succeeded/failed/cancelled) run
Worker = { id, hostname, version, startedAt, lastSeenAt, online }
```

## Live stream (SSE)

`GET /api/jobs/dashboard/:id/stream`. The web app runs on Vercel's free tier and must not hold long-lived connections, so the **browser connects directly to the API** (`https://api2.vefacaglar.com`):

1. The dashboard (with its normal admin session) calls `POST /api/jobs/dashboard/:id/stream-token` → `{ token, expiresAt, streamPath }` where `streamPath = /api/jobs/dashboard/<id>/stream`.
2. The browser opens `new EventSource(API_URL + streamPath + "?token=" + token)` (optionally `&afterLogId=`). On a `401` it fetches a new token and reconnects (EventSource's own reconnect reuses the old URL, so after 120 s a fresh token is needed for reconnects).

**Stream token**: HS256 JWT signed with `JOB_STREAM_TOKEN_SECRET` (unset = random per-process key, fine for one API instance); claims `sub` (user id), `jobId`, `scope: "job-stream"`, `iat`, `exp = iat + 120 s`. On connect the API verifies signature, expiry and scope, requires `jobId` = `:id`, and re-loads the user (must exist, be active and be admin); otherwise `401 { message }` (`err_stream_token_invalid`). The token is checked **only at connect time**; an open stream runs until its 30 min lifetime. Without `token` the route accepts the regular `Authorization: Bearer` admin session. Token values are redacted from request logs (`?token=[REDACTED]`); keep reverse-proxy access logs from recording query strings too.

**CORS (stream route only, no credentials)**: origins from `WEB_ORIGINS` (comma-separated; default `https://vefacaglar.com,https://www.vefacaglar.com`, plus `http://localhost:3000` outside production). For an allowed `Origin` the response carries `Access-Control-Allow-Origin: <origin>` and `Vary: Origin` — on the event stream and on JSON errors (400/401/404). Preflight `OPTIONS` → `204` with `GET` / `Last-Event-ID`. Other origins get no CORS headers (the browser blocks). Implemented as route-level options of the existing `@fastify/cors` plugin; all other routes keep the global `WEB_URL` origins.

Response headers: `Content-Type: text/event-stream; charset=utf-8`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`, `X-Accel-Buffering: no` (+ the usual CORS/helmet headers). The body starts with `retry: 3000`, then:

| event | id | data | when |
|---|---|---|---|
| `snapshot` | – | `JobSummary` | on connect, and whenever the job changed since the last snapshot (any field except `updatedAt`) |
| `log` | log id | `JobLog` | every log with `id > cursor`, ascending |
| `done` | – | `{ "status": "succeeded" \| "failed" \| "cancelled" }` | job is terminal and all logs were sent; the response then ends |
| `: ping` (comment) | – | – | every 15 s |

- **Cursor**: `job_logs.id` (`bigserial`, sent as the SSE `id`). `Last-Event-ID` (sent by EventSource on reconnect) overrides `?afterLogId`; a malformed header is ignored. Without any cursor the initial backlog is the **last 500** logs; with a cursor, all logs after it (paged by 500).
- **Change detection**: one process-wide `LISTEN job_events` connection in the API (`PgJobEventsListener`, postgres-js, same `DATABASE_URL`, opened on the first subscriber, closed 60 s after the last, reconnects with exponential backoff and then re-checks every stream). Each stream additionally re-checks every 2 s and coalesces bursts to at most one read per 250 ms.
- **Limits**: a stream ends after 30 min (no `done`; clients reconnect with `Last-Event-ID`). Slow clients are paused (DB is the buffer; the cursor only advances for written events) and disconnected if they do not drain within 30 s.
- **`job_events` channel contract**: `pg_notify('job_events', '<job uuid>')` — payload is only the job id as text; listeners re-read the row and logs, so extra/duplicate notifications are harmless and missed ones are covered by the 2 s re-check.
- Note: browsers' `EventSource` cannot send an `Authorization` header; clients use a fetch-based SSE reader (or a same-origin proxy) with the bearer token.

## Deployment

The worker runs as two active Docker replicas on the same VPS as the API, joined
to the database network. Managed replicas use unique automatic worker IDs.
Deployments use immutable generation configurations: health-check the candidate
in standby, persistently drain previous generations without stopping their jobs,
then activate the candidate. Old generations may remain in the background until
their work finishes; the database still permits at most two running jobs overall.
Rollback uses a fresh standby generation through the same protocol. Retired
containers have restart disabled before drain and are cleaned up only after exit.
Legacy images without the control protocol require a separate verified idle
handoff; they must never be started as supposedly standby candidates.
Image: `ghcr.io/<repo>-worker`, built and deployed by
`.github/workflows/worker-ci.yml`. Env: `DATABASE_URL`, `TYPESENSE_HOST`,
`TYPESENSE_PORT`, `TYPESENSE_PROTOCOL`, `TYPESENSE_API_KEY`, optional `WORKER_ID`
for independently managed workers, `RUST_LOG`.

Local: `pnpm --filter worker worker:dev` (deliberately not part of `pnpm dev`, because the local `.env` points at production services).
