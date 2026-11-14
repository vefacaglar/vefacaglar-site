#!/usr/bin/env bash
# Transfer a private bundle and run CD using the configured GitHub SSH secret.
# Usage: ssh-deploy.sh [deploy|migrate]  (default: deploy)
set -euo pipefail
mode=${1:-deploy}
[[ "$mode" == deploy || "$mode" == migrate ]]
[[ "$VPS_HOST" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*$ ]]
[[ "$VPS_USER" =~ ^[a-zA-Z_][a-zA-Z0-9_-]*$ ]]
[[ "$VPS_PORT" =~ ^[0-9]+$ ]]
[[ "$DEPLOY_ID" =~ ^[0-9]+-[0-9]+$ ]]
test -n "$REGISTRY_TOKEN"

# shellcheck source=deploy/ssh-common.sh
source "$(dirname "$0")/../ssh-common.sh"
ssh_setup "$RUNNER_TEMP/vefacaglar-api-ssh-key"

# Migration and deployment of the same run use separate incoming directories.
incoming="vefacaglar-api/.incoming-$DEPLOY_ID"
if [[ "$mode" == migrate ]]; then
  incoming="$incoming-migrate"
fi

cleanup() {
  status=$?
  with_retry remote "rm -rf ~/$incoming" || true
  exit "$status"
}
trap cleanup EXIT

with_retry remote "set -e; umask 077; mkdir -p ~/vefacaglar-api; chmod 700 ~/vefacaglar-api; mkdir -p ~/$incoming"
with_retry upload "$RUNNER_TEMP/vefacaglar-api-bundle/"* "$RUNNER_TEMP/vefacaglar-api-bundle/.env" "$incoming/"
with_retry remote true
printf '%s' "$REGISTRY_TOKEN" | remote "bash ~/$incoming/receive.sh $mode"
