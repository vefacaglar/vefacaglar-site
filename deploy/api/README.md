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
CD does not create a database, seed it or apply migrations. Use the existing API
database with its production schema and data. The auth server database is separate.

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
| Typesense search | `TYPESENSE_HOST`, `TYPESENSE_PORT`, `TYPESENSE_PROTOCOL`, `TYPESENSE_API_KEY`; `TYPESENSE_PUBLIC_URL` can replace explicit host/port/protocol |
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

For [application logs](../../docs/application-logs.md), set
`LOG_TYPESENSE_URL` and `LOG_TYPESENSE_API_KEY` (optionally `LOG_ENVIRONMENT`)
as GitHub secrets or include them in `API_ENV`.

Every deploy replaces the full env file. To remove a setting, remove it from both
its individual secret and `API_ENV`. Changing secrets alone does not trigger a
deploy; select **Run workflow** afterwards. Files are private to the deployment
user. Each release has its own private environment. A failed rollout leaves the active
release running; a failed traffic check restores the previous Caddy route.

Rate limit counters and the search circuit breaker are kept in each API process.

## GitHub variables and deployment

| Repository variable | Value |
| --- | --- |
| `API_DEPLOY_ENABLED` | `true` to enable deployment |
| `API_DOCKER_NETWORK` | Optional existing network; defaults to `databases_default` |
| `API_BIND_PORT` | Legacy host-Caddy upstream port for the first migration; defaults to `3001` |
| `API_CADDY_CONTAINER` | Optional container name/ID when multiple Caddy containers exist |
| `API_CADDY_CONFIG_PATH` | Optional Caddyfile path inside the container or on the host |

Push API/deployment changes to `main`, or select **Actions → API CI and deploy →
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
traffic switch. CD checks the new release again before stopping the previous
API, with Docker's 30-second stop timeout. The previous release directory and
environment remain available for recovery, but its process and health checks
stop. Only the active API normally remains running; reserve memory and DB
connections for the temporary rollout overlap. Older release directories and
the original single-container API are retired after the same grace period.
Connections lasting beyond this overlap and stop timeout may be disconnected.
The deploy job stays open during this interval and has a 25-minute timeout.

If the final health check fails, the running predecessor is retained and the
workflow fails. The verified traffic switch remains committed; this later check
does not automatically switch traffic back. Cancellation or cleanup failure also
fails the workflow and can leave the predecessor running until another deploy.

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
