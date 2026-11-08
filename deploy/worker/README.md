# Worker deployment through GitHub

The background jobs worker (`apps/worker`, Rust; spec in
[`docs/jobs-worker.md`](../../docs/jobs-worker.md)) runs as two Docker
containers on the same VPS as the API. Each process executes one job; a database
claim gate admits at most two running jobs across all worker instances. GitHub Actions
(`.github/workflows/worker-ci.yml`) checks formatting, clippy and tests, then
builds amd64 and arm64 images on separate native runners. The amd64 VPS deploy
pins its architecture's immutable digest as soon as that build succeeds; it
does not wait for ARM. After both builds succeed, CI publishes the combined
`ghcr.io/vefacaglar/vefacaglar-site-worker:<commit>` tag. Architecture-specific
tags have `-amd64` and `-arm64` suffixes. Pull requests never publish or deploy.
The image also includes Node and the compiled API maintenance command used by
`catalog.popularity.refresh`; its provider and scoring logic stays shared with
the API. The Docker build context is the repository root.

The image build disables release LTO and uses 16 code generation units for
both cargo-chef dependency compilation and the final binary. This keeps normal
release optimization and stack line information while avoiding costly link
optimization for an I/O-bound worker; the repository's Cargo release profile
is unchanged. Build caches have separate architecture scopes. Cache export is
optional and bounded to three minutes, so a cache service failure cannot fail
an otherwise successful image publication or deployment.

Worker deploys use blue/green generations without a public endpoint. Each
release creates a private `generations/g<id>/` directory containing an immutable
image digest, Compose configuration and environment snapshot. Two candidate
containers first start in **standby**: they register and heartbeat normally but
neither claim jobs nor schedule recurring jobs. The deploy probes
`worker --deployment-protocol` without configuration or networking and requires
protocol `1`, healthy containers and acknowledged standby before handover.

The old generation's restart policy becomes `no`, and its durable admission file
is atomically changed to **drain**. The worker acknowledges drain only after any
in-flight claim has settled. It stops taking new work, keeps heartbeats running,
and finishes its current job normally before exiting successfully. Deployment
drain never cancels the job or starts the SIGTERM shutdown deadline. The new
generation becomes **active** only after old containers acknowledge drain or
exit successfully. The shared database gate keeps the total at two running jobs
across both generations, so new workers use capacity as retiring jobs finish.
The workflow does not wait for long jobs to finish. Retired containers and their
environment snapshots are retained; deployment never deletes a draining
container's files. A restarted retiree reads the persisted drain file and exits
without claiming work. The whole control directory is mounted read-only so
atomic file replacement remains visible inside the container.

Readiness failure leaves the current active generation running. If activation
fails after handover, a previous protocol-capable image is prepared as a fresh
standby generation, the unsuccessful candidate is drained, and the replacement
is activated. This also preserves jobs started during an unsuccessful release.
Rollback never reactivates a retiring generation and never uses an old image
which lacks the admission protocol. A subsequent deployment reconciles live
managed generations left by an interrupted SSH session before activating its
candidate. Failure to acknowledge drain fails closed.

The first upgrade from an older image needs a separate idle handover because
legacy SIGTERM cancels active work. On the Linux Docker host, the deploy briefly
freezes the legacy containers, acquires a short-timeout SHARE fence on `jobs`,
and freshly verifies every worker TCP database socket against a direct Postgres
container and its exact backend PID, start time and endpoint. A running job
causes immediate unfreeze and retry. Only an idle, exclusively identified worker
has its database sessions terminated and freshly verified gone while it remains
frozen and intact. Only then is its idle retirement committed and the container
removed, before releasing the fence. Thus a previously submitted blocked claim
cannot run after unlock. An independent detached watchdog activates after 15 seconds and survives lost
SSH. A per-attempt journal and flock serialize pause/retirement with watchdog
recovery: before the idle retirement commit it confirms workers are unfrozen;
afterward it finishes removal and never unfreezes a worker awaiting removal.
If the deployment controller stalls while holding that journal lock, the
watchdog terminates only its still-parent controller after a further second,
then recovers according to the journal. Transient Docker failures are retried;
recovery requires a responding Docker daemon. A separate stable recovery lock
is inherited only by the watchdog, preventing any subsequent deployment from
freezing those workers until prior recovery finishes. An unconfirmed unfreeze
aborts the deployment rather than starting another attempt. Proxy/NAT ambiguity, changed identities,
missing ownership evidence, a stopped/restarting legacy container, or no idle
window within four minutes aborts the
upgrade without stopping active jobs; retry the workflow later. This conservative
bootstrap requires root access, `nsenter`, `ss`, Python 3 and direct container
Postgres access. Normal protocol-capable handovers do not freeze workers or use
administrator database sessions.

CD does not run migrations: the job tables come from the API's Drizzle
migrations (`packages/db`), which must be applied before the first deployment.

## First-time VPS setup

The VPS already hosts the API, so Docker, Compose 2.30+, Bash, SSH access and the
database network exist. Additionally:

1. Make sure Python 3, `flock` and `nsenter` (`util-linux`), and `ss` (`iproute2`) are installed (present on Debian/Ubuntu).
2. The worker joins the external Docker network that reaches Postgres and
   Typesense (`databases_default` by default, the same as the API). Inside the
   container `localhost` is the worker itself, so use the service hostnames
   (e.g. `postgres`, `typesense`) in `DATABASE_URL` / `TYPESENSE_HOST`.
3. CD creates `~/vefacaglar-worker` (mode 700), stores each generation below
   `generations/`, logs in to GHCR with the job's temporary token and starts the
   new standby pair. `.active-generation` records the successful handover.

Manual operations on the VPS:

```sh
cd ~/vefacaglar-worker
generation=$(cat .active-generation)
docker compose --project-name "vefacaglar-worker-$generation" \
  --env-file "generations/$generation/compose.env" \
  --file "generations/$generation/compose.yml" ps
docker ps --filter label=io.vefacaglar.worker.managed=1
# Inspect an exact container's JSON logs without stopping it:
docker logs --tail 100 CONTAINER_ID
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
| `WORKER_ID` | Ignored by managed Compose; replicas always use unique automatic IDs |
| `WORKER_DB_POOL_MAX` | Optional Postgres pool size (default `5`) |

Managed Compose explicitly overrides `WORKER_ID` to an empty value, so replicas
always use distinct container-hostname-plus-PID identities. A fixed ID is only
appropriate for a separately managed worker with a unique identity.

Every deploy creates a new environment snapshot. Existing draining generations
keep their original snapshot until they finish. Changing secrets alone does not deploy; use
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
