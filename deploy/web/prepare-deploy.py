#!/usr/bin/env python3
"""Prepare a private web deployment bundle without evaluating env values."""
import json
import os
from pathlib import Path
import re
import shutil
import sys

KEYS = ("API_URL", "AUTH_MODE", "OIDC_ISSUER", "OIDC_CLIENT_ID")


def prepare(destination):
    values = {}
    for line in os.environ.get("WEB_ENV", "").replace("\r\n", "\n").splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        key, separator, value = line.partition("=")
        if not separator or not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key) or key in values or "\0" in value:
            raise ValueError("WEB_ENV must contain unique raw NAME=value lines")
        if key not in KEYS:
            raise ValueError("WEB_ENV contains an unsupported web runtime setting")
        values[key] = value
    for key in KEYS:
        value = os.environ.get(key, "")
        if value:
            if any(char in value for char in ("\r", "\n", "\0")):
                raise ValueError(f"{key} must be a single-line value")
            values[key] = value
    values.setdefault("API_URL", "https://api2.vefacaglar.com")
    if values.get("AUTH_MODE") not in ("oidc", "password"):
        raise ValueError("Set AUTH_MODE as an existing GitHub secret or in WEB_ENV")
    if values["AUTH_MODE"] == "oidc" and any(not values.get(key) for key in ("OIDC_ISSUER", "OIDC_CLIENT_ID")):
        raise ValueError("OIDC mode requires OIDC_ISSUER and OIDC_CLIENT_ID")
    public = {
        "NEXT_PUBLIC_API_URL": os.environ.get("NEXT_PUBLIC_API_URL") or "https://api2.vefacaglar.com",
        "NEXT_PUBLIC_SITE_URL": os.environ.get("NEXT_PUBLIC_SITE_URL") or "https://vefacaglar.com",
    }
    for value in [values["API_URL"], *public.values()]:
        if not re.fullmatch(r"https?://[a-zA-Z0-9.-]+(?::[0-9]+)?", value):
            raise ValueError("Web URLs must be absolute HTTP(S) origins without trailing slashes")
    values.update(public)
    network = os.environ.get("WEB_DOCKER_NETWORK") or "vefacaglar-web"
    image = os.environ.get("WEB_IMAGE", "")
    actor = os.environ.get("REGISTRY_USER", "")
    if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_.-]*", network):
        raise ValueError("Invalid WEB_DOCKER_NETWORK")
    if not re.fullmatch(r"ghcr\.io/[a-z0-9._/-]+@sha256:[a-f0-9]{64}", image):
        raise ValueError("Invalid image digest")
    if not re.fullmatch(r"[a-zA-Z0-9_-]+(?:\[bot\])?", actor):
        raise ValueError("Invalid registry user")
    destination.mkdir(mode=0o700, parents=True, exist_ok=False)
    source = Path(__file__).resolve().parent
    for name in ("compose.yml", "deploy.py", "receive.sh", "persist-caddy-network.py"):
        shutil.copyfile(source / name, destination / name)
    # Use the same conservative persistent-Caddy detection as API CD.
    shutil.copyfile(source.parent / "api/configure-caddy.py", destination / "caddy-target.py")
    files = {
        "web.env": "".join(f"{key}={value}\n" for key, value in values.items()),
        ".env": f"WEB_DOCKER_NETWORK={network}\n",
        "image": image + "\n",
        "registry-user": actor + "\n",
        "settings.json": json.dumps({
            "container": os.environ.get("WEB_CADDY_CONTAINER", ""),
            "config_path": os.environ.get("WEB_CADDY_CONFIG_PATH", ""),
            "verify_https": os.environ.get("WEB_VERIFY_HTTPS", "true") == "true",
        }) + "\n",
    }
    for name, content in files.items():
        (destination / name).write_text(content, encoding="utf-8")
    for path in destination.iterdir():
        path.chmod(0o600)


if __name__ == "__main__":
    try:
        prepare(Path(sys.argv[1]))
    except (ValueError, OSError) as error:
        sys.exit(str(error))
