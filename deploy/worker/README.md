# Worker deployment through GitHub

The background jobs worker (`apps/worker`, Rust; spec in
[`docs/jobs-worker.md`](../../docs/jobs-worker.md)) runs as a single Docker
container on the same VPS as the API. GitHub Actions
(`.github/workflows/worker-ci.yml`) checks formatting, clippy and tests, builds
an amd64/arm64 image and publishes `ghcr.io/vefacaglar/vefacaglar-site-worker:<commit>`
on `main`. Deployment pins the immutable digest. Pull requests never publish or deploy.
The image also includes Node and the compiled API maintenance command used by
`catalog.popularity.refresh`; its provider and scoring logic stays shared with
the API. The Docker build context is the repository root.

There is no blue/green rollout and no public endpoint. A deploy pulls the new
image and runs `docker compose up -d --wait`: Docker sends SIGTERM to the old
container, the worker stops claiming, lets the running job reach its next batch
boundary, saves its checkpoint, puts the job back in the queue and exits (well
inside the 120 s `stop_grace_period`). Search jobs resume from their checkpoint.
The catalog popularity job stops and reaps its Node child, then reruns the
refresh on retry; it does not checkpoint inside the provider scan. If the new container does not become healthy within 180 s, the
script restarts the previous image and the workflow fails.

CD does not run migrations: the job tables come from the API's Drizzle
migrations (`packages/db`), which must be applied before the first deployment.

## First-time VPS setup

The VPS already hosts the API, so Docker, Compose 2.30+, Bash, SSH access and the
database network exist. Additionally:

1. Make sure `flock` is installed (`util-linux`; present on Debian/Ubuntu).
2. The worker joins the external Docker network that reaches Postgres and
   Typesense (`databases_default` by default, the same as the API). Inside the
   container `localhost` is the worker itself, so use the service hostnames
   (e.g. `postgres`, `typesense`) in `DATABASE_URL` / `TYPESENSE_HOST`.
3. Nothing else: CD creates `~/vefacaglar-worker` (mode 700) with
   `compose.yml`, `worker.env` and `compose.env`, logs in to GHCR with the job's
   temporary token and starts the container.

Manual operations on the VPS:

```sh
cd ~/vefacaglar-worker
docker compose --env-file compose.env ps              # status and health
docker compose --env-file compose.env logs -f worker  # JSON logs (rotated, 3 x 10 MB)
docker compose --env-file compose.env restart worker  # graceful: checkpoints and resumes
```

The image healthcheck runs `worker --healthcheck`, which succeeds while the
worker's own database heartbeat (written every 10 s) is less than 30 s old.

## GitHub configuration

The deploy job uses the same **`api-production`** environment as the API, so the
VPS, database and Typesense secrets are shared; repository secrets work too.
`WORKER_DEPLOY_ENABLED` must be a **repository** variable (the job-level `if` is
evaluated before the environment is entered).

| Secret | Value |
| --- | --- |
| `VPS_HOST`, `VPS_USER`, `VPS_KNOWN_HOSTS` | Same as the API deployment |
| `VPS_SSH_KEY` or `VPS_PASSWORD` | Same as the API deployment (key takes precedence) |
| `VPS_PORT` | Optional, defaults to `22` |
| `DATABASE_URL` | API database, reachable from the Docker network (required) |
| `TYPESENSE_HOST`, `TYPESENSE_API_KEY` | Typesense host and admin key (required) |
| `TYPESENSE_PORT`, `TYPESENSE_PROTOCOL` | Optional; protocol `http`/`https` (default `https`, port 443/80) |
| `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET` | Required by `catalog.popularity.refresh`; not used by search-only jobs |
| `WORKER_ENV` | Optional raw `NAME=value` env file; non-empty individual secrets override it |

| Repository variable | Value |
| --- | --- |
| `WORKER_DEPLOY_ENABLED` | `true` to enable deployment |
| `WORKER_DOCKER_NETWORK` | Optional; falls back to `API_DOCKER_NETWORK`, then `databases_default` |
| `WORKER_RUST_LOG` | Optional `RUST_LOG` filter, e.g. `info,worker=debug` |
| `WORKER_ID` | Optional fixed worker id (default: container hostname + pid) |
| `WORKER_DB_POOL_MAX` | Optional Postgres pool size (default `5`) |

Every deploy replaces `worker.env`. Changing secrets alone does not deploy; use
**Actions → Worker CI and deploy → Run workflow → main** afterwards.

For [application logs](../../docs/application-logs.md), set
`LOG_TYPESENSE_URL` and `LOG_TYPESENSE_API_KEY` (optionally `LOG_ENVIRONMENT`)
as GitHub secrets or include them in `WORKER_ENV`.

The daily popularity refresh is a registered job in the site's Jobs dashboard,
not a GitHub schedule. Configure the two IGDB secrets before enabling its
recurring schedule. Typesense is reached through the worker's existing
`TYPESENSE_HOST` configuration; a separate public URL is not needed.
The maintenance process has a 2 GiB JavaScript heap budget by default
(`NODE_OPTIONS=--max-old-space-size=2048`). This is not a container RSS limit;
allow room for Node's other allocations and the Rust worker. The Compose
service has no memory limit. A larger catalog may require tuning this setting
through `WORKER_ENV` and checking available VPS memory first.

## Local development

`pnpm --filter worker worker:dev` runs the worker with `cargo run`, loading the
repository's `.env`. It is deliberately not part of `pnpm dev`: that `.env`
points at production services, so a local worker would claim production jobs.
Point `DATABASE_URL`/`TYPESENSE_*` at local services before running it.
