# API on the VPS

The web app stays on Vercel. GitHub Actions tests the API, builds an amd64/arm64
image and publishes `ghcr.io/<owner>/<repository>-api:<commit>` on `main`.
Deployment uses the immutable image digest, SSH and Docker Compose. PRs run
verification and build the image without publishing or deploying.

The existing Vercel entrypoint (`dist/app.js`) is preserved. Docker runs
`dist/server.js`. No database container, volume or migration is managed here.

## One-time VPS setup

Requires Linux, Bash, `flock`, Docker and Compose v2.30+ (for raw env files).
The SSH deployment user must have access to Docker and own `~/vefacaglar-api`.
Docker access grants administrative control of the host; use a dedicated SSH key.

Copy `.env.example` and `api.env.example` from this directory to the VPS as
`~/vefacaglar-api/.env` and `~/vefacaglar-api/api.env`. Keep both files private:

```sh
mkdir -p ~/vefacaglar-api
chmod 700 ~/vefacaglar-api
chmod 600 ~/vefacaglar-api/.env ~/vefacaglar-api/api.env
```

Set `API_DOCKER_NETWORK` to the existing user-defined Docker network used by
PostgreSQL. Inspect it with `docker network ls` and `docker inspect <db-container>`.
The API joins that external network. Use the database container's hostname and
internal port in `DATABASE_URL`, not `localhost` or the public VPS address.
If the database currently uses Docker's default `bridge`, create a user-defined
network and attach the database; persist that membership in its owning Compose
configuration so it survives recreation.

Copy the existing API's required ImageKit, Typesense, Redis and authentication
settings into `api.env`. Preserve the current `AUTH_MODE` and OIDC values.
Values in `api.env` are literal: do not add shell quotes around them; `$` is not
interpolated. `.env` contains only Compose settings, not application secrets.

Confirm that the VPS database already contains the production schema and data
before switching traffic. A running database container alone does not establish
this. This deployment intentionally does not seed, migrate or overwrite it.

If the GHCR package is private, log in once **as the deployment user**, using a
GitHub token with `read:packages` access to the package:

```sh
docker login ghcr.io --username YOUR_GITHUB_USERNAME
```

Enter the token at the password prompt. Do not put it in the repository or image.

## Caddy and Cloudflare

Create a Cloudflare DNS `A` record named `api2` pointing to the VPS IPv4 address.
Start with DNS only. Add an `AAAA` record only if IPv6 reaches this same server.
Allow incoming ports 80 and 443 for Caddy; the API port binds only to loopback.

Add the block in `Caddyfile.example` to the existing Caddy configuration. If Caddy
runs directly on the host, use `127.0.0.1:3001` (or the chosen `API_BIND_PORT`).
If Caddy runs in Docker, attach it to `API_DOCKER_NETWORK` in its own persistent
Compose configuration and use `vefacaglar-api:3001` instead.

Validate and reload Caddy using its existing service/container setup. Preserve
the other site blocks. Caddy handles the certificate for `api2.vefacaglar.com`.
See the [Caddy reverse proxy documentation](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy).

If Cloudflare proxying is enabled later, use
[Full (strict)](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/)
and configure Caddy to trust only Cloudflare's proxy ranges for forwarded client
IPs; otherwise the API's rate limits can group visitors under an edge IP.

## GitHub settings

Create an environment named `api-production`. Add its secrets:

| Secret | Value |
| --- | --- |
| `VPS_HOST` | Direct VPS IPv4 address or DNS-only SSH hostname |
| `VPS_USER` | Deployment user |
| `VPS_PORT` | Optional SSH port, defaults to 22 |
| `VPS_SSH_KEY` | Dedicated SSH private key; install its public key on the VPS |
| `VPS_KNOWN_HOSTS` | Verified OpenSSH known_hosts line for this host and port |

Verify the host-key fingerprint through the VPS console or a trusted connection
before saving `VPS_KNOWN_HOSTS`. The workflow never disables host-key checking.
For a non-default port, known_hosts uses `[host]:port`.

After DNS, Caddy, env files and registry access are ready, set the **repository
variable** `API_DEPLOY_ENABLED=true`. Without it, CI publishes images on main but
skips SSH deployment. Run **API CI and deploy** manually on `main` for the first
deployment. Subsequent matching changes pushed to `main` deploy automatically.

The workflow copies only `compose.yml` and `deploy.sh`; secrets remain on the VPS.
Deployments wait for container health, then check the public HTTPS endpoint.
A failed container health check restores the last successful image and Compose
file when available. A public DNS/TLS failure reports an error but does not roll
back the container. The first deployment has no previous version to restore.
Replacing the single API container can briefly interrupt requests.

The image publishing pattern follows the
[GitHub Actions documentation](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images).

## Cut over the web app

Check `https://api2.vefacaglar.com/health` and an actual data endpoint, then test
dashboard login, search and image upload. `/health` only checks API liveness;
it does not verify database contents or external services.

Set both `API_URL` and `NEXT_PUBLIC_API_URL` on the Vercel **web** project to
`https://api2.vefacaglar.com`, then redeploy the web app. Keep `WEB_URL` on the API
set to the exact frontend origins. Keep the old API available until these checks
pass; reverting the web env values and redeploying provides a cutover rollback.
If the catalog-import workflow should use the VPS database too, update its
database connection separately after verifying network access and data.

## Operations

```sh
cd ~/vefacaglar-api
API_IMAGE="$(cat .current-image)" docker compose --env-file .env -f compose.yml ps
API_IMAGE="$(cat .current-image)" docker compose --env-file .env -f compose.yml logs --tail 100 api
```

To redeploy an earlier compatible image, use its published immutable digest:

```sh
bash deploy.sh ghcr.io/OWNER/REPOSITORY-api@sha256:DIGEST
```

Replace the placeholders with the actual lowercase package name and digest.
The most recent previous image is recorded in `.previous-image`. Database and
external-service changes are outside image rollback. Do not prune earlier
images until the new release has been verified.
