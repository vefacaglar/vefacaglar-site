#!/usr/bin/env python3
"""Durable admission handover. Retiring workers are never stopped by deployment."""
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
import uuid

MANAGED = "io.vefacaglar.worker.managed"
GENERATION = "io.vefacaglar.worker.generation"
GENERATION_PATTERN = re.compile(r"g[a-f0-9]{20}")


class DeploymentError(RuntimeError):
    pass


def command(args, timeout=30, check=True):
    result = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    if check and result.returncode:
        # Docker output may include configuration or credentials. Log only operation.
        raise DeploymentError("Command failed: " + " ".join(args[:2]))
    return result


def atomic_write(path, value, mode=0o600):
    temporary = path.with_name(path.name + ".tmp-" + uuid.uuid4().hex)
    descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, mode)
    with os.fdopen(descriptor, "w") as stream:
        stream.write(value + "\n")
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, path)
    directory = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(directory)
    finally:
        os.close(directory)


class Docker:
    def inspect(self, container):
        return json.loads(command(["docker", "inspect", container]).stdout)[0]

    def running(self, label):
        return command(["docker", "ps", "--quiet", "--filter", "label=" + label]).stdout.split()

    def all(self, label):
        return command(["docker", "ps", "--all", "--quiet", "--filter", "label=" + label]).stdout.split()

    def compose(self, generation, *args, timeout=210):
        return command(["docker", "compose", "--project-name", "vefacaglar-worker-" + generation.name,
                        "--env-file", str(generation / "compose.env"), "--file",
                        str(generation / "compose.yml"), *args], timeout=timeout)

    def capable(self, image):
        result = command(["docker", "run", "--rm", "--network", "none", "--read-only",
                          "--entrypoint", "/usr/local/bin/worker", image,
                          "--deployment-protocol"], timeout=30, check=False)
        return result.returncode == 0 and result.stdout.strip() == "1"

    def status(self, container):
        result = command(["docker", "exec", container, "/usr/local/bin/worker", "--control-status"],
                         timeout=5, check=False)
        return result.stdout.strip() if result.returncode == 0 else None

    def disable_restart(self, containers):
        if containers:
            command(["docker", "update", "--restart=no", *containers])


class Deployment:
    def __init__(self, bundle, root, docker=None):
        self.bundle = bundle.resolve()
        self.root = root.resolve()
        self.generations = self.root / "generations"
        self.generations.mkdir(mode=0o700, exist_ok=True)
        self.docker = docker or Docker()

    def mode(self, generation, value):
        atomic_write(generation / "control" / "mode", value, 0o644)

    def generation_for(self, container):
        info = self.docker.inspect(container)
        name = info["Config"].get("Labels", {}).get(GENERATION, "")
        if not GENERATION_PATTERN.fullmatch(name):
            raise DeploymentError("Unknown managed generation; refusing handover")
        generation = self.generations / name
        if not generation.is_dir() or generation.is_symlink():
            raise DeploymentError("Managed generation files are missing")
        expected = str(generation / "control")
        if not any(mount.get("Source") == expected and mount.get("Destination") == "/run/worker-control"
                   and not mount.get("RW") for mount in info.get("Mounts", [])):
            raise DeploymentError("Managed worker control mount does not match generation")
        return generation

    def create(self, source, image=None):
        generation = self.generations / ("g" + uuid.uuid4().hex[:20])
        generation.mkdir(mode=0o700)
        for name in ("worker.env", "compose.env", "image"):
            shutil.copyfile(source / name, generation / name)
            (generation / name).chmod(0o600)
        shutil.copyfile(self.bundle / "compose.yml", generation / "compose.yml")
        (generation / "compose.yml").chmod(0o600)
        if image:
            atomic_write(generation / "image", image)
        image = (generation / "image").read_text().strip()
        if not re.fullmatch(r"ghcr\.io/[a-z0-9._/-]+@sha256:[a-f0-9]{64}", image):
            raise DeploymentError("Invalid immutable worker image")
        values = dict(line.split("=", 1) for line in (generation / "compose.env").read_text().splitlines()
                      if "=" in line)
        values.update(WORKER_IMAGE=image, WORKER_GENERATION=generation.name)
        atomic_write(generation / "compose.env", "\n".join(f"{key}={value}" for key, value in values.items()))
        (generation / "control").mkdir(mode=0o755)
        self.mode(generation, "standby")
        return generation

    def members(self, generation):
        return self.docker.running(GENERATION + "=" + generation.name)

    def await_mode(self, containers, mode, timeout=20, allow_exit=False):
        deadline = time.monotonic() + timeout
        pending = set(containers)
        while pending and time.monotonic() < deadline:
            for container in list(pending):
                info = self.docker.inspect(container)
                if not info["State"]["Running"]:
                    if allow_exit and info["State"].get("ExitCode") == 0:
                        pending.remove(container)
                        continue
                    raise DeploymentError("Worker exited before admission acknowledgement")
                if self.docker.status(container) == mode:
                    pending.remove(container)
            if pending:
                time.sleep(0.25)
        if pending:
            raise DeploymentError("Timed out waiting for worker " + mode + " acknowledgement")

    def prepare(self, generation):
        self.docker.compose(generation, "pull", "--quiet")
        if not self.docker.capable((generation / "image").read_text().strip()):
            raise DeploymentError("Worker image does not support deployment protocol 1")
        self.docker.compose(generation, "up", "--detach", "--scale", "worker=2", "--wait", "--wait-timeout", "180")
        containers = self.members(generation)
        if len(containers) != 2:
            raise DeploymentError("Expected two standby workers")
        self.await_mode(containers, "standby")
        return containers

    def drain(self, containers):
        groups = {}
        for container in containers:
            generation = self.generation_for(container)
            groups.setdefault(generation, []).append(container)
        # Disable restart before durable drain: an exited retiree must stay exited.
        for generation, members in groups.items():
            self.docker.disable_restart(members)
            self.mode(generation, "drain")
        for members in groups.values():
            live = [container for container in members if self.docker.inspect(container)["State"]["Running"]]
            self.await_mode(live, "drain", allow_exit=True)

    def drain_previous(self, candidate, containers):
        old = [container for container in self.docker.all(MANAGED + "=1") if container not in containers]
        self.drain(old)
        # A crashed/restarting container may not appear in docker ps. Persist drain
        # for every prior snapshot so it can never restart with active admission.
        for generation in self.generations.iterdir():
            if (generation != candidate and GENERATION_PATTERN.fullmatch(generation.name)
                    and generation.is_dir() and not generation.is_symlink()
                    and (generation / "control").is_dir()):
                self.mode(generation, "drain")

    def legacy(self):
        label = "com.docker.compose.project=vefacaglar-worker"
        running = self.docker.running(label)
        if set(self.docker.all(label)) != set(running):
            raise DeploymentError("Legacy stopped or restarting containers require inspection before handover")
        return running

    def bootstrap_legacy(self, containers):
        if not containers:
            return
        specification = importlib.util.spec_from_file_location("legacy_bootstrap", self.bundle / "legacy-bootstrap.py")
        module = importlib.util.module_from_spec(specification)
        specification.loader.exec_module(module)
        module.retire_idle(containers, self.root / ".legacy-recovery.lock")

    def activate(self, generation, containers):
        self.mode(generation, "active")
        self.await_mode(containers, "active", timeout=30)
        # Readiness was already established in standby; check it after admission too.
        for container in containers:
            info = self.docker.inspect(container)
            if info["State"].get("Health", {}).get("Status") != "healthy":
                raise DeploymentError("New active worker is unhealthy")
        atomic_write(self.root / ".active-generation", generation.name)
        atomic_write(self.root / ".worker-image", (generation / "image").read_text().strip())

    def run(self):
        previous_name = (self.root / ".active-generation").read_text().strip() if (self.root / ".active-generation").exists() else ""
        previous = self.generations / previous_name if GENERATION_PATTERN.fullmatch(previous_name) else None
        candidate = self.create(self.bundle)
        containers = []
        handover = False
        try:
            containers = self.prepare(candidate)
            # Include prior interrupted standby/active generations. Persistently draining
            # generations remain alive until their work finishes, with no time limit.
            self.drain_previous(candidate, containers)
            self.bootstrap_legacy(self.legacy())
            handover = True
            self.activate(candidate, containers)
            print("Worker generation active: " + candidate.name + "; retiring jobs continue in background")
        except Exception:
            # Never stop a candidate: activation may have succeeded before disconnection.
            # Durable drain is safe whether it has zero or one job per process.
            candidates = self.members(candidate)
            try:
                self.drain(candidates)
                if not candidates:
                    self.mode(candidate, "drain")
            except Exception:
                print("Candidate drain could not be acknowledged; durable control files retained", file=sys.stderr)
            if handover and previous and previous.is_dir() and previous != candidate:
                try:
                    rollback = self.create(previous)
                    replacement = self.prepare(rollback)
                    # Remaining candidate processes must acknowledge drain before rollback.
                    self.drain(self.members(candidate))
                    self.activate(rollback, replacement)
                    print("Previous capable image restored as fresh generation: " + rollback.name, file=sys.stderr)
                except Exception:
                    print("Rollback could not be activated; no running job was stopped", file=sys.stderr)
            raise


if __name__ == "__main__":
    try:
        Deployment(Path(sys.argv[1]), Path(sys.argv[2])).run()
    except Exception as error:
        # Do not expose raw subprocess output, environment, URLs or exception parameters.
        print("Worker deployment failed: " + type(error).__name__, file=sys.stderr)
        sys.exit(1)
