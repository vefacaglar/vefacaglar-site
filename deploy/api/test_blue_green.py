"""Verify traffic switching and recovery without contacting production services."""

import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("blue_green", Path(__file__).with_name("blue-green.py"))
BG = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BG)
IMAGE = "ghcr.io/vefacaglar/api@sha256:" + "a" * 64


def adapted(upstream):
    return {"routes": [{"match": [{"host": [BG.DOMAIN]}], "handle": [
        {"handler": "reverse_proxy", "upstreams": [{"dial": upstream}]}
    ]}]}


class BlueGreenTest(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.bundle = self.root / "bundle"
        self.bundle.mkdir()
        for name in ("compose.yml", "api.env"):
            (self.bundle / name).write_text("private config\n")
        (self.bundle / ".env").write_text("API_DOCKER_NETWORK=backend\nAPI_BIND_PORT=3001\n")
        (self.bundle / "proxy.json").write_text("{}")
        self.source = self.root / "Caddyfile"
        self.original = "auth.vefacaglar.com {\n    reverse_proxy authserver:5175\n}\napi2.vefacaglar.com {\n    reverse_proxy vefacaglar-api:3001\n}\n"
        self.source.write_text(self.original)
        self.events = []
        self.counter = 0
        self.failure = None
        self.legacy = ""

    def compose(self, directory, *args):
        self.events.append((directory.name, *args))
        if self.failure == "container" and args[0] == "up":
            raise RuntimeError("unhealthy candidate")
        if self.failure == "stop" and args[0] == "stop":
            raise RuntimeError("stop failed")
        if args[0] == "port":
            return "127.0.0.1:32001\n"
        return ""

    def command(self, args, cwd=None):
        self.events.append(tuple(args))
        if "adapt" in args:
            # Infer the active target from the file to exercise successive runs.
            upstream = self.source.read_text().split("api2.vefacaglar.com", 1)[1].split("reverse_proxy ", 1)[1].split()[0]
            return json.dumps(adapted(upstream))
        if self.failure == "reload" and "reload" in args:
            raise RuntimeError("reload unavailable")
        if args[:2] == ["docker", "ps"]:
            return self.legacy
        return ""

    def verify(self, release, attempts=12):
        self.events.append(("verify", release["id"]))
        if self.failure == "https" and release["id"] == f"green-{self.counter}":
            raise RuntimeError("wrong HTTPS release")
        if self.failure == "post-window" and self.events.count(("verify", release["id"])) > 1:
            raise RuntimeError("candidate regressed")

    def sleep(self, seconds):
        self.events.append(("sleep", seconds))
        if self.failure == "interrupted":
            raise RuntimeError("deployment interrupted")

    def deploy(self):
        self.counter += 1
        with patch.object(BG.PROXY, "target", return_value=(self.source, ["docker", "exec", "caddy", "caddy"], "/etc/caddy/Caddyfile", "vefacaglar-api:3001")), \
                patch.object(BG, "compose", side_effect=self.compose), \
                patch.object(BG, "run", side_effect=self.command), \
                patch.object(BG, "verify", side_effect=self.verify), \
                patch.object(BG.time, "time_ns", return_value=self.counter), \
                patch.object(BG.time, "sleep", side_effect=self.sleep):
            BG.deploy(self.root, self.bundle, IMAGE)

    def test_first_deploy_then_alternating_releases_stop_previous_after_ten_minutes(self):
        self.deploy()
        state = BG.read(self.root / ".releases.json")
        self.assertEqual(state["active"]["id"], "blue-1")
        self.assertIsNone(state["previous"])
        self.assertNotIn("down", str(self.events))
        self.assertIn("reverse_proxy authserver:5175", self.source.read_text())
        self.assertIn("X-API-Deployment blue-1", self.source.read_text())
        self.assertLess(next(i for i, event in enumerate(self.events) if "up" in event), next(i for i, event in enumerate(self.events) if "reload" in event))
        self.deploy()
        state = BG.read(self.root / ".releases.json")
        self.assertEqual(state["active"]["id"], "green-2")
        self.assertEqual(state["previous"]["id"], "blue-1")
        self.assertIn(("sleep", 600), self.events)
        stopped = self.events.index(("blue-1", "stop", "--timeout", "30", "api"))
        self.assertLess(self.events.index(("sleep", 600)), stopped)
        verified = [index for index, event in enumerate(self.events) if event == ("verify", "green-2")]
        self.assertEqual(len(verified), 2)
        self.assertLess(self.events.index(("sleep", 600)), verified[-1])
        self.assertLess(verified[-1], stopped)
        self.assertNotIn(("blue-1", "down", "--timeout", "30"), self.events)
        self.deploy()
        self.assertIn(("blue-1", "down", "--timeout", "30"), self.events)
        self.assertNotIn(("green-2", "down", "--timeout", "30"), self.events)

    def test_original_single_container_is_retired_after_the_same_grace_period(self):
        self.legacy = "a" * 12
        self.deploy()
        self.assertLess(self.events.index(("sleep", 600)), self.events.index(("docker", "stop", "--time", "30", self.legacy)))
        self.assertIn(("docker", "rm", self.legacy), self.events)

    def test_regression_at_end_of_window_keeps_previous_running(self):
        self.deploy()
        self.events.clear()
        self.failure = "post-window"
        with self.assertRaisesRegex(RuntimeError, "retirement failed"):
            self.deploy()
        self.assertNotIn(("blue-1", "stop", "--timeout", "30", "api"), self.events)
        self.assertEqual(BG.read(self.root / ".releases.json")["active"]["id"], "green-2")

    def test_interruption_during_grace_period_keeps_previous_running(self):
        self.deploy()
        self.events.clear()
        self.failure = "interrupted"
        with self.assertRaisesRegex(RuntimeError, "retirement failed"):
            self.deploy()
        self.assertNotIn(("blue-1", "stop", "--timeout", "30", "api"), self.events)

    def test_stop_failure_is_reported_instead_of_silently_succeeding(self):
        self.deploy()
        self.failure = "stop"
        with self.assertRaisesRegex(RuntimeError, "retirement failed"):
            self.deploy()
        self.assertTrue(BG.release_directory(self.root, {"id": "blue-1"}).exists())

    def test_unhealthy_candidate_never_changes_traffic(self):
        self.failure = "container"
        with self.assertRaises(RuntimeError):
            self.deploy()
        self.assertEqual(self.source.read_text(), self.original)
        self.assertFalse((self.root / ".releases.json").exists())
        self.assertIn(("blue-1", "down", "--timeout", "30"), self.events)
        self.assertNotIn("reload", str(self.events))

    def test_https_failure_restores_active_route_without_restarting_active(self):
        self.deploy()
        previous = self.source.read_text()
        self.events.clear()
        self.failure = "https"
        with self.assertRaisesRegex(RuntimeError, "wrong HTTPS"):
            self.deploy()
        self.assertEqual(self.source.read_text(), previous)
        self.assertEqual(BG.read(self.root / ".releases.json")["active"]["id"], "blue-1")
        self.assertIn(("verify", "blue-1"), self.events)
        self.assertIn(("green-2", "down", "--timeout", "30"), self.events)
        self.assertNotIn(("blue-1", "down", "--timeout", "30"), self.events)
        self.assertFalse((self.root / ".pending-release.json").exists())

    def test_uncertain_reload_keeps_both_containers_and_recovery_record(self):
        self.deploy()
        self.failure = "reload"
        with self.assertRaises(RuntimeError):
            self.deploy()
        self.assertTrue((self.root / ".pending-release.json").exists())
        self.assertNotIn(("green-2", "down", "--timeout", "30"), self.events)
        self.failure = None
        self.deploy()
        self.assertFalse((self.root / ".pending-release.json").exists())
        self.assertIn(("green-2", "down", "--timeout", "30"), self.events)
        self.assertEqual(BG.read(self.root / ".releases.json")["active"]["id"], "green-3")

    def test_interrupted_switch_recovers_before_starting_another_candidate(self):
        self.deploy()
        before = self.source.read_text()
        after = before.replace("blue-1", "green-9")
        release = {"id": "green-9", "image": IMAGE}
        directory = BG.release_directory(self.root, release)
        directory.mkdir()
        BG.save(self.root / ".pending-release.json", {"source": str(self.source), "command": ["caddy"], "config": str(self.source), "before": before, "after": after, "candidate": release})
        self.source.write_text(after)
        self.events.clear()
        self.deploy()
        self.assertLess(self.events.index(("green-9", "down", "--timeout", "30")), next(i for i, event in enumerate(self.events) if "up" in event))

    def test_restore_refuses_to_overwrite_unrelated_concurrent_edits(self):
        transaction = {"source": str(self.source), "before": "old", "after": "new"}
        with self.assertRaisesRegex(RuntimeError, "Caddy changed"):
            BG.restore(transaction)
        self.assertEqual(self.source.read_text(), self.original)

    def test_https_check_requires_correct_release_and_valid_tls(self):
        release = {"id": "blue-1"}
        with patch.object(BG, "run", return_value='HTTP/2 200\r\nx-api-deployment: blue-1\r\n\r\n{"status":"ok"}') as run:
            BG.verify(release, attempts=1)
            self.assertIn("--resolve", run.call_args.args[0])
            self.assertNotIn("--insecure", run.call_args.args[0])
        with patch.object(BG, "run", return_value='HTTP/2 200\nx-api-deployment: green-2\n\n{"status":"ok"}'):
            with self.assertRaises(RuntimeError):
                BG.verify(release, attempts=1)

    def test_only_api_site_is_adopted_and_custom_directives_are_preserved(self):
        original = self.original.replace("    reverse_proxy vefacaglar-api:3001", '    header X-Custom "literal } brace"\n    # ignored } brace\n    reverse_proxy vefacaglar-api:3001')
        result = BG.PROXY.blue_green_config(original, adapted("vefacaglar-api:3001"), "vefacaglar-api:3001", "vefacaglar-api-blue-1:3001", "blue-1")
        self.assertIn('header X-Custom "literal } brace"', result)
        self.assertIn("reverse_proxy authserver:5175", result)
        self.assertIn("reverse_proxy vefacaglar-api-blue-1:3001", result)
        changed = BG.PROXY.blue_green_config(result, adapted("vefacaglar-api-blue-1:3001"), "vefacaglar-api-blue-1:3001", "vefacaglar-api-green-2:3001", "green-2")
        self.assertEqual(changed.count("X-API-Deployment"), 1)

    def test_wrong_upstream_and_imported_routes_are_rejected(self):
        for text, config in ((self.original, adapted("unknown:3001")), ("import sites/*", adapted("vefacaglar-api:3001"))):
            with self.assertRaises(RuntimeError):
                BG.PROXY.blue_green_config(text, config, "vefacaglar-api:3001", "vefacaglar-api-blue-1:3001", "blue-1")


if __name__ == "__main__":
    unittest.main()
