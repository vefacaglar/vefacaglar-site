#!/usr/bin/env python3
"""One-time retirement of idle legacy workers which cannot acknowledge drain.

Only direct container-to-Postgres sessions are supported. Every freeze is bounded
by an independent host watchdog; active jobs always cause immediate unfreezing.
"""
import contextlib
import fcntl
import ipaddress
import json
import os
from pathlib import Path
import re
import selectors
import signal
import subprocess
import sys
import tempfile
import time
from urllib.parse import unquote, urlsplit
import uuid


class UnsafeBootstrap(RuntimeError):
    pass


def run(args, timeout=10):
    result = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    if result.returncode:
        raise UnsafeBootstrap("Host metadata command failed")
    return result.stdout


def inspect(container):
    return json.loads(run(["docker", "inspect", container]))[0]


def address(value):
    raw = value.strip("[]").split("%")[0].split("/")[0]
    parsed = ipaddress.ip_address(raw)
    return str(getattr(parsed, "ipv4_mapped", None) or parsed)


def endpoint(value):
    host, port = value.rsplit(":", 1)
    return address(host), int(port)


def literal(value):
    return "'" + str(value).replace("'", "''") + "'"


class Psql:
    """Keep the SHARE fence and all audited SQL on the same administrator session."""
    def __init__(self, database):
        self.process = subprocess.Popen(
            ["docker", "exec", "--interactive", "--user", "postgres", database["container"],
             "psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-U",
             database["administrator"], "-d", database["name"]],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
        )
        self.selector = selectors.DefaultSelector()
        self.selector.register(self.process.stdout, selectors.EVENT_READ)
        self.buffer = b""

    def query(self, sql, timeout=3):
        marker = "fence_" + uuid.uuid4().hex
        self.process.stdin.write((sql + ";\n\\echo " + marker + "\n").encode())
        self.process.stdin.flush()
        deadline = time.monotonic() + timeout
        lines = []
        while time.monotonic() < deadline:
            while b"\n" in self.buffer:
                raw, self.buffer = self.buffer.split(b"\n", 1)
                line = raw.decode().strip()
                if line == marker:
                    return lines
                if line:
                    lines.append(line)
            ready = self.selector.select(max(0, deadline - time.monotonic()))
            if ready:
                chunk = os.read(self.process.stdout.fileno(), 65536)
                if not chunk:
                    raise UnsafeBootstrap("Postgres fence session ended")
                self.buffer += chunk
        raise UnsafeBootstrap("Postgres fence operation timed out")

    def json(self, sql):
        return [json.loads(line) for line in self.query(sql)]

    def close(self):
        # EOF rolls back/releases the fence even after an exception or lost SSH.
        self.process.stdin.close()
        try:
            self.process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            self.process.kill()
            self.process.wait(timeout=3)
        self.selector.close()
        self.process.stdout.close()


def preflight(containers):
    postgres = []
    for candidate in run(["docker", "ps", "--quiet"]).split():
        info = inspect(candidate)
        image = info["Config"]["Image"].lower()
        if "postgres" in image:
            postgres.append((info["Id"], {address(network["IPAddress"])
                             for network in info["NetworkSettings"]["Networks"].values()
                             if network.get("IPAddress")}))
    workers = []
    database = None
    for container in containers:
        info = inspect(container)
        if not info["State"]["Running"] or info["State"]["Paused"]:
            raise UnsafeBootstrap("Legacy worker is not running normally")
        environment = dict(line.split("=", 1) for line in info["Config"]["Env"] if "=" in line)
        parsed = urlsplit(environment.get("DATABASE_URL", ""))
        if not parsed.hostname or not parsed.path.lstrip("/"):
            raise UnsafeBootstrap("Legacy database endpoint is missing")
        resolved = {address(line.split()[0]) for line in run(
            ["docker", "exec", container, "getent", "ahostsv4", parsed.hostname]).splitlines() if line.split()}
        direct = [candidate for candidate, ips in postgres if ips & resolved]
        if len(direct) != 1 or parsed.port not in (None, 5432):
            raise UnsafeBootstrap("Database is not proven to be direct container Postgres")
        target = {"container": direct[0], "name": unquote(parsed.path.lstrip("/"))}
        if database and any(database[key] != target[key] for key in target):
            raise UnsafeBootstrap("Legacy workers use different databases")
        database = target
        ips = {address(network["IPAddress"]) for network in info["NetworkSettings"]["Networks"].values()
               if network.get("IPAddress")}
        if not ips or resolved & ips:
            raise UnsafeBootstrap("Legacy network ownership is ambiguous")
        workers.append({"id": info["Id"], "pid": info["State"]["Pid"],
                        "hostname": info["Config"]["Hostname"], "fixed_id": environment.get("WORKER_ID"),
                        "ips": ips, "database_ips": resolved, "port": parsed.port or 5432})
    database["administrator"] = run(["docker", "exec", database["container"], "sh", "-c",
                                     'printf %s "${POSTGRES_USER:-postgres}"']).strip()
    return workers, database


def assert_frozen(worker):
    info = inspect(worker["id"])
    ips = {address(network["IPAddress"]) for network in info["NetworkSettings"]["Networks"].values()
           if network.get("IPAddress")}
    if (not info["State"]["Running"] or not info["State"]["Paused"]
            or info["State"]["Pid"] != worker["pid"] or ips != worker["ips"]):
        raise UnsafeBootstrap("Legacy worker changed or freeze expired")


def audit(workers, database, fence):
    fence.query("SELECT pg_stat_clear_snapshot()")
    sessions = fence.json("SELECT json_build_object('pid',pid,'backend_start',backend_start," 
                          "'address',client_addr::text,'port',client_port,'database',datname) "
                          "FROM pg_stat_activity WHERE backend_type='client backend' AND client_addr IS NOT NULL")
    owned = []
    worker_ids = []
    for worker in workers:
        assert_frozen(worker)
        processes = {}
        rust = []
        for line in run(["docker", "top", worker["id"], "-eo", "pid,ppid,comm"], timeout=2).splitlines()[1:]:
            fields = line.split(None, 2)
            if len(fields) != 3:
                raise UnsafeBootstrap("Unknown process list format")
            pid = int(fields[0])
            program = os.path.basename(os.readlink(f"/proc/{pid}/exe"))
            processes[pid] = program
            if program == "worker":
                namespace = next(line for line in Path(f"/proc/{pid}/status").read_text().splitlines()
                                 if line.startswith("NSpid:"))
                rust.append(int(namespace.split()[-1]))
        if len(rust) != 1:
            raise UnsafeBootstrap("Expected exactly one Rust worker process per legacy container")
        worker_id = worker["fixed_id"] or f"{worker['hostname']}-{rust[0]}"
        worker_ids.append(worker_id)
        sockets = []
        raw = run(["nsenter", "--target", str(worker["pid"]), "--net", "ss", "--no-header",
                   "--tcp", "--numeric", "--processes", "state", "established"], timeout=2)
        for line in raw.splitlines():
            fields = line.split(None, 4)
            if len(fields) < 4:
                continue
            local, peer = endpoint(fields[2]), endpoint(fields[3])
            if peer[0] not in worker["database_ips"] or peer[1] != worker["port"]:
                continue
            pids = [int(pid) for pid in re.findall(r"pid=(\d+)", fields[4] if len(fields) > 4 else "")]
            if not pids or not all(pid in processes for pid in pids) or local[0] not in worker["ips"]:
                raise UnsafeBootstrap("Database socket is not exclusively container owned")
            matches = [session for session in sessions if address(session["address"]) == local[0]
                       and session["port"] == local[1] and session["database"] == database["name"]]
            if len(matches) != 1:
                raise UnsafeBootstrap("Database socket does not map to one backend")
            sockets.append(matches[0])
        source = [session for session in sessions if address(session["address"]) in worker["ips"]]
        if not sockets or len(sockets) != len(source) or {s["pid"] for s in sockets} != {s["pid"] for s in source}:
            raise UnsafeBootstrap("Unmatched sessions from legacy container address")
        owned.extend(sockets)
    identities = fence.json("SELECT json_build_object('id',id,'hostname',hostname) FROM workers WHERE id IN ("
                            + ",".join(literal(value) for value in worker_ids) + ")")
    expected = {worker_id: worker["hostname"] for worker_id, worker in zip(worker_ids, workers)}
    if {item["id"]: item["hostname"] for item in identities} != expected:
        raise UnsafeBootstrap("Legacy database worker identity is ambiguous")
    running = fence.query("SELECT count(*) FROM jobs WHERE status='running' AND locked_by IN ("
                          + ",".join(literal(value) for value in worker_ids) + ")")
    return owned, running == ["0"]


def terminate_owned(fence, sessions):
    for session in sessions:
        fence.query("SELECT pg_stat_clear_snapshot()")
        # backend_start plus full endpoint protects against PID reuse.
        where = (f"pid={int(session['pid'])} AND backend_start={literal(session['backend_start'])}::timestamptz"
                 f" AND client_addr={literal(session['address'])}::inet AND client_port={int(session['port'])}"
                 f" AND datname={literal(session['database'])}")
        fence.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE " + where)
    if sessions:
        deadline = time.monotonic() + 2
        while True:
            fence.query("SELECT pg_stat_clear_snapshot()")
            remaining = fence.query("SELECT count(*) FROM pg_stat_activity WHERE pid IN ("
                                    + ",".join(str(int(item["pid"])) for item in sessions) + ")")
            if remaining == ["0"]:
                return
            if time.monotonic() >= deadline:
                raise UnsafeBootstrap("Legacy backends have not exited")
            time.sleep(0.05)


def unpause(containers):
    confirmed = True
    for container in containers:
        try:
            subprocess.run(["docker", "unpause", container], stdout=subprocess.DEVNULL,
                           stderr=subprocess.DEVNULL, timeout=2, check=False)
            result = run(["docker", "inspect", container], timeout=2)
            state = json.loads(result)[0]["State"]
            confirmed = confirmed and (not state["Paused"] or not state["Running"])
        except (UnsafeBootstrap, subprocess.TimeoutExpired, ValueError, KeyError):
            try:
                confirmed = removed([container]) and confirmed
            except (UnsafeBootstrap, subprocess.TimeoutExpired):
                confirmed = False
    return confirmed


@contextlib.contextmanager
def journal_lock(journal):
    with (journal / "lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        yield


def phase(journal):
    path = journal / "phase"
    return path.read_text().strip() if path.exists() else ""


def set_phase(journal, value):
    temporary = journal / ("phase-" + uuid.uuid4().hex)
    with temporary.open("x") as stream:
        stream.write(value + "\n")
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, journal / "phase")
    descriptor = os.open(journal, os.O_DIRECTORY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def removed(containers):
    known = set(run(["docker", "ps", "--all", "--no-trunc", "--quiet"], timeout=2).split())
    return not known.intersection(containers)


def retire_containers(containers):
    run(["docker", "update", "--restart=no", *containers], timeout=2)
    run(["docker", "rm", "--force", *containers], timeout=2)
    if not removed(containers):
        raise UnsafeBootstrap("Legacy removal was not confirmed")


def watchdog_main(journal, containers):
    controller = os.getppid()
    print("ready", flush=True)
    time.sleep(15)
    with (journal / "lock").open("a") as lock:
        deadline = time.monotonic() + 1
        while True:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                # A paused/stalled controller must not hold the freeze forever.
                # Only kill our still-current parent, never an unrelated reused PID.
                if time.monotonic() >= deadline and os.getppid() == controller:
                    try:
                        os.kill(controller, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                time.sleep(0.05)
        if phase(journal) != "retire":
            set_phase(journal, "released")
            while not unpause(containers):
                time.sleep(0.25)
            return
        # The durable commit proves all backends gone and all workers frozen-idle.
        # Never unpause after this point, even if Docker's client timed out while
        # its daemon was still processing a remove request.
        while True:
            try:
                if removed(containers):
                    return
                run(["docker", "rm", "--force", *containers], timeout=3)
            except (UnsafeBootstrap, subprocess.TimeoutExpired):
                pass
            time.sleep(0.25)


def attempt(workers, database, recovery_fd=None):
    ids = [worker["id"] for worker in workers]
    # Journal outlives incoming bundle/SSH cleanup. The watchdog inherits only
    # the dedicated recovery-lock FD, never psql/deployment/journal-lock FDs,
    # and acknowledges readiness before freezing.
    journal = Path(tempfile.mkdtemp(prefix="vefa-worker-retire-"))
    (journal / "lock").touch(mode=0o600)
    watchdog = subprocess.Popen([sys.executable, str(Path(__file__).resolve()), "--watchdog", str(journal), *ids],
                                stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                stderr=subprocess.DEVNULL, start_new_session=True, close_fds=True,
                                pass_fds=(recovery_fd,) if recovery_fd is not None else ())
    fence = None
    finished = False
    started = time.monotonic()
    try:
        with selectors.DefaultSelector() as ready:
            ready.register(watchdog.stdout, selectors.EVENT_READ)
            if not ready.select(3) or watchdog.stdout.readline() != b"ready\n":
                raise UnsafeBootstrap("Legacy freeze watchdog is unavailable")
        watchdog.stdout.close()
        with journal_lock(journal):
            if phase(journal) == "released" or time.monotonic() - started > 10:
                raise UnsafeBootstrap("Legacy freeze watchdog expired before pause")
            run(["docker", "pause", *ids], timeout=3)
        fence = Psql(database)
        fence.query("SET lock_timeout='1500ms'; SET statement_timeout='2000ms'; BEGIN ISOLATION LEVEL READ COMMITTED; LOCK TABLE jobs IN SHARE MODE")
        sessions, idle = audit(workers, database, fence)
        if not idle:
            return False
        # Keep every worker intact until all potentially submitted SQL is gone.
        # If termination fails partway, releasing the fence is safe: surviving
        # workers remain alive, unfreeze, and can own/heartbeat their claims.
        terminate_owned(fence, sessions)
        with journal_lock(journal):
            if phase(journal) == "released" or time.monotonic() - started > 10:
                raise UnsafeBootstrap("Legacy freeze deadline reached before retirement commit")
            for worker in workers:
                assert_frozen(worker)
            if time.monotonic() - started > 10:
                raise UnsafeBootstrap("Legacy freeze deadline reached after frozen-state verification")
            set_phase(journal, "retire")
        # After the commit the watchdog must retire, never unpause. This remains
        # true if removal times out, fsync raises after rename, or SSH disappears.
        retire_containers(ids)
        finished = True
        return True
    finally:
        try:
            with journal_lock(journal):
                if phase(journal) != "retire":
                    set_phase(journal, "released")
                    finished = unpause(ids)
        finally:
            if fence:
                fence.close()
            if finished:
                watchdog.terminate()
                watchdog.wait(timeout=3)
            # If retirement is uncertain, retain the detached watchdog and journal.
            if not watchdog.stdout.closed:
                watchdog.stdout.close()
            if not finished:
                raise UnsafeBootstrap("Legacy recovery remains active; no further freeze is allowed")

def retire_idle(containers, recovery_lock, timeout=240):
    # Only this dedicated lock FD is inherited by the watchdog. Closing the
    # parent's copy must NOT explicitly LOCK_UN: the same open-file-description
    # remains locked until detached recovery exits, across later CI/SSH attempts.
    descriptor = os.open(recovery_lock, os.O_CREAT | os.O_RDWR, 0o600)
    try:
        try:
            fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise UnsafeBootstrap("A prior legacy recovery is still active") from None
        workers, database = preflight(containers)
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if attempt(workers, database, descriptor):
                print("Idle legacy workers retired under verified database fence")
                return
            time.sleep(1)
        raise UnsafeBootstrap("Legacy workers remain busy; no job was interrupted; retry deployment later")
    finally:
        os.close(descriptor)


if __name__ == "__main__" and sys.argv[1:2] == ["--watchdog"]:
    watchdog_main(Path(sys.argv[2]), sys.argv[3:])
