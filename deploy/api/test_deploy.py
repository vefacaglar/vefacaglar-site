"""Exercise secret transfer, SSH setup and deployment recovery without a live VPS."""

import importlib.util
import os
from pathlib import Path
import stat
import subprocess
import tempfile
import unittest
from unittest.mock import patch


SPEC = importlib.util.spec_from_file_location("prepare_deploy", Path(__file__).with_name("prepare-deploy.py"))
PREPARE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PREPARE)
OLD_IMAGE = "ghcr.io/vefacaglar/vefacaglar-site-api@sha256:" + "a" * 64
NEW_IMAGE = "ghcr.io/vefacaglar/vefacaglar-site-api@sha256:" + "b" * 64


class DeployTest(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.bundle = self.root / ".incoming-test"
        self.environment = {
            **dict.fromkeys(PREPARE.INDIVIDUAL_SECRETS, ""),
            "API_ENV": "",
            "DATABASE_URL": "postgres://example/api?sslmode=require",
            "WEB_URL": "https://vefacaglar.com,https://www.vefacaglar.com",
            "AUTH_MODE": "oidc",
            "OIDC_ISSUER": "https://auth.vefacaglar.com",
            "OIDC_CLIENT_ID": "existing-client",
            "API_IMAGE": NEW_IMAGE,
            "API_DOCKER_NETWORK": "existing-network",
            "API_BIND_PORT": "3001",
            "REGISTRY_USER": "vefacaglar",
        }

    def prepare(self):
        with patch.dict(os.environ, self.environment):
            PREPARE.prepare(self.bundle)

    def test_separate_secrets_preserve_raw_values_and_permissions(self):
        self.environment["IMAGEKIT_PRIVATE_KEY"] = "spaces and $dollars='quotes'`literal`"
        self.prepare()
        runtime = (self.bundle / "api.env").read_text()
        self.assertIn("IMAGEKIT_PRIVATE_KEY=spaces and $dollars='quotes'`literal`\n", runtime)
        self.assertIn("API_URL=https://api2.vefacaglar.com\n", runtime)
        self.assertEqual(stat.S_IMODE(self.bundle.stat().st_mode), 0o700)
        for path in self.bundle.iterdir():
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)

    def test_complete_bundle_and_individual_override(self):
        self.environment["API_ENV"] = "DATABASE_URL=postgres://old/db\nREDIS_URL=redis://cache:6379\n"
        self.prepare()
        content = (self.bundle / "api.env").read_text()
        self.assertIn("DATABASE_URL=postgres://example/api?sslmode=require\n", content)
        self.assertEqual(content.count("DATABASE_URL="), 1)
        self.assertIn("REDIS_URL=redis://cache:6379\n", content)

    def test_password_mode_requires_no_oidc_secrets(self):
        self.environment.update(AUTH_MODE="password", OIDC_CLIENT_ID="", OIDC_ISSUER="")
        self.prepare()
        self.assertIn("AUTH_MODE=password\n", (self.bundle / "api.env").read_text())

    def test_rejects_missing_or_invalid_configuration_without_exposing_values(self):
        for key, value in (
            ("DATABASE_URL", ""), ("WEB_URL", ""), ("AUTH_MODE", "unknown"),
            ("OIDC_CLIENT_ID", ""), ("OIDC_ISSUER", ""),
            ("IMAGEKIT_PRIVATE_KEY", "secret\nINJECTED=value"),
            ("API_ENV", "FOO=1\nFOO=2"), ("API_BIND_PORT", "65536"),
            ("API_DOCKER_NETWORK", "network\nBAD=value"),
        ):
            with self.subTest(key=key), patch.dict(os.environ, self.environment | {key: value}):
                with self.assertRaises(ValueError):
                    PREPARE.prepare(self.bundle)
                self.assertFalse(self.bundle.exists())

    def test_receiver_hands_private_bundle_to_blue_green_and_removes_credentials(self):
        self.prepare()
        bindir = self.root / "bin"
        bindir.mkdir()
        (bindir / "python3").write_text('''#!/bin/sh
printf '%s\\n' "$*" > "$TEST_LOG"
''')
        (bindir / "docker").write_text('''#!/usr/bin/env bash
set -eu
if [[ "$1" == login ]]; then
  [[ "$(cat)" == test-registry-token ]]
  printf '%s' "$DOCKER_CONFIG" > "$TEST_CONFIG_PATH"
  echo temporary-token > "$DOCKER_CONFIG/config.json"
fi
''')
        for path in bindir.iterdir():
            path.chmod(0o700)
        environment = os.environ | {
            "PATH": str(bindir) + os.pathsep + os.environ["PATH"],
            "TEST_LOG": str(self.root / "calls"),
            "TEST_CONFIG_PATH": str(self.root / "registry-config-path"),
        }
        result = subprocess.run(["bash", str(self.bundle / "receive.sh")], input="test-registry-token", text=True, capture_output=True, env=environment)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("blue-green.py " + NEW_IMAGE, (self.root / "calls").read_text())
        self.assertFalse(self.bundle.exists())
        self.assertFalse(Path((self.root / "registry-config-path").read_text()).exists())
        self.assertNotIn("test-registry-token", result.stdout + result.stderr)

    def check_ssh_transfer(self, use_key, fail_upload=False):
        bindir = self.root / "ssh-bin"
        bindir.mkdir()
        self.prepare()
        self.bundle.rename(self.root / "vefacaglar-api-bundle")
        if use_key:
            (self.root / "vefacaglar-api-ssh-key").write_text("test-key")
        for command in ("ssh", "scp"):
            (bindir / command).write_text('''#!/usr/bin/env bash
set -eu
printf '%s %s\\n' "$(basename "$0")" "$*" >> "$SSH_TEST_LOG"
if [[ "$0" == */scp && "$FAIL_UPLOAD" == true ]]; then exit 1; fi
if [[ "$*" == *'/receive.sh' ]]; then
  [[ "$(cat)" == ci-registry-token ]]
fi
''')
        (bindir / "sshpass").write_text('''#!/usr/bin/env bash
set -eu
[[ "$1" == -e && "$SSHPASS" == ci-ssh-password ]]
echo sshpass >> "$SSH_TEST_LOG"
shift
exec "$@"
''')
        for path in bindir.iterdir():
            path.chmod(0o700)
        environment = os.environ | {
            "PATH": str(bindir) + os.pathsep + os.environ["PATH"],
            "VPS_HOST": "example.test",
            "VPS_PORT": "22",
            "VPS_USER": "deployer",
            "VPS_PASSWORD": "ci-ssh-password",
            "REGISTRY_TOKEN": "ci-registry-token",
            "DEPLOY_ID": "123-1",
            "RUNNER_TEMP": str(self.root),
            "SSH_TEST_LOG": str(self.root / "ssh-calls"),
            "FAIL_UPLOAD": "true" if fail_upload else "false",
        }
        result = subprocess.run(
            ["bash", str(Path(__file__).with_name("ssh-deploy.sh"))],
            env=environment, capture_output=True, text=True,
        )
        calls = (self.root / "ssh-calls").read_text()
        self.assertIn("rm -rf ~/vefacaglar-api/.incoming-123-1", calls)
        self.assertIn("StrictHostKeyChecking=yes", calls)
        self.assertNotIn("ci-ssh-password", calls + result.stdout + result.stderr)
        self.assertNotIn("ci-registry-token", calls + result.stdout + result.stderr)
        if fail_upload:
            self.assertNotEqual(result.returncode, 0)
            self.assertNotIn("bash ~/vefacaglar-api/.incoming-123-1/receive.sh", calls)
        else:
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("vefacaglar-api-bundle/.env", calls)
            self.assertIn("bash ~/vefacaglar-api/.incoming-123-1/receive.sh", calls)
        if use_key:
            self.assertIn("BatchMode=yes", calls)
            self.assertNotIn("sshpass", calls)
        else:
            self.assertIn("sshpass", calls)

    def test_ssh_password_transfer(self):
        self.check_ssh_transfer(use_key=False)

    def test_ssh_key_transfer(self):
        self.check_ssh_transfer(use_key=True)

    def test_failed_upload_cleans_remote_bundle(self):
        self.check_ssh_transfer(use_key=False, fail_upload=True)


if __name__ == "__main__":
    unittest.main()
