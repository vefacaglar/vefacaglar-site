#!/usr/bin/env python3
"""Add the API route to an existing persistent Caddyfile and reload safely."""

import fcntl
import json
import os
import re
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import sys
import tempfile


DOMAIN = "api2.vefacaglar.com"
BEGIN = "# BEGIN vefacaglar-api managed route"
END = "# END vefacaglar-api managed route"


def run(arguments):
    result = subprocess.run(arguments, capture_output=True, text=True)
    if result.returncode:
        # Caddy configuration/diagnostics may contain other applications' secrets.
        raise RuntimeError(f"{arguments[0]} command failed while configuring Caddy")
    return result.stdout


def routed(config):
    if isinstance(config, dict):
        if DOMAIN in config.get("host", []):
            return True
        return any(routed(value) for value in config.values())
    if isinstance(config, list):
        return any(routed(value) for value in config)
    return False


def existing_route_matches(config, upstream):
    routes = []

    def find_routes(value):
        if isinstance(value, dict):
            if any(DOMAIN in matcher.get("host", []) for matcher in value.get("match", [])):
                routes.append(value)
            else:
                for item in value.values():
                    find_routes(item)
        elif isinstance(value, list):
            for item in value:
                find_routes(item)

    def upstreams(value):
        found = []
        if isinstance(value, dict):
            if value.get("handler") == "reverse_proxy":
                found.extend(item.get("dial") for item in value.get("upstreams", []))
            for item in value.values():
                found.extend(upstreams(item))
        elif isinstance(value, list):
            for item in value:
                found.extend(upstreams(item))
        return found

    find_routes(config)
    return bool(routes) and all(set(upstreams(route)) == {upstream} for route in routes)


def updated_config(original, upstream, already_routed):
    if BEGIN in original or END in original:
        if original.count(BEGIN) != 1 or original.count(END) != 1:
            raise RuntimeError("Invalid vefacaglar-api managed-route markers")
        before, tail = original.split(BEGIN, 1)
        if END not in tail:
            raise RuntimeError("Invalid vefacaglar-api managed-route marker order")
        _, after = tail.split(END, 1)
        original = before.rstrip() + after
    elif already_routed or DOMAIN in original:
        raise RuntimeError("An unmanaged API route already exists; refusing to overwrite it")
    return original.rstrip() + "\n\n" + f"""{BEGIN}
{DOMAIN} {{
    reverse_proxy {upstream} {{
        header_up -True-Client-IP
        header_up X-Real-IP {{remote_host}}
        header_up X-Forwarded-For {{remote_host}}
    }}
}}
{END}
"""


def blue_green_config(original, adapted, expected, upstream, release):
    """Adopt only one explicit API site, preserving its other directives."""
    if not re.fullmatch(r"(?:blue|green)-[0-9]+", release):
        raise RuntimeError("Invalid release marker")
    if not routed(adapted):
        if DOMAIN in original or BEGIN in original or END in original:
            raise RuntimeError("Ambiguous existing API configuration")
        result = updated_config(original, upstream, False)
        return result.replace(DOMAIN + " {", DOMAIN + " {\n    header /health X-API-Deployment " + release, 1)
    if not existing_route_matches(adapted, expected):
        raise RuntimeError("API upstream differs from the recorded active release")
    # Imports, multi-site blocks and inline blocks require explicit migration;
    # do not rewrite unrelated sites by replacing an upstream globally.
    headers = list(re.finditer(r"(?m)^" + re.escape(DOMAIN) + r"[ \t]*\{[ \t]*$", original))
    if len(headers) != 1:
        raise RuntimeError("API route must be a single explicit multiline site block")
    begin = headers[0].start()
    opening = original.index("{", begin)
    depth, quote, comment, escaped = 0, None, False, False
    end = None
    for index in range(opening, len(original)):
        char = original[index]
        if comment:
            if char == "\n":
                comment = False
            continue
        if quote:
            if escaped:
                escaped = False
            elif char == "\\" and quote == '"':
                escaped = True
            elif char == quote:
                quote = None
            continue
        if char == "#":
            comment = True
        elif char in ('"', "`"):
            quote = char
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                end = index + 1
                break
    if end is None:
        raise RuntimeError("Unbalanced API site block")
    block = original[begin:end]
    proxy = r"(?m)^([ \t]+reverse_proxy[ \t]+)" + re.escape(expected) + r"(?=[ \t]*(?:\{|$))"
    block, count = re.subn(proxy, lambda match: match[1] + upstream, block)
    if count != 1:
        raise RuntimeError("API route must contain exactly one static reverse_proxy upstream")
    marker = r"(?m)^[ \t]*header /health X-API-Deployment [^\n]*\n"
    block = re.sub(marker, "", block)
    block = block.replace(DOMAIN + " {", DOMAIN + " {\n    header /health X-API-Deployment " + release, 1)
    if "X-API-Deployment " + release not in block:
        # Normalize only the site header if it used multiple spaces or tabs.
        block = re.sub(r"^" + re.escape(DOMAIN) + r"[ \t]*\{", DOMAIN + " {\n    header /health X-API-Deployment " + release, block, count=1)
    return original[:begin] + block + original[end:]


def mounted_config(mounts, config):
    target = PurePosixPath(config)
    if not target.is_absolute() or ".." in target.parts:
        raise RuntimeError("Caddy must use an absolute configuration path")
    matches = []
    for mount in mounts:
        try:
            relative = target.relative_to(mount["Destination"])
        except ValueError:
            continue
        matches.append((len(mount["Destination"]), Path(mount["Source"]) / str(relative)))
    if not matches:
        raise RuntimeError("Caddyfile is not on a persistent mount; refusing an ephemeral edit")
    return max(matches, key=lambda item: item[0])[1]


def target(settings, network, port):
    rows = run(["docker", "ps", "--format", "{{.ID}}\t{{.Image}}\t{{.Names}}"]).splitlines()
    containers = [row.split("\t") for row in rows if row.strip()]
    requested = settings.get("container", "")
    candidates = [row for row in containers if (
        requested in (row[0], row[2]) if requested else "caddy" in row[1].lower()
    )]
    if len(candidates) > 1:
        raise RuntimeError("Multiple Caddy containers found; set API_CADDY_CONTAINER in GitHub variables")
    if candidates:
        container, image, _ = candidates[0]
        if "docker-proxy" in image:
            raise RuntimeError("Caddy Docker Proxy uses generated configuration; this setup requires a Caddyfile")
        arguments = json.loads(run(["docker", "inspect", "--format", "{{json .Config.Cmd}}", container])) or []
        config = settings.get("config_path") or "/etc/caddy/Caddyfile"
        if "--resume" in arguments:
            raise RuntimeError("Caddy runs with --resume; refusing to edit an unused Caddyfile")
        if "--watch" in arguments or "-w" in arguments:
            raise RuntimeError("Caddy watches its config; refusing to write before explicit validation")
        if not settings.get("config_path"):
            for index, value in enumerate(arguments):
                if value in ("--config", "-c") and index + 1 < len(arguments):
                    config = arguments[index + 1]
                elif value.startswith("--config="):
                    config = value.partition("=")[2]
        mounts = json.loads(run(["docker", "inspect", "--format", "{{json .Mounts}}", container]))
        source = mounted_config(mounts, config)
        networks = json.loads(run(["docker", "inspect", "--format", "{{json .NetworkSettings.Networks}}", container]))
        if network not in networks:
            run(["docker", "network", "connect", network, container])
        return source, ["docker", "exec", container, "caddy"], config, "vefacaglar-api:3001"
    if requested:
        raise RuntimeError("The configured Caddy container is not running")
    binary = shutil.which("caddy")
    config = settings.get("config_path") or "/etc/caddy/Caddyfile"
    if not binary or not Path(config).is_file():
        raise RuntimeError("No supported running Caddy installation found")
    run(["systemctl", "is-active", "--quiet", "caddy"])
    return Path(config), [binary], config, f"127.0.0.1:{port}"


def apply_config(source, command, config, upstream, backup_directory):
    original = source.read_text()
    adapted = json.loads(run(command + ["adapt", "--config", config, "--adapter", "caddyfile"]))
    if BEGIN not in original and END not in original and existing_route_matches(adapted, upstream):
        print("Existing API route already targets this service; preserving the Caddyfile.")
        return
    replacement = updated_config(original, upstream, routed(adapted))
    directory = Path(tempfile.mkdtemp(prefix=".caddy-backup-", dir=backup_directory))
    keep_backup = False
    try:
        backup = directory / "Caddyfile"
        backup.write_text(original)
        backup.chmod(0o600)
        try:
            # Preserve the inode: Caddy may have the file itself bind-mounted.
            source.write_text(replacement)
            run(command + ["validate", "--config", config, "--adapter", "caddyfile"])
            run(command + ["reload", "--config", config, "--adapter", "caddyfile", "--force"])
        except (RuntimeError, OSError):
            try:
                source.write_text(original)
            except OSError:
                keep_backup = True
                raise RuntimeError(f"Could not restore Caddyfile; original retained at {backup}") from None
            raise RuntimeError("Caddy validation/reload failed; the original Caddyfile was restored") from None
    finally:
        if not keep_backup:
            shutil.rmtree(directory)
    print("Caddy API route configured; automatic HTTPS is enabled.")


def main():
    os.umask(0o077)
    bundle = Path(__file__).resolve().parent
    directory = Path(os.environ["API_DEPLOY_DIR"])
    settings = json.loads((bundle / "proxy.json").read_text())
    values = dict(line.split("=", 1) for line in (directory / ".env").read_text().splitlines())
    with (directory / ".proxy.lock").open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        source, command, config, upstream = target(
            settings, values["API_DOCKER_NETWORK"], values["API_BIND_PORT"]
        )
        if not source.is_file():
            raise RuntimeError("The persistent Caddyfile was not found")
        apply_config(source, command, config, upstream, directory)


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, OSError, ValueError, KeyError) as error:
        sys.exit(str(error))
