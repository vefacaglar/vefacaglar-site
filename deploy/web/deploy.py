#!/usr/bin/env python3
"""Deploy isolated web releases behind an existing persistent Caddy installation."""
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

SPEC = importlib.util.spec_from_file_location("caddy_target", Path(__file__).with_name("caddy-target.py"))
PROXY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PROXY)
NETWORK_SPEC = importlib.util.spec_from_file_location("caddy_network", Path(__file__).with_name("persist-caddy-network.py"))
NETWORK = importlib.util.module_from_spec(NETWORK_SPEC)
NETWORK_SPEC.loader.exec_module(NETWORK)
DOMAINS = ("vefacaglar.com", "www.vefacaglar.com")
BEGIN = "# BEGIN vefacaglar-web managed route"
END = "# END vefacaglar-web managed route"


def run(args, cwd=None):
    result = subprocess.run(args, cwd=cwd, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(f"{args[0]} operation failed during web deployment")
    return result.stdout


def read(path):
    return json.loads(path.read_text()) if path.exists() else {}


def save(path, value):
    temporary = path.with_suffix(".tmp")
    with temporary.open("w") as output:
        json.dump(value, output)
        output.flush()
        os.fsync(output.fileno())
    temporary.chmod(0o600)
    temporary.replace(path)


def compose(directory, *args):
    return run(["docker", "compose", "--env-file", ".env", "-f", "compose.yml", *args], cwd=directory)


def release_directory(root, release):
    if not re.fullmatch(r"(?:blue|green)-[0-9]+", release["id"]):
        raise RuntimeError("Invalid saved release ID")
    return root / "releases" / release["id"]


def routed(config):
    if isinstance(config, dict):
        return any(domain in config.get("host", []) for domain in DOMAINS) or any(routed(value) for value in config.values())
    return isinstance(config, list) and any(routed(value) for value in config)


def caddy_config(original, adapted, upstream, release, expected=None):
    if not re.fullmatch(r"(?:blue|green)-[0-9]+", release):
        raise RuntimeError("Invalid release ID")
    if BEGIN in original or END in original:
        if original.count(BEGIN) != 1 or original.count(END) != 1:
            raise RuntimeError("Invalid managed web route markers")
        before, tail = original.split(BEGIN)
        block, after = tail.split(END)
        if not expected or not re.search(r"(?m)^    reverse_proxy " + re.escape(expected) + r" \{$", block):
            raise RuntimeError("Web upstream differs from the recorded active release")
        # Reject another apex/www route outside the managed block.
        if any(domain in before + after for domain in DOMAINS):
            # Other subdomains are expected; match exact site-address tokens.
            if re.search(r"(?m)^[ \t]*(?:https?://)?(?:www\.)?vefacaglar\.com(?:[ \t,]|$)", before + after):
                raise RuntimeError("Another web route exists outside the managed block")
        original = before.rstrip() + after
    elif routed(adapted) or re.search(r"(?m)^[ \t]*(?:https?://)?(?:www\.)?vefacaglar\.com(?:[ \t,{]|$)", original):
        raise RuntimeError("An unmanaged apex/www route already exists")
    return original.rstrip() + f"\n\n{BEGIN}\n" + """vefacaglar.com {
    encode zstd gzip
    header /health X-Web-Deployment RELEASE
    reverse_proxy UPSTREAM {
        flush_interval -1
        header_up -True-Client-IP
    }
}

www.vefacaglar.com, http://www.vefacaglar.com {
    redir https://vefacaglar.com{uri} 308
}
""".replace("UPSTREAM", upstream).replace("RELEASE", release) + END + "\n"


def verify_origin(port):
    body = run(["curl", "--noproxy", "*", "--fail", "--silent", "--show-error", "--max-time", "15", f"http://{port}/health"])
    if json.loads(body).get("status") != "ok":
        raise RuntimeError("Web liveness response is invalid")
    # Check actual server rendering and API-backed page data paths, not only liveness.
    for path in ("/", "/blog", "/explore", "/explore/games", "/explore/movies", "/dashboard/login", "/robots.txt"):
        run(["curl", "--noproxy", "*", "--fail", "--silent", "--show-error", "--max-time", "30", f"http://{port}{path}"])


def verify_https(release):
    for domain in DOMAINS:
        for attempt in range(30):
            try:
                path = "/health" if domain == DOMAINS[0] else "/health?probe=www"
                response = run(["curl", "--noproxy", "*", "--fail", "--silent", "--show-error", "--max-time", "10",
                                "--resolve", f"{domain}:443:127.0.0.1", "--dump-header", "-", f"https://{domain}{path}"])
                headers, body = response.replace("\r\n", "\n").split("\n\n", 1)
                lines = headers.lower().splitlines()
                status = lines[0].split()[1]
                if domain == DOMAINS[0] and status == "200" and f"x-web-deployment: {release['id']}" in lines and json.loads(body).get("status") == "ok":
                    break
                if domain == DOMAINS[1] and status == "308" and "location: https://vefacaglar.com/health?probe=www" in lines:
                    break
            except (RuntimeError, ValueError, IndexError):
                pass
            if attempt == 29:
                raise RuntimeError("Direct VPS HTTPS check failed or reached a different release")
            time.sleep(2)


def restore(transaction):
    source = Path(transaction["source"])
    if source.read_text() not in (transaction["before"], transaction["after"]):
        raise RuntimeError("Caddy was edited externally; preserving both releases and recovery state")
    source.write_text(transaction["before"])
    for action in ("validate", "reload"):
        run(transaction["command"] + [action, "--config", transaction["config"], "--adapter", "caddyfile"])


def recover(root):
    pending = root / ".pending-release.json"
    transaction = read(pending)
    if not transaction:
        return
    if read(root / ".releases.json").get("active", {}).get("id") != transaction["candidate"]["id"]:
        with Path(transaction["source"]).open() as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            restore(transaction)
        compose(release_directory(root, transaction["candidate"]), "down", "--timeout", "30")
    pending.unlink()
    print("Recovered interrupted web deployment.", flush=True)


def deploy(root, bundle, image):
    if not re.fullmatch(r"ghcr\.io/[a-z0-9._/-]+@sha256:[a-f0-9]{64}", image):
        raise RuntimeError("Invalid image digest")
    recover(root)
    state_path, pending = root / ".releases.json", root / ".pending-release.json"
    state = read(state_path)
    active = state.get("active")
    color = "green" if active and active["id"].startswith("blue-") else "blue"
    candidate = {"id": f"{color}-{time.time_ns()}", "image": image}
    directory = release_directory(root, candidate)
    settings = read(bundle / "settings.json")
    network = dict(line.split("=", 1) for line in (bundle / ".env").read_text().splitlines())["WEB_DOCKER_NETWORK"]
    if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_.-]*", network):
        raise RuntimeError("Invalid web network")
    try:
        run(["docker", "network", "inspect", network])
    except RuntimeError:
        run(["docker", "network", "create", network])
    source, command, config, _ = PROXY.target(settings, network, "3000")
    NETWORK.persist(command, network, root)
    directory.mkdir(parents=True, mode=0o700)
    for name in ("compose.yml", "web.env"):
        shutil.copyfile(bundle / name, directory / name)
        (directory / name).chmod(0o600)
    (directory / ".env").write_text(f"WEB_DOCKER_NETWORK={network}\nWEB_IMAGE={image}\nWEB_RELEASE={candidate['id']}\n")
    (directory / ".env").chmod(0o600)
    committed = False
    try:
        compose(directory, "config", "--quiet")
        compose(directory, "pull", "web")
        compose(directory, "up", "-d", "--wait", "--wait-timeout", "180", "web")
        candidate["port"] = compose(directory, "port", "web", "3000").strip()
        if not re.fullmatch(r"127\.0\.0\.1:[0-9]+", candidate["port"]):
            raise RuntimeError("Web port must bind only to loopback")
        verify_origin(candidate["port"])
        upstream = f"vefacaglar-web-{candidate['id']}:3000" if command[0] == "docker" else candidate["port"]
        expected = (f"vefacaglar-web-{active['id']}:3000" if command[0] == "docker" else active["port"]) if active else None
        with source.open() as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            original = source.read_text()
            adapted = json.loads(run(command + ["adapt", "--config", config, "--adapter", "caddyfile"]))
            replacement = caddy_config(original, adapted, upstream, candidate["id"], expected)
            transaction = {"source": str(source), "command": command, "config": config,
                           "before": original, "after": replacement, "candidate": candidate}
            save(pending, transaction)
            try:
                source.write_text(replacement)
                run(command + ["validate", "--config", config, "--adapter", "caddyfile"])
                run(command + ["reload", "--config", config, "--adapter", "caddyfile"])
                if settings["verify_https"]:
                    verify_https(candidate)
                if active:
                    # Keep the running predecessor until the post-switch grace check passes.
                    time.sleep(30)
                    verify_origin(candidate["port"])
                save(state_path, {"active": candidate, "previous": active, "https_verified": settings["verify_https"]})
                committed = True
                pending.unlink()
            except Exception:
                if not committed:
                    restore(transaction)
                    pending.unlink()
                raise
    except Exception:
        if not committed and not pending.exists():
            compose(directory, "down", "--timeout", "30")
        raise
    print("Web release is healthy and Caddy is configured.", flush=True)
    if not settings["verify_https"]:
        print("DNS cutover is still required; public HTTPS has not been verified.", flush=True)
    if active:
        compose(release_directory(root, active), "stop", "--timeout", "30", "web")
    keep = {candidate["id"]} | ({active["id"]} if active else set())
    for old in (root / "releases").iterdir():
        if old.is_dir() and re.fullmatch(r"(?:blue|green)-[0-9]+", old.name) and old.name not in keep:
            compose(old, "down", "--timeout", "30")
            shutil.rmtree(old)


def main():
    os.umask(0o077)
    bundle = Path(sys.argv[2]).resolve()
    root = bundle.parent
    def cancelled(_signal, _frame):
        raise RuntimeError("Web deployment interrupted")
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
