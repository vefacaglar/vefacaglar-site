#!/usr/bin/env bash
# Apply pending Drizzle migrations from the published API image, once, before any
# new API/worker/web release starts. Uses the API's private env file and network
# (DATABASE_URL points at the internal Docker hostname). A failure exits non-zero
# and CD skips every deployment, so the running releases keep serving.
set -euo pipefail
umask 077
image=${1:?Pass the published image digest}
bundle=${2:?Pass the private deployment bundle}
[[ "$image" =~ ^ghcr\.io/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$ ]]
network=$(sed -n 's/^API_DOCKER_NETWORK=//p' "$bundle/.env")
[[ "$network" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]*$ ]]
deploy_dir=${API_DEPLOY_DIR:-$(dirname "$bundle")}

# Never overlap an API rollout on this host (blue-green.py holds the same lock).
exec 9> "$deploy_dir/.deploy.lock"
flock -w 900 9

echo "Applying database migrations from $image"
docker pull --quiet "$image" > /dev/null
# migrate.js prints only migration tags or the database error, never the URL.
docker run --rm --network "$network" --env-file "$bundle/api.env" --env NODE_ENV=production \
  --read-only --cap-drop ALL --security-opt no-new-privileges \
  --entrypoint node "$image" packages/db/dist/migrate.js
