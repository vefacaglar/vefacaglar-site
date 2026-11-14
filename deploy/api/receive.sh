#!/usr/bin/env bash
# Run from the private incoming directory; the registry token arrives on stdin.
# Usage: receive.sh [deploy|migrate]  (default: deploy)
set -euo pipefail
umask 077
mode=${1:-deploy}
[[ "$mode" == deploy || "$mode" == migrate ]]
bundle=$(cd "$(dirname "$0")" && pwd)
export API_DEPLOY_DIR
API_DEPLOY_DIR=$(dirname "$bundle")
export DOCKER_CONFIG
DOCKER_CONFIG=$(mktemp -d)
cleanup() {
  rm -rf "$DOCKER_CONFIG" "$bundle"
}
trap cleanup EXIT

docker compose version > /dev/null
command -v curl > /dev/null
command -v python3 > /dev/null
docker login ghcr.io --username "$(cat "$bundle/registry-user")" --password-stdin > /dev/null
if [[ "$mode" == migrate ]]; then
  bash "$bundle/migrate.sh" "$(cat "$bundle/image")" "$bundle"
else
  bash "$bundle/deploy.sh" "$(cat "$bundle/image")" "$bundle"
fi
