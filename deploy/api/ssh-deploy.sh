#!/usr/bin/env bash
# Transfer a private bundle and run CD using the configured GitHub SSH secret.
set -euo pipefail
[[ "$VPS_HOST" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*$ ]]
[[ "$VPS_USER" =~ ^[a-zA-Z_][a-zA-Z0-9_-]*$ ]]
[[ "$VPS_PORT" =~ ^[0-9]+$ ]]
[[ "$DEPLOY_ID" =~ ^[0-9]+-[0-9]+$ ]]
test -n "$REGISTRY_TOKEN"

ssh_command=(ssh)
scp_command=(scp)
options=(-o StrictHostKeyChecking=yes -o ConnectTimeout=15 -o ServerAliveInterval=30 -o ServerAliveCountMax=10)
if [[ -s "$RUNNER_TEMP/vefacaglar-api-ssh-key" ]]; then
  options+=(-o BatchMode=yes -o IdentitiesOnly=yes -i "$RUNNER_TEMP/vefacaglar-api-ssh-key")
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
    "rm -rf ~/vefacaglar-api/.incoming-$DEPLOY_ID" || true
  exit "$status"
}
trap cleanup EXIT

"${ssh_command[@]}" "${options[@]}" -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" \
  "set -e; umask 077; mkdir -p ~/vefacaglar-api; chmod 700 ~/vefacaglar-api; mkdir ~/vefacaglar-api/.incoming-$DEPLOY_ID"
"${scp_command[@]}" "${options[@]}" -P "$VPS_PORT" \
  "$RUNNER_TEMP/vefacaglar-api-bundle/"* "$RUNNER_TEMP/vefacaglar-api-bundle/.env" \
  "$VPS_USER@$VPS_HOST:vefacaglar-api/.incoming-$DEPLOY_ID/"
printf '%s' "$REGISTRY_TOKEN" | "${ssh_command[@]}" "${options[@]}" -p "$VPS_PORT" \
  "$VPS_USER@$VPS_HOST" "bash ~/vefacaglar-api/.incoming-$DEPLOY_ID/receive.sh"
