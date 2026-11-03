#!/usr/bin/env bash
set -euo pipefail
umask 077
bundle=${2:?Pass the private deployment bundle}
API_DEPLOY_DIR=${API_DEPLOY_DIR:-$(dirname "$bundle")}
export API_DEPLOY_DIR
exec python3 "$bundle/blue-green.py" "${1:?Pass the published image digest}" "$bundle"
