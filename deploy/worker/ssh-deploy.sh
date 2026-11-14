#!/usr/bin/env bash
# Transfer the private bundle and run the worker deployment over SSH.
set -euo pipefail
[[ "$VPS_HOST" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*$ ]]
[[ "$VPS_USER" =~ ^[a-zA-Z_][a-zA-Z0-9_-]*$ ]]
[[ "$VPS_PORT" =~ ^[0-9]+$ ]]
[[ "$DEPLOY_ID" =~ ^[0-9]+-[0-9]+$ ]]
test -n "$REGISTRY_TOKEN"

bundle_dir="$RUNNER_TEMP/vefacaglar-worker-bundle"
remote_dir="vefacaglar-worker"
incoming="$remote_dir/.incoming-$DEPLOY_ID"

# shellcheck source=deploy/ssh-common.sh
source "$(dirname "$0")/../ssh-common.sh"
ssh_setup "$RUNNER_TEMP/vefacaglar-worker-ssh-key"

cleanup() {
  status=$?
  with_retry remote "rm -rf ~/$incoming" || true
  exit "$status"
}
trap cleanup EXIT

with_retry remote "set -e; umask 077; mkdir -p ~/$remote_dir; chmod 700 ~/$remote_dir; mkdir -p ~/$incoming"
with_retry upload "$bundle_dir/"* "$incoming/"
with_retry remote true
printf '%s' "$REGISTRY_TOKEN" | remote "bash ~/$incoming/receive.sh"
