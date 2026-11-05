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
    # Keep the immediate predecessor's files for recovery, but stop its process
    # after a bounded overlap instead of retaining a second API indefinitely.
    keep = {candidate["id"]}
    if active:
        keep.add(active["id"])
    obsolete = [path for path in (root / "releases").iterdir()
                if path.is_dir() and re.fullmatch(r"(?:blue|green)-[0-9]+", path.name)
                and path.name not in keep and (path / "compose.yml").is_file()]
    try:
        legacy = run(["docker", "ps", "-aq", "--filter", "label=com.docker.compose.project=vefacaglar-api",
                      "--filter", "label=com.docker.compose.service=api"]).split()
        if any(not re.fullmatch(r"[a-f0-9]{12,64}", item) for item in legacy):
            raise RuntimeError("Invalid legacy container ID")
        if active or legacy:
            print("Keeping the previous API running for 10 minutes before retirement.", flush=True)
            time.sleep(PREVIOUS_RELEASE_GRACE_SECONDS)
            # Never discard the running fallback if the new release regressed.
            verify(candidate)
        if active:
            compose(release_directory(root, active), "stop", "--timeout", "30", "api")
        if legacy:
            run(["docker", "stop", "--time", "30", *legacy])
            run(["docker", "rm", *legacy])
        if obsolete:
            for old in obsolete:
                compose(old, "down", "--timeout", "30")
                shutil.rmtree(old)
    except (RuntimeError, OSError):
        raise RuntimeError("Previous release retirement failed or was interrupted; inspect the rollout before retrying") from None
    print("Previous API stopped; only the active release remains running.", flush=True)


def main():
    os.umask(0o077)
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
