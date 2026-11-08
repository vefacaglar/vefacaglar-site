import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("blue_green", SOURCE / "blue-green.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
IMAGE = "ghcr.io/example/worker@sha256:" + "a" * 64
NEW_IMAGE = "ghcr.io/example/worker@sha256:" + "b" * 64


class Docker:
    def __init__(self):
        self.containers = {}
        self.events = []
        self.fail_prepare = False
        self.fail_active = False
        self.capability = True

    def inspect(self, container):
        return self.containers[container]

    def running(self, label):
        key, value = label.split("=", 1)
        return [name for name, info in self.containers.items()
                if info["State"]["Running"] and info["Config"]["Labels"].get(key) == value]

    def all(self, label):
        key, value = label.split("=", 1)
        return [name for name, info in self.containers.items() if info["Config"]["Labels"].get(key) == value]

    def compose(self, generation, *args, **kwargs):
        self.events.append((args[0], generation.name))
        if args[0] == "up":
            for number in range(2):
                name = generation.name + str(number)
                self.containers[name] = {
                    "Config": {"Labels": {module.MANAGED: "1", module.GENERATION: generation.name}},
                    "Mounts": [{"Source": str(generation / "control"), "Destination": "/run/worker-control", "RW": False}],
                    "State": {"Running": True, "ExitCode": 0, "Health": {"Status": "healthy"}},
                    "generation": generation, "busy": False,
                }
            if self.fail_prepare:
                self.fail_prepare = False
                raise module.DeploymentError("standby failed")

    def capable(self, image):
        self.events.append(("probe", image))
        return self.capability

    def status(self, container):
        info = self.containers[container]
        mode = (info["generation"] / "control" / "mode").read_text().strip()
        self.events.append(("status-" + mode, container))
        if mode == "active" and self.fail_active:
            self.fail_active = False
            info["State"]["Health"]["Status"] = "unhealthy"
        return mode

    def disable_restart(self, containers):
        self.events.append(("restart-no", tuple(containers)))


class DeployTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.bundle = self.root / "bundle"
        self.bundle.mkdir()
        (self.bundle / "worker.env").write_text("DATABASE_URL=unused\n")
        (self.bundle / "compose.env").write_text("WORKER_IMAGE=" + NEW_IMAGE + "\n")
        (self.bundle / "image").write_text(NEW_IMAGE + "\n")
        (self.bundle / "compose.yml").write_text((SOURCE / "compose.yml").read_text())
        self.docker = Docker()
        self.deployment = module.Deployment(self.bundle, self.root, self.docker)

    def old(self):
        generation = self.deployment.create(self.bundle, IMAGE)
        members = self.deployment.prepare(generation)
        self.deployment.activate(generation, members)
        self.docker.events.clear()
        return generation, members

    def test_retiring_busy_workers_keep_running_and_ack_drain_before_activation(self):
        old, members = self.old()
        for member in members:
            self.docker.containers[member]["busy"] = True
        self.deployment.run()
        self.assertEqual((old / "control/mode").read_text().strip(), "drain")
        self.assertTrue(all(self.docker.containers[member]["State"]["Running"] for member in members))
        operations = [event[0] for event in self.docker.events]
        last_drain = max(i for i, operation in enumerate(operations) if operation == "status-drain")
        first_active = operations.index("status-active")
        self.assertLess(last_drain, first_active)
        self.assertFalse(any(operation in ("stop", "kill", "down", "rm") for operation in operations))
        self.assertTrue((old / "worker.env").exists())

    def test_standby_readiness_failure_preserves_old_active_generation(self):
        old, _ = self.old()
        self.docker.fail_prepare = True
        with self.assertRaises(module.DeploymentError):
            self.deployment.run()
        self.assertEqual((old / "control/mode").read_text().strip(), "active")
        self.assertEqual((self.root / ".active-generation").read_text().strip(), old.name)

    def test_capability_failure_never_starts_candidate_or_touches_old(self):
        old, _ = self.old()
        self.docker.capability = False
        with self.assertRaises(module.DeploymentError):
            self.deployment.run()
        self.assertFalse(any(event[0] == "up" for event in self.docker.events))
        self.assertEqual((old / "control/mode").read_text().strip(), "active")

    def test_failed_activation_rolls_back_as_fresh_generation_without_stopping_jobs(self):
        old, members = self.old()
        self.docker.fail_active = True
        with self.assertRaises(module.DeploymentError):
            self.deployment.run()
        restored_name = (self.root / ".active-generation").read_text().strip()
        self.assertNotEqual(restored_name, old.name)
        restored = self.root / "generations" / restored_name
        self.assertEqual((restored / "image").read_text().strip(), IMAGE)
        self.assertEqual((restored / "control/mode").read_text().strip(), "active")
        self.assertTrue(all(self.docker.containers[member]["State"]["Running"] for member in members))
        self.assertEqual((old / "control/mode").read_text().strip(), "drain")

    def test_interrupted_generations_are_drained_before_next_activation(self):
        old, _ = self.old()
        interrupted = self.deployment.create(self.bundle)
        self.deployment.prepare(interrupted)
        self.deployment.mode(old, "drain")
        self.deployment.run()
        self.assertEqual((interrupted / "control/mode").read_text().strip(), "drain")
        current = (self.root / ".active-generation").read_text().strip()
        self.assertEqual((self.root / "generations" / current / "control/mode").read_text().strip(), "active")

    def test_unknown_control_mount_fails_closed(self):
        old, members = self.old()
        self.docker.containers[members[0]]["Mounts"][0]["Source"] = "/unexpected"
        with self.assertRaises(module.DeploymentError):
            self.deployment.run()
        self.assertEqual((old / "control/mode").read_text().strip(), "active")

    def test_crashed_generation_gets_durable_drain_before_it_can_restart(self):
        old, members = self.old()
        for member in members:
            self.docker.containers[member]["State"].update(Running=False, ExitCode=1)
        self.deployment.run()
        self.assertEqual((old / "control/mode").read_text().strip(), "drain")

    def test_generation_configuration_is_private_and_control_is_readable(self):
        generation = self.deployment.create(self.bundle)
        self.assertEqual((generation / "worker.env").stat().st_mode & 0o777, 0o600)
        self.assertEqual((generation / "control/mode").stat().st_mode & 0o777, 0o644)
        self.assertEqual((generation / "control").stat().st_mode & 0o777, 0o755)
        self.assertEqual(generation.stat().st_mode & 0o777, 0o700)
        self.assertIn("WORKER_GENERATION=" + generation.name, (generation / "compose.env").read_text())

    def test_private_deployment_umask_preserves_readable_control_and_private_secrets(self):
        previous = os.umask(0o077)
        try:
            generation = self.deployment.create(self.bundle)
            self.deployment.mode(generation, "active")
        finally:
            os.umask(previous)
        self.assertEqual((generation / "control").stat().st_mode & 0o777, 0o755)
        self.assertEqual((generation / "control/mode").stat().st_mode & 0o777, 0o644)
        self.assertEqual((generation / "worker.env").stat().st_mode & 0o777, 0o600)
        self.assertEqual((generation / "compose.env").stat().st_mode & 0o777, 0o600)
        self.assertEqual(generation.stat().st_mode & 0o777, 0o700)

    def test_failed_generation_control_permissions_are_repaired_before_drain(self):
        generation, members = self.old()
        (generation / "control").chmod(0o700)
        (generation / "control/mode").chmod(0o600)
        previous = os.umask(0o077)
        try:
            self.deployment.drain(members)
        finally:
            os.umask(previous)
        self.assertEqual((generation / "control").stat().st_mode & 0o777, 0o755)
        self.assertEqual((generation / "control/mode").stat().st_mode & 0o777, 0o644)
        self.assertEqual((generation / "control/mode").read_text().strip(), "drain")
        self.assertEqual((generation / "worker.env").stat().st_mode & 0o777, 0o600)

    def test_legacy_is_retired_before_candidate_activation(self):
        self.deployment.legacy = lambda: ["legacy"]
        events = []
        self.deployment.bootstrap_legacy = lambda containers: events.append((containers, len(self.docker.events)))
        self.deployment.run()
        self.assertEqual(events[0][0], ["legacy"])
        self.assertTrue(all(event[0] != "status-active" for event in self.docker.events[:events[0][1]]))

    def test_busy_legacy_leaves_candidate_draining_without_activation(self):
        self.deployment.legacy = lambda: ["legacy"]
        def busy(_):
            raise module.DeploymentError("legacy busy")
        self.deployment.bootstrap_legacy = busy
        with self.assertRaises(module.DeploymentError):
            self.deployment.run()
        self.assertFalse((self.root / ".active-generation").exists())
        self.assertTrue(all((info["generation"] / "control/mode").read_text().strip() == "drain"
                            for info in self.docker.containers.values()))

    def test_stopped_legacy_fails_closed_and_never_activates_rollback(self):
        self.old()
        self.docker.containers["legacy"] = {
            "Config": {"Labels": {"com.docker.compose.project": "vefacaglar-worker"}},
            "State": {"Running": False, "ExitCode": 1},
        }
        with self.assertRaises(module.DeploymentError):
            self.deployment.run()
        self.assertFalse(any(event[0] == "status-active" for event in self.docker.events))


if __name__ == "__main__":
    unittest.main()
