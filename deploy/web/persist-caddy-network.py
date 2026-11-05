#!/usr/bin/env python3
"""Persist the web network in a conventional Compose-managed Caddy service."""
import fcntl
import json
from pathlib import Path
import re
import subprocess


def run(args):
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError("Could not validate persistent Caddy network configuration")
    return result.stdout


def persist(command, network, backup_directory):
    if command[0] != 'docker':
        return
    labels = json.loads(run(['docker', 'inspect', '--format', '{{json .Config.Labels}}', command[2]]))
    config = labels.get('com.docker.compose.project.config_files', '')
    service = labels.get('com.docker.compose.service', '')
    if not config or ',' in config or not service:
        raise RuntimeError('Caddy must use one persistent Compose file for automatic web-network setup')
    source = Path(config)
    if not source.is_absolute() or not source.is_file():
        raise RuntimeError('Caddy Compose file is unavailable')
    args = ['docker', 'compose', '-f', str(source), 'config', '--format', 'json']
    with source.open() as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        current = json.loads(run(args))
        networks = current.get('services', {}).get(service, {}).get('networks', {})
        definition = current.get('networks', {}).get(network, {})
        if network in networks and definition.get('external') and definition.get('name') == network:
            return
        original = source.read_text()
        # Adopt the existing implicit default network without rewriting YAML or
        # dropping access to the API/Typesense hosts already served by Caddy.
        header = re.search(r'(?m)^  ' + re.escape(service) + r':[ \t]*(?:#.*)?$', original)
        if not header or re.search(r'(?m)^networks:', original):
            raise RuntimeError('Caddy Compose networking needs explicit migration; no file was changed')
        end = re.search(r'(?m)^(?:  [A-Za-z0-9_-]+:|[A-Za-z0-9_-]+:)', original[header.end():])
        block = original[header.end():header.end() + end.start()] if end else original[header.end():]
        if re.search(r'(?m)^    networks:', block) or set(networks) != {'default'}:
            raise RuntimeError('Caddy has custom networking; refusing to replace it')
        replacement = original[:header.end()] + f'\n    networks:\n      default: {{}}\n      {network}: {{}}' + original[header.end():]
        replacement = replacement.rstrip() + f'\n\nnetworks:\n  {network}:\n    external: true\n    name: {network}\n'
        backup = backup_directory / '.caddy-compose-backup.yaml'
        if not backup.exists():
            backup.write_text(original)
            backup.chmod(0o600)
        try:
            source.write_text(replacement)
            candidate = json.loads(run(args))
            if set(candidate['services'][service]['networks']) != {'default', network}:
                raise RuntimeError('Caddy network validation failed')
        except Exception:
            source.write_text(original)
            raise
    print('Persisted the isolated web network for future Caddy recreations.', flush=True)
