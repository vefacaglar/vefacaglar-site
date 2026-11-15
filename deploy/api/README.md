# API deployment through GitHub

The API runs at `https://api2.vefacaglar.com` on the VPS. The web app has its own
[VPS deployment](../web/README.md). GitHub Actions verifies the API, builds amd64/arm64 images and publishes
`ghcr.io/vefacaglar/vefacaglar-site-api:<commit>` on `main`. Deployment uses the
immutable digest. Pull requests never publish or deploy.

CD creates `~/vefacaglar-api`, transfers runtime settings, authenticates GHCR
with the temporary job token, starts the service, configures the Caddy route if
needed and checks HTTPS directly against the VPS. No manual SSH, env-file editing,
file uploads or registry login are needed for routine deployments.

The Vercel entrypoint `dist/app.js` is preserved; Docker runs `dist/server.js`.
CD does not create a database or seed it. It does apply pending Drizzle
migrations (see [Database migrations](#database-migrations)). The auth server
database is separate.

## GitHub secrets

In the **vefacaglar-site** repository, open **Settings → Secrets and variables →
Actions**. Use repository secrets, or secrets scoped to `api-production`.
Secrets from the authserver repository are not automatically shared here.

| Secret | Value |
| --- | --- |
| `VPS_HOST` | `187.126.24.87` |
| `VPS_USER` | Existing deployment user with Docker access |
| `VPS_PASSWORD` | Existing SSH password |
| `VPS_SSH_KEY` | Optional alternative to the password; an already-authorized key takes precedence |
| `VPS_PORT` | Optional SSH port; defaults to `22` |
| `VPS_KNOWN_HOSTS` | Verified host-key entry, as used for the auth server |
| `DATABASE_URL` | Existing API PostgreSQL connection string reachable from the VPS |
| `WEB_URL` | Exact allowed frontend origins, comma-separated; e.g. `https://vefacaglar.com,https://www.vefacaglar.com` |
| `AUTH_MODE` | Preserve the current mode: `oidc` or `password` |
| `OIDC_ISSUER` | Required for OIDC; `https://auth.vefacaglar.com` |
| `OIDC_CLIENT_ID` | Required for OIDC; the existing registered client ID |

Each secret contains only its value, without the `NAME=` prefix or surrounding
quotes. Add optional integrations using their existing values:

| Feature | Secrets |
| --- | --- |
| Meilisearch search | `MEILISEARCH_URL` (`http://meilisearch:7700` on the API's Docker network), `MEILISEARCH_API_KEY` ([permissions](../../docs/search-meilisearch.md#api-keys)); without them search uses PostgreSQL |
| Image uploads | `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_PUBLIC_KEY`, optionally `IMAGEKIT_FOLDER` |
| IGDB imports | `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET` |
| Live job stream (browser connects directly) | `JOB_STREAM_TOKEN_SECRET` (random, ≥ 32 bytes, e.g. `openssl rand -base64 48`; unset = random per-process key, single instance only), `WEB_ORIGINS` (origins allowed to open `/api/jobs/dashboard/:id/stream`; defaults to `https://vefacaglar.com,https://www.vefacaglar.com`) |
| Additional runtime settings | `PG_POOL_MAX`, `API_URL` (defaults to `https://api2.vefacaglar.com`) |

Alternatively, put a complete raw env file in the optional `API_ENV` secret.
Nonempty individual secrets override matching entries in that file. Dollar signs,
spaces and quotes are preserved literally; no shell evaluation occurs. Duplicate
or malformed entries and multiline individual values are rejected without printing
their contents. `DATABASE_URL`, `WEB_URL` and `AUTH_MODE` are required; OIDC mode
also requires its issuer and client ID. The Compose file enforces production mode,
the container's listening address and port.

[Application logs](../../docs/application-logs.md) are JSON lines on stdout;
`LOG_ENVIRONMENT` optionally overrides their environment label.

Every deploy replaces the full env file. To remove a setting, remove it from both
its individual secret and `API_ENV`. Changing secrets alone does not trigger a
deploy; select **Run workflow** afterwards. Files are private to the deployment
user. Each release has its own private environment. A failed rollout leaves the active
release running; a failed traffic check restores the previous Caddy route.

Rate limit counters and the search circuit breaker are kept in each API process.
Limits are per visitor: the API trusts `X-Forwarded-For` only from loopback and
private (Docker) addresses, i.e. Caddy, and web SSR requests reaching it from such an
address name their visitor in `X-Visitor-IP`. A client on the internet can set neither.
The web is behind Cloudflare, so it takes the visitor from `CF-Connecting-IP` (falling
back to the last `X-Forwarded-For` entry, then `X-Real-IP`). A client that reaches the
web origin directly, bypassing Cloudflare, can spoof `CF-Connecting-IP`; at worst it
picks its own rate-limit key and evades its own limit, which is accepted here.

## GitHub variables and deployment

| Repository variable | Value |
| --- | --- |
| `API_DEPLOY_ENABLED` | `true` to enable deployment |
| `API_DOCKER_NETWORK` | Optional existing network; defaults to `databases_default` |
| `API_BIND_PORT` | Legacy host-Caddy upstream port for the first migration; defaults to `3001` |
| `API_CADDY_CONTAINER` | Optional container name/ID when multiple Caddy containers exist |
| `API_CADDY_CONFIG_PATH` | Optional Caddyfile path inside the container or on the host |

Push API/deployment changes to `main`, or select **Actions → CI and deploy →
Run workflow → main**. The deploy job uses the `api-production` environment.
No separate GHCR token is required: the job's `GITHUB_TOKEN` has package-read access
and is supplied over SSH stdin to a temporary Docker credential directory. That
directory and the temporary upload are removed after deployment.

## Infrastructure and HTTPS

The VPS must already provide Docker, Compose 2.30+, Python 3, Bash, `curl`, SSH
access, the external application network and a running Caddy installation. The
database and optional services must be reachable from that network; `localhost`
inside the API container refers to the API itself.

CD detects one conventional Caddy container with a persistent Caddyfile, or a host
systemd Caddy service. It preserves other sites, including the authserver route.
The first blue-green deployment adopts a single explicit multiline API site block
only when its existing upstream matches the legacy deployment. Imports, multi-site
blocks, ambiguous containers and conflicting upstreams fail without switching
traffic. Custom API directives are preserved while the proxy target is changed.

Each release has a unique Compose project, DNS alias and automatically assigned
host loopback port. Docker Caddy uses `vefacaglar-api-<release>:3001`; host Caddy
uses the assigned loopback port. No additional GitHub secrets or port variables
are required. Caddy is attached to the application network if necessary.
Ports 80/443 and DNS
must reach Caddy for public certificate issuance. The workflow does not modify DNS.
For a new record, use Cloudflare `A api2 → 187.126.24.87`, DNS only. Do not change an
already-correct record. Cloudflare proxying requires a separate trusted-proxy setup.

HTTPS checks connect directly to the VPS with the API hostname, then test public
DNS. This prevents an old hosting provider from satisfying the VPS health gate.
`/health` checks liveness only; it does not prove database contents or integrations.

## Web cutover and recovery

Verify a data endpoint, dashboard sign-in, search and image upload. The web deployment defaults both its runtime API and public browser API to
`https://api2.vefacaglar.com`; use the [web workflow](../web/README.md) to redeploy. Keep API `WEB_URL` aligned
with the actual frontend origins. The web app's OIDC settings and registered
redirect URIs must agree with the existing client configuration.

## Blue-green rollout and recovery

The deploy lock covers the entire transaction. CD starts a new isolated blue or
green release without stopping the active one. Compose waits for container health,
then Caddy validates and gracefully reloads the new proxy target. A direct HTTPS
request to the VPS loopback address verifies the TLS certificate, health response
and the candidate's `X-API-Deployment` response header. Only then is the active
release recorded atomically in `.releases.json`.

The immediate previous release stays running for 10 minutes after the verified
traffic switch. The deploy job finishes right after the switch: the retirement is
recorded in `~/vefacaglar-api/.retirements.json` (release ID → due Unix time) and
handed to a detached server process (`blue-green.py --retire`, started with
`setsid` from the new release's directory, logging to
`~/vefacaglar-api/retirement.log`). When an entry is due, that process takes the
deploy lock, checks the active release over HTTPS again and only then stops the
recorded release with Docker's 30-second stop timeout. The immediate previous
release directory and environment remain available for recovery, but its process
and health checks stop. Older release directories and the original
single-container API are retired the same way. Reserve memory and DB connections
for the temporary rollout overlap; connections lasting beyond it may be
disconnected.

Retirement acts only on IDs recorded in the file and never on the active release,
so a deployment made during a grace window is safe: the new active release is
never stopped, and the earlier release still retires when its own grace ends.
Retirement is idempotent. If the detached process dies (e.g. a reboot) or the
active release fails its check, entries stay in the file; the next deployment
retires overdue entries before starting its candidate.

To inspect or cancel a pending retirement on the VPS:

```sh
cat ~/vefacaglar-api/.retirements.json        # pending releases and due times
tail ~/vefacaglar-api/retirement.log          # retirement process output
pgrep -af 'blue-green.py --retire'            # detached process(es)
# Cancel: kill the process(es), then remove the entry (or the whole file).
pkill -f 'blue-green.py --retire'; rm ~/vefacaglar-api/.retirements.json
```

If the candidate fails before the switch, the running predecessor is retained,
the candidate is removed and the workflow fails.

## Database migrations

On `main`, the `migrate` job of `.github/workflows/ci-deploy.yml` runs whenever
the run builds a new API image (any `packages/db` change does) and API or worker
deployment is enabled. It uploads the same private API bundle, then on the VPS
runs `deploy/api/migrate.sh`: under the API deploy lock it executes
`node packages/db/dist/migrate.js` once in a throwaway container of the new API
image (`--rm`, read-only, no capabilities) on the API network with the API env
file, because `DATABASE_URL` uses the internal Docker hostname.

The runner applies the generated SQL in `packages/db/drizzle` with the same
bookkeeping as `drizzle-kit migrate` (`drizzle.__drizzle_migrations`), in one
transaction guarded by `pg_advisory_xact_lock`, so concurrent runs serialize and
a failed migration changes nothing. Nothing pending is a quick no-op. Only
migration tags or the database error are printed, never the URL. A failure
fails the job and skips the API, web and worker deployments; the running
releases keep serving. Because the old releases keep running against the new
schema, migrations must be backward-compatible with them.

A failed candidate health check never changes traffic. A failed reload or HTTPS
check reloads the original route before removing the candidate. If recovery is
uncertain, both containers and `.pending-release.json` are retained. The next
workflow run recovers that transaction before starting another candidate. If the
Caddyfile was edited externally during the transaction, recovery refuses to
silently overwrite that edit. Do not run another tool that edits the same
Caddyfile concurrently with a deployment.

The public HTTPS check is a separate DNS/accessibility check after the server
transaction; it does not roll back a successfully verified direct VPS rollout.
`/health` proves liveness, not database or integration correctness. Database
migrations are not run by CD; schema changes must be compatible with both versions.
No rollback reverses database writes or external-service changes.

To recover from a later application regression, revert the application change in
GitHub and deploy `main` again. To restore runtime settings, update GitHub secrets
and run the workflow. Keep the old external hosting provider until data endpoints,
sign-in, search and uploads have been checked on the VPS.
