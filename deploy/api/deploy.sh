#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

image=${1:?Pass the published image digest}
[[ "$image" =~ ^ghcr\.io/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$ ]] || exit 1
test -f .env && test -f api.env

# Serialize manual deploys and CI deployments on this VPS.
exec 9>.deploy.lock
flock -w 180 9

previous_image=""
if [[ -f .current-image ]]; then
  previous_image=$(cat .current-image)
fi

export API_IMAGE="$image"
docker compose --env-file .env -f compose.yml pull api
if ! docker compose --env-file .env -f compose.yml up -d --wait --wait-timeout 120 api; then
  echo "API health check failed."
  if [[ -n "$previous_image" && -f .last-good-compose.yml ]]; then
    echo "Restoring the previous healthy deployment."
    API_IMAGE="$previous_image" docker compose --env-file .env -f .last-good-compose.yml up -d --wait --wait-timeout 120 api
  fi
  exit 1
fi

if [[ -n "$previous_image" ]]; then
  printf '%s\n' "$previous_image" > .previous-image
fi
cp compose.yml .last-good-compose.yml
printf '%s\n' "$image" > .current-image
echo "API deployment is healthy."
