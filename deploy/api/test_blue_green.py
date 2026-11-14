"""Verify traffic switching and recovery without contacting production services."""

import importlib.util
import json
import os
from pathlib import Path
import tempfile
from contextlib import ExitStack
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
        self.clock = 1_000_000.0

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

    def patched(self, now=None):
        stack = ExitStack()
        stack.enter_context(patch.object(BG.PROXY, "target", return_value=(self.source, ["docker", "exec", "caddy", "caddy"], "/etc/caddy/Caddyfile", "vefacaglar-api:3001")))
        stack.enter_context(patch.object(BG, "compose", side_effect=self.compose))
        stack.enter_context(patch.object(BG, "run", side_effect=self.command))
        stack.enter_context(patch.object(BG, "verify", side_effect=self.verify))
        stack.enter_context(patch.object(BG, "spawn_retirement", side_effect=lambda root, release: self.events.append(("spawn", release.name))))
        stack.enter_context(patch.object(BG.time, "time_ns", return_value=self.counter))
        stack.enter_context(patch.object(BG.time, "time", return_value=self.clock if now is None else now))
        stack.enter_context(patch.object(BG.time, "sleep", side_effect=self.sleep))
        stack.enter_context(patch("builtins.print", side_effect=lambda message, **kwargs: self.events.append(("log", message, kwargs.get("flush", False)))))
        return stack

    def deploy(self):
        self.counter += 1
        with self.patched():
            BG.deploy(self.root, self.bundle, IMAGE)

    def retire(self, now):
        with self.patched(now=now):
            return BG.retire_due(self.root)

    def pending(self):
        return BG.read(self.root / BG.RETIREMENTS)

    def test_first_deploy_then_alternating_releases_retire_previous_after_ten_minutes(self):
        self.deploy()
        state = BG.read(self.root / ".releases.json")
        self.assertEqual(state["active"]["id"], "blue-1")
        self.assertIsNone(state["previous"])
        self.assertNotIn("down", str(self.events))
        self.assertNotIn("spawn", str(self.events))
        self.assertIn("reverse_proxy authserver:5175", self.source.read_text())
        self.assertIn("X-API-Deployment blue-1", self.source.read_text())
        self.assertLess(next(i for i, event in enumerate(self.events) if "up" in event), next(i for i, event in enumerate(self.events) if "reload" in event))
        self.deploy()
        state = BG.read(self.root / ".releases.json")
        self.assertEqual(state["active"]["id"], "green-2")
        self.assertEqual(state["previous"]["id"], "blue-1")
        # The deployment returns right after the switch: no in-process grace wait.
        self.assertFalse([event for event in self.events if event[0] == "sleep"])
        self.assertNotIn(("blue-1", "stop", "--timeout", "30", "api"), self.events)
        self.assertEqual(self.pending(), {"blue-1": self.clock + 600})
        self.assertIn(("spawn", "green-2"), self.events)
        # Before the grace period ends nothing is retired.
        self.events.clear()
        self.assertEqual(self.retire(self.clock + 599), self.clock + 600)
        self.assertNotIn("stop", str(self.events))
        self.assertIsNone(self.retire(self.clock + 600))
        verified = self.events.index(("verify", "green-2"))
        stopped = self.events.index(("blue-1", "stop", "--timeout", "30", "api"))
        self.assertLess(verified, stopped)
        self.assertEqual(self.pending(), {})
        self.assertNotIn(("blue-1", "down", "--timeout", "30"), self.events)
        self.assertTrue(BG.release_directory(self.root, {"id": "blue-1"}).exists())
        # Retirement is idempotent.
        self.events.clear()
        self.assertIsNone(self.retire(self.clock + 900))
        self.assertNotIn("stop", str(self.events))
        self.deploy()
        self.assertIn(("blue-1", "down", "--timeout", "30"), self.events)
        self.assertNotIn(("green-2", "down", "--timeout", "30"), self.events)

    def test_deploy_within_grace_window_never_retires_the_live_release(self):
        self.deploy()
        self.deploy()
        self.clock += 300
        self.deploy()
        state = BG.read(self.root / ".releases.json")
        self.assertEqual(state["active"]["id"], "blue-3")
        self.assertEqual(self.pending(), {"blue-1": self.clock - 300 + 600, "green-2": self.clock + 600})
        self.events.clear()
        self.retire(self.clock + 300)
        # blue-1 is no longer the rollback target: removed; green-2 still in its grace.
        self.assertIn(("blue-1", "down", "--timeout", "30"), self.events)
        self.assertFalse(BG.release_directory(self.root, {"id": "blue-1"}).exists())
        self.assertNotIn("green-2", str(self.events).replace("'verify', 'green-2'", ""))
        self.retire(self.clock + 600)
        self.assertIn(("green-2", "stop", "--timeout", "30", "api"), self.events)
        self.assertNotIn("blue-3", str([event for event in self.events if event[0] != "verify"]))
        self.assertEqual(self.pending(), {})

    def test_overdue_retirement_is_caught_up_by_the_next_deploy(self):
        self.deploy()
        self.deploy()
        self.clock += 3600
        self.events.clear()
        self.deploy()
        self.assertLess(self.events.index(("blue-1", "stop", "--timeout", "30", "api")),
                        next(i for i, event in enumerate(self.events) if "up" in event))

    def test_original_single_container_is_retired_after_the_same_grace_period(self):
        self.legacy = "a" * 12
        self.deploy()
        self.assertEqual(self.pending(), {BG.LEGACY: self.clock + 600})
        self.assertNotIn(("docker", "stop", "--time", "30", self.legacy), self.events)
        self.retire(self.clock + 600)
        self.assertIn(("docker", "stop", "--time", "30", self.legacy), self.events)
        self.assertIn(("docker", "rm", self.legacy), self.events)

    def test_regression_at_end_of_window_keeps_previous_running(self):
        self.deploy()
        self.deploy()
        self.failure = "post-window"
        with self.assertRaisesRegex(RuntimeError, "regressed"):
            self.retire(self.clock + 600)
        self.assertNotIn(("blue-1", "stop", "--timeout", "30", "api"), self.events)
        self.assertIn("blue-1", self.pending())

    def test_stop_failure_is_reported_and_retried_later(self):
        self.deploy()
        self.deploy()
        self.failure = "stop"
        with self.assertRaisesRegex(RuntimeError, "stop failed"):
            self.retire(self.clock + 600)
        self.assertTrue(BG.release_directory(self.root, {"id": "blue-1"}).exists())
        self.assertIn("blue-1", self.pending())

    def test_retirement_process_is_detached_and_uses_release_copy(self):
        release = self.root / "releases" / "green-2"
        release.mkdir(parents=True)
        with patch.object(BG.subprocess, "Popen") as popen, patch.dict(os.environ, {"DOCKER_CONFIG": "/tmp/gone"}):
            BG.spawn_retirement(self.root, release)
        arguments, options = popen.call_args
        self.assertEqual(arguments[0][1:], [str(release / "blue-green.py"), "--retire", str(self.root)])
        self.assertTrue(options["start_new_session"])
        self.assertIs(options["stdin"], BG.subprocess.DEVNULL)
        self.assertNotIn("DOCKER_CONFIG", options["env"])
        self.assertTrue((release / "blue-green.py").is_file())
        self.assertTrue((release / "configure-caddy.py").is_file())

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
