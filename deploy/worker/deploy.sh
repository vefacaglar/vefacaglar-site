#!/usr/bin/env bash
# Install a prepared bundle into ~/vefacaglar-worker and (re)start the worker.
# No blue/green: the running worker receives SIGTERM, checkpoints and re-queues
# its job, and the new container resumes it.
set -euo pipefail
umask 077
bundle=${1:?Pass the private deployment bundle}
deploy_dir=${WORKER_DEPLOY_DIR:-$(dirname "$bundle")}
cd "$deploy_dir"

exec 9> .deploy.lock
flock -w 300 9

image=$(cat "$bundle/image")
previous=""
if [[ -s .worker-image ]]; then
  previous=$(cat .worker-image)
fi

install -m 600 "$bundle/compose.yml" compose.yml
install -m 600 "$bundle/worker.env" worker.env
install -m 600 "$bundle/compose.env" compose.env

compose() {
  docker compose --env-file compose.env --file compose.yml "$@"
}

compose pull --quiet
if compose up --detach --wait --wait-timeout 180; then
  printf '%s\n' "$image" > .worker-image
  echo "worker running $image"
  exit 0
fi

echo "worker failed to become healthy with $image" >&2
compose logs --tail 100 worker >&2 || true
if [[ -n "$previous" && "$previous" != "$image" ]]; then
  echo "rolling back to $previous" >&2
  sed -i "s#^WORKER_IMAGE=.*#WORKER_IMAGE=$previous#" compose.env
  compose up --detach --wait --wait-timeout 180 || true
fi
exit 1
