#!/usr/bin/env bash
# Serialize generation handovers; active jobs finish in retiring containers.
set -euo pipefail
umask 077
bundle=$(cd "${1:?Pass the private deployment bundle}" && pwd)
deploy_dir=${WORKER_DEPLOY_DIR:-$(dirname "$bundle")}
mkdir -p "$deploy_dir"
cd "$deploy_dir"
exec 9> .deploy.lock
flock -w 300 9
python3 "$bundle/blue-green.py" "$bundle" "$deploy_dir"
