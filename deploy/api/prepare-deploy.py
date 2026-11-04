#!/usr/bin/env python3
"""Prepare private API deployment files from GitHub secrets."""

import json
import os
from pathlib import Path
import re
import shutil
import sys


INDIVIDUAL_SECRETS = (
    "DATABASE_URL", "PG_POOL_MAX", "API_URL", "WEB_URL", "AUTH_MODE",
    "OIDC_ISSUER", "OIDC_CLIENT_ID", "REDIS_URL",
    "TYPESENSE_HOST", "TYPESENSE_PORT", "TYPESENSE_PROTOCOL", "TYPESENSE_API_KEY",
    "TYPESENSE_PUBLIC_URL",
    "IMAGEKIT_PRIVATE_KEY", "IMAGEKIT_PUBLIC_KEY", "IMAGEKIT_FOLDER",
    "IGDB_CLIENT_ID", "IGDB_CLIENT_SECRET",
)


def prepare(destination):
    values = {}
    for line in os.environ.get("API_ENV", "").replace("\r\n", "\n").splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        key, separator, value = line.partition("=")
        if not separator or not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key):
            raise ValueError("API_ENV must contain raw NAME=value lines")
        if key in values:
            raise ValueError("API_ENV contains a duplicate setting")
        values[key] = value
    for key in INDIVIDUAL_SECRETS:
        value = os.environ.get(key, "")
        if value:
            if any(character in value for character in ("\r", "\n", "\0")):
                raise ValueError(f"{key} must be a single-line value")
            values[key] = value
    for key in ("DATABASE_URL", "WEB_URL", "AUTH_MODE"):
        if not values.get(key, "").strip():
            raise ValueError(f"Set {key} as a GitHub secret or include it in API_ENV")
    if values["AUTH_MODE"] not in ("oidc", "password"):
        raise ValueError("AUTH_MODE must be oidc or password")
    if values["AUTH_MODE"] == "oidc":
        for key in ("OIDC_ISSUER", "OIDC_CLIENT_ID"):
            if not values.get(key, "").strip():
                raise ValueError(f"AUTH_MODE=oidc requires {key}")
    values.setdefault("API_URL", "https://api2.vefacaglar.com")

    network = os.environ.get("API_DOCKER_NETWORK", "databases_default")
    port = os.environ.get("API_BIND_PORT", "3001")
    image = os.environ.get("API_IMAGE", "")
    actor = os.environ.get("REGISTRY_USER", "")
    if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_.-]*", network):
        raise ValueError("Invalid API_DOCKER_NETWORK")
    if not port.isascii() or not port.isdecimal() or not 1 <= int(port) <= 65535:
        raise ValueError("Invalid API_BIND_PORT")
    if not re.fullmatch(r"ghcr\.io/[a-z0-9._/-]+@sha256:[a-f0-9]{64}", image):
        raise ValueError("Invalid image digest")
    if not re.fullmatch(r"[a-zA-Z0-9_-]+(?:\[bot\])?", actor):
        raise ValueError("Invalid registry user")

    destination.mkdir(mode=0o700, parents=True, exist_ok=False)
    source = Path(__file__).resolve().parent
    for name in ("compose.yml", "deploy.sh", "receive.sh", "configure-caddy.py", "blue-green.py"):
        shutil.copyfile(source / name, destination / name)
        (destination / name).chmod(0o600)
    for name, content in {
        "api.env": "".join(f"{key}={value}\n" for key, value in values.items()),
        ".env": f"API_DOCKER_NETWORK={network}\nAPI_BIND_PORT={port}\n",
        "image": image + "\n",
        "registry-user": actor + "\n",
        "proxy.json": json.dumps({
            "container": os.environ.get("API_CADDY_CONTAINER", ""),
            "config_path": os.environ.get("API_CADDY_CONFIG_PATH", ""),
        }) + "\n",
    }.items():
        path = destination / name
        path.write_text(content, encoding="utf-8")
        path.chmod(0o600)


if __name__ == "__main__":
    try:
        prepare(Path(sys.argv[1]))
    except (ValueError, OSError) as error:
        sys.exit(str(error))
