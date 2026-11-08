import importlib.util
import io
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import Mock, patch

SOURCE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("legacy_bootstrap", SOURCE / "legacy-bootstrap.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

WORKER = {"id": "legacy", "pid": 99, "hostname": "old", "fixed_id": None,
          "ips": {"172.18.0.5"}, "database_ips": {"172.18.0.2"}, "port": 5432}
DATABASE = {"container": "postgres", "name": "test", "administrator": "postgres"}
SESSION = {"pid": 101, "backend_start": "2026-11-08T00:00:00+00:00", "address": "172.18.0.5",
           "port": 40000, "database": "test"}


class Fence:
    def __init__(self, events, idle=True):
        self.events = events
        self.idle = idle
        self.sessions = [SESSION]
        self.identity = [{"id": "old-7", "hostname": "old"}]

    def query(self, sql):
        self.events.append(("sql", sql))
        return ["0"] if self.idle else ["1"]

    def json(self, sql):
        return self.identity if "FROM workers" in sql else self.sessions

    def close(self):
        self.events.append(("close",))


class LegacyTest(unittest.TestCase):
    def test_busy_job_unfreezes_before_releasing_fence_and_never_retires(self):
        self.attempt(idle=False)

    def test_idle_worker_sessions_are_terminated_before_removal_and_unlock(self):
        self.attempt(idle=True)

    def test_audit_failure_always_unfreezes_without_removing_worker(self):
        self.attempt(error=True)

    def attempt(self, idle=False, error=False):
        events = []
        watchdog = Mock(stdout=io.BytesIO(b"ready\n"))
        fence = Fence(events)
        selector = Mock()
        selector.__enter__ = Mock(return_value=selector)
        selector.__exit__ = Mock(return_value=False)
        selector.select.return_value = [(1, 1)]
        with patch.object(module.subprocess, "Popen", return_value=watchdog) as popen, \
                patch.object(module.selectors, "DefaultSelector", return_value=selector), \
                patch.object(module, "run", side_effect=lambda args, **kwargs: events.append(tuple(args)) or ""), \
                patch.object(module, "Psql", return_value=fence), \
                patch.object(module, "assert_frozen"), \
                patch.object(module, "audit", side_effect=module.UnsafeBootstrap() if error else None,
                             return_value=([SESSION], idle)), \
                patch.object(module, "terminate_owned", side_effect=lambda *_: events.append(("terminate",))), \
                patch.object(module, "unpause", side_effect=lambda *_: events.append(("unpause",)) or True):
            if error:
                with self.assertRaises(module.UnsafeBootstrap):
                    module.attempt([WORKER], DATABASE)
            else:
                self.assertEqual(module.attempt([WORKER], DATABASE), idle)
        self.assertTrue(popen.call_args.kwargs["start_new_session"])
        self.assertTrue(popen.call_args.kwargs["close_fds"])
        if not idle or error:
            self.assertLess(events.index(("unpause",)), events.index(("close",)))
        else:
            self.assertNotIn(("unpause",), events)
        kills = [i for i, event in enumerate(events) if event[:3] == ("docker", "rm", "--force")]
        if idle and not error:
            self.assertEqual(len(kills), 1)
            self.assertLess(events.index(("terminate",)), kills[0])
            self.assertLess(kills[0], events.index(("close",)))
        else:
            self.assertEqual(kills, [])
        watchdog.terminate.assert_called_once()

    def test_failures_after_retirement_commit_never_unpause_and_leave_watchdog(self):
        for boundary in ("terminate", "frozen", "update", "remove", "commit"):
            with self.subTest(boundary=boundary):
                events = []
                watchdog = Mock(stdout=io.BytesIO(b"ready\n"))
                selector = Mock()
                selector.__enter__ = Mock(return_value=selector)
                selector.__exit__ = Mock(return_value=False)
                selector.select.return_value = [(1, 1)]
                def run(args, **kwargs):
                    events.append(tuple(args))
                    if ((boundary == "update" and args[:2] == ["docker", "update"])
                            or (boundary == "remove" and args[:2] == ["docker", "rm"])):
                        # Model a Docker client timeout after daemon accepted removal.
                        raise subprocess.TimeoutExpired(args, 2)
                    return ""
                original_commit = module.set_phase
                def commit(journal, value):
                    original_commit(journal, value)
                    if boundary == "commit" and value == "retire":
                        raise OSError("directory fsync after successful rename")
                with patch.object(module.subprocess, "Popen", return_value=watchdog), \
                        patch.object(module.selectors, "DefaultSelector", return_value=selector), \
                        patch.object(module, "run", side_effect=run), \
                        patch.object(module, "Psql", return_value=Fence(events)), \
                        patch.object(module, "audit", return_value=([SESSION], True)), \
                        patch.object(module, "assert_frozen", side_effect=module.UnsafeBootstrap() if boundary == "frozen" else None), \
                        patch.object(module, "terminate_owned", side_effect=module.UnsafeBootstrap() if boundary == "terminate" else None), \
                        patch.object(module, "set_phase", side_effect=commit), \
                        patch.object(module, "unpause", side_effect=lambda *_: events.append(("unpause",)) or True):
                    with self.assertRaises((module.UnsafeBootstrap, subprocess.TimeoutExpired, OSError)):
                        module.attempt([WORKER], DATABASE)
                if boundary in ("terminate", "frozen"):
                    self.assertIn(("unpause",), events)
                    watchdog.terminate.assert_called_once()
                    self.assertFalse(any(event[:2] == ("docker", "rm") for event in events))
                else:
                    self.assertNotIn(("unpause",), events)
                    watchdog.terminate.assert_not_called()
                self.assertIn(("close",), events)

    def audit(self, sessions=None, identity=None, pid=100):
        fence = Fence([])
        if sessions is not None:
            fence.sessions = sessions
        if identity is not None:
            fence.identity = identity
        def output(args, **kwargs):
            if args[:2] == ["docker", "top"]:
                return "PID PPID COMMAND\n100 1 worker\n"
            return f'0 0 172.18.0.5:40000 172.18.0.2:5432 users:(("worker",pid={pid},fd=1))\n'
        with patch.object(module, "assert_frozen"), patch.object(module, "run", side_effect=output), \
                patch.object(module.os, "readlink", return_value="/usr/local/bin/worker"), \
                patch.object(module.Path, "read_text", return_value="NSpid:\t100\t7\n"):
            return module.audit([WORKER], DATABASE, fence)

    def test_fresh_exclusive_socket_session_identity_is_accepted(self):
        sessions, idle = self.audit()
        self.assertEqual(sessions, [SESSION])
        self.assertTrue(idle)

    def test_unknown_process_socket_is_rejected(self):
        with self.assertRaises(module.UnsafeBootstrap):
            self.audit(pid=999)

    def test_unmatched_same_address_session_is_rejected(self):
        with self.assertRaises(module.UnsafeBootstrap):
            self.audit(sessions=[SESSION, {**SESSION, "pid": 102, "port": 40001}])

    def test_missing_or_wrong_database_identity_is_rejected(self):
        for identity in ([], [{"id": "old-7", "hostname": "other"}]):
            with self.subTest(identity=identity), self.assertRaises(module.UnsafeBootstrap):
                self.audit(identity=identity)

    def test_termination_is_fenced_by_backend_start_and_endpoint(self):
        events = []
        module.terminate_owned(Fence(events), [SESSION])
        query = next(event[1] for event in events if "pg_terminate_backend" in event[1])
        for required in ("pg_terminate_backend", "backend_start=", "client_addr=", "client_port=40000", "datname='test'"):
            self.assertIn(required, query)

    def test_changed_container_or_expired_freeze_is_rejected(self):
        info = {"State": {"Running": True, "Paused": False, "Pid": 99},
                "NetworkSettings": {"Networks": {"backend": {"IPAddress": "172.18.0.5"}}}}
        with patch.object(module, "inspect", return_value=info), self.assertRaises(module.UnsafeBootstrap):
            module.assert_frozen(WORKER)

    def test_expired_watchdog_prevents_a_late_initial_pause(self):
        events = []
        watchdog = Mock(stdout=io.BytesIO(b"ready\n"))
        selector = Mock()
        selector.__enter__ = Mock(return_value=selector)
        selector.__exit__ = Mock(return_value=False)
        selector.select.return_value = [(1, 1)]
        with patch.object(module.subprocess, "Popen", return_value=watchdog), \
                patch.object(module.selectors, "DefaultSelector", return_value=selector), \
                patch.object(module, "phase", return_value="released"), \
                patch.object(module, "run", side_effect=lambda args, **_: events.append(args) or ""), \
                patch.object(module, "unpause", return_value=True), \
                self.assertRaises(module.UnsafeBootstrap):
            module.attempt([WORKER], DATABASE)
        self.assertFalse(any(event[:2] == ["docker", "pause"] for event in events))

    def test_unpause_requires_confirmed_state_and_retries_transient_failure(self):
        states = ['[{"State":{"Running":true,"Paused":true}}]',
                  '[{"State":{"Running":true,"Paused":false}}]']
        with patch.object(module.subprocess, "run"), patch.object(module, "run", side_effect=states):
            self.assertFalse(module.unpause(["legacy"]))
            self.assertTrue(module.unpause(["legacy"]))
        with tempfile.TemporaryDirectory() as directory:
            journal = Path(directory)
            (journal / "lock").touch()
            with patch.object(module.time, "sleep"), \
                    patch.object(module, "unpause", side_effect=[False, True]) as unpause:
                module.watchdog_main(journal, ["legacy"])
            self.assertEqual(unpause.call_count, 2)
            self.assertEqual(module.phase(journal), "released")

    def test_unconfirmed_unpause_keeps_detached_watchdog_alive(self):
        watchdog = Mock(stdout=io.BytesIO(b"ready\n"))
        selector = Mock()
        selector.__enter__ = Mock(return_value=selector)
        selector.__exit__ = Mock(return_value=False)
        selector.select.return_value = [(1, 1)]
        with patch.object(module.subprocess, "Popen", return_value=watchdog), \
                patch.object(module.selectors, "DefaultSelector", return_value=selector), \
                patch.object(module, "run", return_value=""), \
                patch.object(module, "Psql", return_value=Fence([])), \
                patch.object(module, "audit", return_value=([SESSION], False)), \
                patch.object(module, "unpause", return_value=False):
            with self.assertRaises(module.UnsafeBootstrap):
                module.attempt([WORKER], DATABASE)
        watchdog.terminate.assert_not_called()

    def test_address_parsing_and_sql_literals(self):
        self.assertEqual(module.endpoint("[::ffff:172.18.0.5]:40000"), ("172.18.0.5", 40000))
        self.assertEqual(module.literal("a'b"), "'a''b'")


@unittest.skipUnless(os.environ.get("WORKER_DEPLOY_TEST_POSTGRES_CONTAINER"), "isolated Linux CI Postgres only")
class PostgresFenceTest(unittest.TestCase):
    def test_share_fence_blocks_submitted_writer_until_its_session_is_terminated(self):
        container = os.environ["WORKER_DEPLOY_TEST_POSTGRES_CONTAINER"]
        administrator = "worker_test"
        database = {"container": container, "name": "worker_test", "administrator": administrator}
        prefix = ["docker", "exec", "--user", "postgres", container, "psql", "-X", "-q", "-A", "-t",
                  "-v", "ON_ERROR_STOP=1", "-U", administrator, "-d", "worker_test"]
        # The worker CI database is disposable. A separate table avoids queue fixtures.
        module.run(prefix + ["-c", "CREATE TABLE deployment_fence_test (value int)"])
        fence = module.Psql(database)
        writer = None
        try:
            fence.query("BEGIN; LOCK TABLE deployment_fence_test IN SHARE MODE")
            writer_prefix = ["docker", "exec", "--env", "PGPASSWORD=" + os.environ.get("WORKER_DEPLOY_TEST_POSTGRES_PASSWORD", "worker_test"),
                             "--user", "postgres", container, "psql", "-h", "127.0.0.1", "-X", "-q", "-A", "-t",
                             "-v", "ON_ERROR_STOP=1", "-U", administrator, "-d", "worker_test"]
            writer = subprocess.Popen(writer_prefix + ["-c", "SET application_name='deployment-fence-writer'; "
                                                 "INSERT INTO deployment_fence_test VALUES (1)"],
                                      stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            import time
            deadline = time.monotonic() + 3
            sessions = []
            while time.monotonic() < deadline:
                fence.query("SELECT pg_stat_clear_snapshot()")
                sessions = fence.json("SELECT json_build_object('pid',pid,'backend_start',backend_start," 
                                      "'address',client_addr::text,'port',client_port,'database',datname) "
                                      "FROM pg_stat_activity WHERE application_name='deployment-fence-writer' "
                                      "AND wait_event_type='Lock'")
                if sessions:
                    break
                time.sleep(0.05)
            self.assertEqual(len(sessions), 1)
            # Exercise the production fresh-snapshot, exact-endpoint termination
            # and gone-verification path before the fence is released.
            module.terminate_owned(fence, sessions)
            writer.communicate(timeout=3)
            self.assertNotEqual(writer.returncode, 0)
            fence.close()
            fence = None
            self.assertEqual(module.run(prefix + ["-c", "SELECT count(*) FROM deployment_fence_test"]).strip(), "0")
        finally:
            if fence:
                fence.close()
            if writer and writer.poll() is None:
                writer.kill()
                writer.communicate()
            module.run(prefix + ["-c", "DROP TABLE deployment_fence_test"])


if __name__ == "__main__":
    unittest.main()
