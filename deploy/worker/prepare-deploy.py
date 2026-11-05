#!/usr/bin/env python3
"""Prepare the private worker deployment bundle from GitHub secrets."""

import os
from pathlib import Path
import re
import shutil
import sys


INDIVIDUAL_SECRETS = (
    "DATABASE_URL",
    "IGDB_CLIENT_ID", "IGDB_CLIENT_SECRET",
    "TYPESENSE_HOST", "TYPESENSE_PORT", "TYPESENSE_PROTOCOL", "TYPESENSE_API_KEY",
    "WORKER_ID", "WORKER_DB_POOL_MAX", "RUST_LOG",
    "LOG_TYPESENSE_URL", "LOG_TYPESENSE_API_KEY", "LOG_ENVIRONMENT",
)
REQUIRED = ("DATABASE_URL", "TYPESENSE_HOST", "TYPESENSE_API_KEY")
BUNDLE_FILES = ("compose.yml", "deploy.sh", "receive.sh")


def parse_env(raw):
    values = {}
    for line in raw.replace("\r\n", "\n").splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        key, separator, value = line.partition("=")
        if not separator or not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key):
            raise ValueError("WORKER_ENV must contain raw NAME=value lines")
        if key in values:
            raise ValueError("WORKER_ENV contains a duplicate setting")
        values[key] = value
    return values


def collect(environ):
    values = parse_env(environ.get("WORKER_ENV", ""))
    for key in INDIVIDUAL_SECRETS:
        value = environ.get(key, "")
        if value:
            if any(character in value for character in ("\r", "\n", "\0")):
                raise ValueError(f"{key} must be a single-line value")
            values[key] = value
    for key in REQUIRED:
        if not values.get(key, "").strip():
            raise ValueError(f"Set {key} as a GitHub secret or include it in WORKER_ENV")
    protocol = values.get("TYPESENSE_PROTOCOL", "")
    if protocol and protocol not in ("http", "https"):
        raise ValueError("TYPESENSE_PROTOCOL must be http or https")
    return values


def prepare(destination, environ=os.environ):
    values = collect(environ)
    network = environ.get("WORKER_DOCKER_NETWORK", "") or "databases_default"
    image = environ.get("WORKER_IMAGE", "")
    actor = environ.get("REGISTRY_USER", "")
    if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_.-]*", network):
        raise ValueError("Invalid WORKER_DOCKER_NETWORK")
    if not re.fullmatch(r"ghcr\.io/[a-z0-9._/-]+@sha256:[a-f0-9]{64}", image):
        raise ValueError("Invalid image digest")
    if not re.fullmatch(r"[a-zA-Z0-9_-]+(?:\[bot\])?", actor):
        raise ValueError("Invalid registry user")

    destination.mkdir(mode=0o700, parents=True, exist_ok=False)
    source = Path(__file__).resolve().parent
    for name in BUNDLE_FILES:
        shutil.copyfile(source / name, destination / name)
        (destination / name).chmod(0o600)
    for name, content in {
        "worker.env": "".join(f"{key}={value}\n" for key, value in values.items()),
        "compose.env": f"WORKER_IMAGE={image}\nWORKER_DOCKER_NETWORK={network}\n",
        "image": image + "\n",
        "registry-user": actor + "\n",
    }.items():
        path = destination / name
        path.write_text(content, encoding="utf-8")
        path.chmod(0o600)


if __name__ == "__main__":
    try:
        prepare(Path(sys.argv[1]))
    except (ValueError, OSError) as error:
        sys.exit(str(error))
