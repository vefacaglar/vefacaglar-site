# Web deployment through GitHub

GitHub Actions builds the Next.js standalone image for the existing amd64 VPS,
publishes it to GHCR and deploys an immutable digest. Pull requests verify and
build only. The web uses a separate Compose release and loopback port on
`vefacaglar-web`; Caddy serves `vefacaglar.com` and permanently redirects
`www.vefacaglar.com` to the same path and query on the apex domain.
The private web network is created automatically and Caddy is attached to it;
CD adds this external network to Caddy's conventional single Compose file while
preserving its default network. It keeps a private backup and validates the edit
without recreating Caddy. Future Caddy recreations retain both networks;
web containers do not join the database network. Existing API, auth, logs and
Typesense routes are preserved.

The workflow reuses the existing `api-production` GitHub environment and its
`VPS_HOST`, `VPS_USER`, `VPS_KNOWN_HOSTS`, `VPS_SSH_KEY` or `VPS_PASSWORD`, optional
`VPS_PORT`, and `AUTH_MODE`, `OIDC_ISSUER`, `OIDC_CLIENT_ID` secrets. The deployment
user must already have Docker and persistent-Caddyfile access. No manual SSH or
registry login is needed for routine deployment.

Set repository variable `WEB_DEPLOY_ENABLED=true` to enable deployment. Set
`WEB_VERIFY_HTTPS=false` only while staging before DNS cutover; it defaults to
`true`. A manual run uses its `verify_https` input instead. Optional
variables are `WEB_API_URL` (server runtime API), `NEXT_PUBLIC_API_URL` (browser API),
`NEXT_PUBLIC_SITE_URL` (canonical website), `WEB_DOCKER_NETWORK`,
`WEB_CADDY_CONTAINER` and `WEB_CADDY_CONFIG_PATH`. Defaults are
`https://api2.vefacaglar.com`, `https://api2.vefacaglar.com`,
`https://vefacaglar.com` and `vefacaglar-web`; Caddy is detected automatically.
Public values are compiled into the image and also passed to its runtime.
Runtime-only credentials never enter image layers.

An optional `WEB_ENV` secret accepts raw `NAME=value` lines for `API_URL`,
`AUTH_MODE`, `OIDC_ISSUER` and `OIDC_CLIENT_ID`. Individual workflow settings
override matching entries. Web containers receive no database, Typesense,
ImageKit private keys or Redis settings: those integrations belong to the API.

## First migration

Set `WEB_DEPLOY_ENABLED=true` and `WEB_VERIFY_HTTPS=false` before the initial
push, or run **Web CI and deploy** manually with `verify_https` disabled. This stages a healthy web release, checks page rendering
on its private loopback port, and configures both Caddy hostnames. The run explicitly
reports that public HTTPS is still unverified. It does not modify DNS or Vercel.

After staging, the domain owner points the apex and `www` records to
`187.126.24.87`, removing conflicting A/AAAA/CNAME records. Preserve Cloudflare
proxy settings intentionally. Caddy obtains certificates once ACME requests reach
the VPS. Set `WEB_VERIFY_HTTPS=true` and run the workflow again with `verify_https` enabled to verify direct VPS
TLS for both names and the public endpoints. Keep the Vercel project available
until real content, login/callback, images and dashboard mutations have been checked.
OIDC redirect URIs and API allowed origins keep the same public hostname.

## Rollout and recovery

Each release has a private environment file, unique container DNS alias and
assigned loopback port. Health and rendered-page checks happen before Caddy is
changed. Caddy configuration is validated, gracefully reloaded, and verified
against the expected release marker over HTTPS. An initial staging run skips only
that TLS gate. Subsequent pushes require TLS verification once `WEB_VERIFY_HTTPS` is restored to `true`.

The deployment holds an exclusive lock and saves a durable pending transaction.
A failed switch restores the previous Caddyfile before removing its candidate;
an interrupted deployment is recovered on the next run. External Caddyfile edits
cause recovery to stop and retain both releases. Other deployments using the same
Caddyfile must use its file lock. The previous release overlaps for 30 seconds,
then stops; its files are kept for recovery. This overlap does not guarantee old
browser tabs can call changed Server Actions across deployments; refresh stale tabs.
Public-DNS verification is a separate workflow check after the verified server
transaction; a public DNS failure does not roll back a healthy direct-VPS release.
No database migrations are run. Health proves process liveness, not complete
integration correctness. Revert and redeploy a faulty application commit; runtime
configuration changes require another workflow run.

See the official [standalone output documentation](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
and [self-hosting guide](https://nextjs.org/docs/app/guides/self-hosting).
