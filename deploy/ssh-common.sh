# shellcheck shell=bash
# Shared SSH helpers for the deploy/*/ssh-*.sh scripts that run on the GitHub runner.
# Source it, then call ssh_setup <private-key-file>. Requires VPS_HOST, VPS_USER,
# VPS_PORT and, without a key file, VPS_PASSWORD.
#
# Parallel deploy jobs open their own SSH connections to the same VPS. A new
# connection can time out transiently, so idempotent steps (mkdir, upload,
# cleanup, a connectivity probe) retry with exponential backoff. The step that
# runs the remote deployment never retries: a dropped session may already have
# started it, and the remote side recovers interrupted rollouts itself.

ssh_setup() {
  local key_file=$1
  ssh_command=(ssh)
  scp_command=(scp)
  ssh_options=(-o StrictHostKeyChecking=yes -o ConnectTimeout=15
    -o ServerAliveInterval=30 -o ServerAliveCountMax=10)
  if [[ -s "$key_file" ]]; then
    ssh_options+=(-o BatchMode=yes -o IdentitiesOnly=yes -i "$key_file")
  else
    test -n "${VPS_PASSWORD:-}"
    export SSHPASS="$VPS_PASSWORD"
    ssh_command=(sshpass -e ssh)
    scp_command=(sshpass -e scp)
    ssh_options+=(-o PubkeyAuthentication=no -o NumberOfPasswordPrompts=1)
  fi
}

# Run an SSH command on the VPS once.
remote() {
  "${ssh_command[@]}" "${ssh_options[@]}" -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" "$@"
}

# Copy local files (all but the last argument) to a path relative to the remote home.
upload() {
  local destination=${*: -1}
  "${scp_command[@]}" "${ssh_options[@]}" -P "$VPS_PORT" "${@:1:$#-1}" "$VPS_USER@$VPS_HOST:$destination"
}

# Retry an idempotent step: SSH_RETRY_ATTEMPTS tries (default 5), backoff
# doubling from SSH_RETRY_DELAY seconds (default 5: 5, 10, 20, 40).
with_retry() {
  local attempt=1 delay=${SSH_RETRY_DELAY:-5} attempts=${SSH_RETRY_ATTEMPTS:-5} status
  while true; do
    if "$@"; then
      return 0
    else
      status=$?
    fi
    if ((attempt >= attempts)); then
      echo "SSH step failed after $attempts attempts (exit $status)." >&2
      return "$status"
    fi
    echo "SSH step failed (exit $status); retrying in ${delay}s ($attempt/$((attempts - 1)))." >&2
    sleep "$delay"
    attempt=$((attempt + 1))
    delay=$((delay * 2))
  done
}
