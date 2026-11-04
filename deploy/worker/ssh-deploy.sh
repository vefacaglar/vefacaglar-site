#!/usr/bin/env bash
# Transfer the private bundle and run the worker deployment over SSH.
set -euo pipefail
[[ "$VPS_HOST" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*$ ]]
[[ "$VPS_USER" =~ ^[a-zA-Z_][a-zA-Z0-9_-]*$ ]]
[[ "$VPS_PORT" =~ ^[0-9]+$ ]]
[[ "$DEPLOY_ID" =~ ^[0-9]+-[0-9]+$ ]]
test -n "$REGISTRY_TOKEN"

bundle_dir="$RUNNER_TEMP/vefacaglar-worker-bundle"
key_file="$RUNNER_TEMP/vefacaglar-worker-ssh-key"
remote_dir="vefacaglar-worker"

ssh_command=(ssh)
scp_command=(scp)
options=(-o StrictHostKeyChecking=yes -o ConnectTimeout=15)
if [[ -s "$key_file" ]]; then
  options+=(-o BatchMode=yes -o IdentitiesOnly=yes -i "$key_file")
else
  test -n "${VPS_PASSWORD:-}"
  export SSHPASS="$VPS_PASSWORD"
  ssh_command=(sshpass -e ssh)
  scp_command=(sshpass -e scp)
  options+=(-o PubkeyAuthentication=no -o NumberOfPasswordPrompts=1)
fi

cleanup() {
  status=$?
  "${ssh_command[@]}" "${options[@]}" -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" \
    "rm -rf ~/$remote_dir/.incoming-$DEPLOY_ID" || true
  exit "$status"
}
trap cleanup EXIT

"${ssh_command[@]}" "${options[@]}" -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" \
  "set -e; umask 077; mkdir -p ~/$remote_dir; chmod 700 ~/$remote_dir; mkdir ~/$remote_dir/.incoming-$DEPLOY_ID"
"${scp_command[@]}" "${options[@]}" -P "$VPS_PORT" "$bundle_dir/"* \
  "$VPS_USER@$VPS_HOST:$remote_dir/.incoming-$DEPLOY_ID/"
printf '%s' "$REGISTRY_TOKEN" | "${ssh_command[@]}" "${options[@]}" -p "$VPS_PORT" \
  "$VPS_USER@$VPS_HOST" "bash ~/$remote_dir/.incoming-$DEPLOY_ID/receive.sh"
