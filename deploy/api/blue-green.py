#!/usr/bin/env python3
"""Stage an isolated release, switch Caddy, verify HTTPS and retain rollback."""

import fcntl
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import time

SPEC = importlib.util.spec_from_file_location("proxy", Path(__file__).with_name("configure-caddy.py"))
PROXY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PROXY)
DOMAIN = PROXY.DOMAIN
PREVIOUS_RELEASE_GRACE_SECONDS = 10 * 60
RETIREMENTS = ".retirements.json"
LEGACY = "legacy"


def run(arguments, cwd=None):
    result = subprocess.run(arguments, cwd=cwd, capture_output=True, text=True)
    if result.returncode:
        # Never echo process output: Compose diagnostics can contain env values.
        raise RuntimeError(f"{arguments[0]} operation failed during blue-green deployment")
    return result.stdout


def save(path, data):
    temporary = path.with_suffix(".tmp")
    with temporary.open("w") as output:
        json.dump(data, output)
        output.flush()
        os.fsync(output.fileno())
    temporary.chmod(0o600)
    temporary.replace(path)


def read(path):
    return json.loads(path.read_text()) if path.exists() else {}


def compose(directory, *arguments):
    return run(["docker", "compose", "--env-file", ".env", "-f", "compose.yml", *arguments], cwd=directory)


def release_directory(root, release):
    name = release["id"]
    if not re.fullmatch(r"(?:blue|green)-[0-9]+", name):
        raise RuntimeError("Invalid saved release ID")
    return root / "releases" / name


def verify(release, attempts=12):
    for attempt in range(attempts):
        try:
            response = run([
                "curl", "--noproxy", "*", "--fail", "--silent", "--show-error",
                "--max-time", "10", "--resolve", f"{DOMAIN}:443:127.0.0.1",
                "--dump-header", "-", f"https://{DOMAIN}/health",
            ])
            headers, body = response.replace("\r\n", "\n").split("\n\n", 1)
            marker = f"x-api-deployment: {release['id']}"
            if marker in headers.lower().splitlines() and json.loads(body).get("status") == "ok":
                return
        except (RuntimeError, ValueError):
            pass
        if attempt + 1 < attempts:
            time.sleep(2)
    raise RuntimeError("Candidate HTTPS health check failed or reached a different release")


def restore(transaction):
    source = Path(transaction["source"])
    current = source.read_text()
    if current not in (transaction["before"], transaction["after"]):
        raise RuntimeError("Caddy changed during deployment; preserving both releases and recovery record")
    source.write_text(transaction["before"])
    command = transaction["command"]
    config = transaction["config"]
    run(command + ["validate", "--config", config, "--adapter", "caddyfile"])
    run(command + ["reload", "--config", config, "--adapter", "caddyfile", "--force"])


def recover(root):
    pending = root / ".pending-release.json"
    transaction = read(pending)
    if not transaction:
        return
    state = read(root / ".releases.json")
    if state.get("active", {}).get("id") != transaction["candidate"]["id"]:
        # A terminated SSH/job can leave Caddy switched but the state uncommitted.
        # Restore traffic before another deployment can retire either container.
        with Path(transaction["source"]).open() as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            restore(transaction)
        if state.get("active"):
            verify(state["active"])
        compose(release_directory(root, transaction["candidate"]), "down", "--timeout", "30")
    pending.unlink()
    print("Recovered the interrupted deployment.", flush=True)


def deploy(root, bundle, image):
    if not re.fullmatch(r"ghcr\.io/[a-z0-9._/-]+@sha256:[a-f0-9]{64}", image):
        raise RuntimeError("Invalid image digest")
    recover(root)
    try:
        # Catch up on a retirement whose detached process did not finish (e.g. a reboot).
        retire_due(root)
    except (RuntimeError, OSError) as error:
        print(f"Skipping overdue retirement: {error}", flush=True)
    state_path = root / ".releases.json"
    pending = root / ".pending-release.json"
    state = read(state_path)
    active = state.get("active")
    color = "green" if active and active["id"].startswith("blue-") else "blue"
    candidate = {"id": f"{color}-{time.time_ns()}", "image": image}
    directory = release_directory(root, candidate)
    values = dict(line.split("=", 1) for line in (bundle / ".env").read_text().splitlines())
    settings = read(bundle / "proxy.json")
    source, command, config, legacy = PROXY.target(settings, values["API_DOCKER_NETWORK"], values["API_BIND_PORT"])
    if not source.is_file():
        raise RuntimeError("Persistent Caddyfile is missing")
    directory.mkdir(parents=True, mode=0o700)
    for name in ("compose.yml", "api.env"):
        shutil.copyfile(bundle / name, directory / name)
        (directory / name).chmod(0o600)
    (directory / ".env").write_text(
        f"API_DOCKER_NETWORK={values['API_DOCKER_NETWORK']}\nAPI_IMAGE={image}\nAPI_RELEASE={candidate['id']}\n"
    )
    (directory / ".env").chmod(0o600)
    committed = False
    try:
        print(f"Starting isolated {color} release; current traffic is unchanged.", flush=True)
        compose(directory, "config", "--quiet")
        compose(directory, "pull", "api")
        compose(directory, "up", "-d", "--wait", "--wait-timeout", "120", "api")
        address = compose(directory, "port", "api", "3001").strip()
        if not re.fullmatch(r"127\.0\.0\.1:[0-9]+", address):
            raise RuntimeError("Candidate must publish only a loopback port")
        candidate["port"] = address
        upstream = f"vefacaglar-api-{candidate['id']}:3001" if command[0] == "docker" else address
        expected = (f"vefacaglar-api-{active['id']}:3001" if command[0] == "docker" else active["port"]) if active else legacy
        with source.open() as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            original = source.read_text()
            adapted = json.loads(run(command + ["adapt", "--config", config, "--adapter", "caddyfile"]))
            replacement = PROXY.blue_green_config(original, adapted, expected, upstream, candidate["id"])
            transaction = {"source": str(source), "command": command, "config": config,
                           "before": original, "after": replacement, "candidate": candidate}
            save(pending, transaction)
            try:
                source.write_text(replacement)
                run(command + ["validate", "--config", config, "--adapter", "caddyfile"])
                run(command + ["reload", "--config", config, "--adapter", "caddyfile", "--force"])
                verify(candidate)
                save(state_path, {"active": candidate, "previous": active})
                committed = True
                pending.unlink()
            except Exception:
                if not committed:
                    restore(transaction)
                    if active:
                        verify(active)
                    pending.unlink()
                raise
        print(f"Traffic now serves the verified {color} release.", flush=True)
    except Exception:
        if not committed and not pending.exists():
            compose(directory, "down", "--timeout", "30")
        raise
    # The previous release keeps serving in-flight requests (and stays available
    # for rollback) for a grace period. Its retirement is handed to a detached
    # process on the server so CI does not hold an SSH session for the window.
    try:
        retiring = [active["id"]] if active else []
        if legacy_containers():
            retiring.append(LEGACY)
        schedule_retirement(root, retiring, time.time() + PREVIOUS_RELEASE_GRACE_SECONDS)
        if retire_due(root) is not None:
            spawn_retirement(root, directory)
            print(f"Previous API keeps running for {PREVIOUS_RELEASE_GRACE_SECONDS // 60} minutes; "
                  f"retirement is scheduled on the server ({RETIREMENTS}).", flush=True)
    except (RuntimeError, OSError):
        raise RuntimeError("Previous release retirement could not be scheduled; inspect the rollout before retrying") from None


def legacy_containers():
    legacy = run(["docker", "ps", "-aq", "--filter", "label=com.docker.compose.project=vefacaglar-api",
                  "--filter", "label=com.docker.compose.service=api"]).split()
    if any(not re.fullmatch(r"[a-f0-9]{12,64}", item) for item in legacy):
        raise RuntimeError("Invalid legacy container ID")
    return legacy


def schedule_retirement(root, names, due):
    """Record releases to retire at `due`. The caller holds the deploy lock."""
    path = root / RETIREMENTS
    pending = read(path)
    for name in names:
        pending.setdefault(name, due)
    save(path, pending)


def retire_due(root, now=None):
    """Retire releases whose grace period ended and remove stale release files.

    Idempotent; the caller holds the deploy lock. Decisions use the state at
    run time, so a deployment made during a grace window is never retired:
    only names recorded in the retirement file are stopped, and never the
    active release. Returns the next due time, or None when nothing is pending.
    """
    now = time.time() if now is None else now
    path = root / RETIREMENTS
    pending = read(path)
    state = read(root / ".releases.json")
    active = state.get("active")
    previous = state.get("previous")
    due = sorted(name for name, when in pending.items() if when <= now)
    if due:
        if not active:
            raise RuntimeError("No active release recorded; refusing to retire releases")
        # Never discard the running fallback if the serving release regressed.
        verify(active)
    for name in due:
        if name == LEGACY:
            legacy = legacy_containers()
            if legacy:
                run(["docker", "stop", "--time", "30", *legacy])
                run(["docker", "rm", *legacy])
        elif name != active["id"]:
            old = release_directory(root, {"id": name})
            if (old / "compose.yml").is_file():
                if previous and name == previous["id"]:
                    # Keep the immediate predecessor's files for recovery.
                    compose(old, "stop", "--timeout", "30", "api")
                else:
                    compose(old, "down", "--timeout", "30")
                    shutil.rmtree(old)
        del pending[name]
        save(path, pending)
        print(f"Retired API release {name}.", flush=True)
    keep = {release["id"] for release in (active, previous) if release} | set(pending)
    releases = root / "releases"
    obsolete = [old for old in (releases.iterdir() if releases.is_dir() else [])
                if old.is_dir() and re.fullmatch(r"(?:blue|green)-[0-9]+", old.name)
                and old.name not in keep and (old / "compose.yml").is_file()]
    for old in obsolete:
        compose(old, "down", "--timeout", "30")
        shutil.rmtree(old)
    return min(pending.values()) if pending else None


def spawn_retirement(root, release):
    """Start the detached retirement process from the new release's own copy of
    this script (the incoming bundle is deleted when the SSH session ends)."""
    source = Path(__file__).resolve().parent
    for name in ("blue-green.py", "configure-caddy.py"):
        shutil.copyfile(source / name, release / name)
        (release / name).chmod(0o600)
    environment = {key: value for key, value in os.environ.items() if key != "DOCKER_CONFIG"}
    with (root / "retirement.log").open("a") as log:
        subprocess.Popen(
            [sys.executable, str(release / "blue-green.py"), "--retire", str(root)],
            cwd=root, env=environment, stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT,
            start_new_session=True, close_fds=True,
        )


def retire_loop(root):
    """Detached: wait for each grace period to end, then retire under the deploy lock."""
    print(f"{time.strftime('%Y-%m-%dT%H:%M:%S%z')} retirement process {os.getpid()} started.", flush=True)
    while True:
        with (root / ".deploy.lock").open("w") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            following = retire_due(root)
        if following is None:
            print(f"{time.strftime('%Y-%m-%dT%H:%M:%S%z')} no retirement pending; exiting.", flush=True)
            return
        time.sleep(max(1, min(following - time.time(), 60)))


def main():
    os.umask(0o077)
    if sys.argv[1:2] == ["--retire"]:
        retire_loop(Path(sys.argv[2]))
        return
    root = Path(os.environ["API_DEPLOY_DIR"])
    bundle = Path(sys.argv[2])
    # Convert ordinary cancellation to rollback; SIGKILL/host failure is
    # recovered from the durable transaction record on the next deployment.
    def cancelled(_signal, _frame):
        raise RuntimeError("Deployment interrupted")
    signal.signal(signal.SIGTERM, cancelled)
    signal.signal(signal.SIGINT, cancelled)
    with (root / ".deploy.lock").open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        deploy(root, bundle, sys.argv[1])


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, OSError, ValueError, KeyError) as error:
        sys.exit(str(error))
