"""Real process-death/lock-recovery tests; Docker is a harmless command fixture."""
import json
import fcntl
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import unittest

SOURCE = Path(__file__).resolve().parent / "legacy-bootstrap.py"
CONTROLLER = r'''
import fcntl, importlib.util, os
from pathlib import Path
import signal, subprocess, sys
spec=importlib.util.spec_from_file_location("legacy",sys.argv[1])
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
journal=Path(sys.argv[2]);journal.mkdir();(journal/"lock").touch()
recovery=(journal/"recovery.lock").open("a");fcntl.flock(recovery,fcntl.LOCK_EX)
watchdog=subprocess.Popen([sys.executable,sys.argv[1],"--watchdog",str(journal),"fixture-id"],
                         stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,
                         start_new_session=True,close_fds=True,pass_fds=(recovery.fileno(),))
assert watchdog.stdout.readline()==b"ready\n"
(journal/"ready").touch()
if sys.argv[3]=="retire":
    with module.journal_lock(journal):module.set_phase(journal,"retire")
if sys.argv[3]=="stall":
    lock=(journal/"lock").open("a");fcntl.flock(lock,fcntl.LOCK_EX)
    os.kill(os.getpid(),signal.SIGSTOP)
os._exit(0)
'''
DOCKER = r'''
import json,os
from pathlib import Path
import sys
log=Path(os.environ["WATCHDOG_TEST_LOG"])
with log.open("a") as stream:stream.write(json.dumps(sys.argv[1:])+"\n")
removed=log.with_suffix(".removed")
if sys.argv[1]=="rm":removed.touch()
if sys.argv[1]=="ps" and not removed.exists():print("fixture-id")
if sys.argv[1]=="inspect":print(json.dumps([{"State":{"Running":True,"Paused":False}}]))
'''


@unittest.skipUnless(os.name == "posix", "Unix process and flock semantics")
class WatchdogTest(unittest.TestCase):
    def test_lost_controller_stalled_lock_and_committed_retirement_recover(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            commands = root / "bin"
            commands.mkdir()
            docker = commands / "docker"
            docker.write_text("#!" + sys.executable + "\n" + DOCKER)
            docker.chmod(0o755)
            processes = []
            started = time.monotonic()
            try:
                # Independent cases run together, so real watchdog coverage takes
                # about16s rather than three separate15s waits.
                for mode in ("lost", "stall", "retire"):
                    process = subprocess.Popen(
                        [sys.executable, "-c", CONTROLLER, str(SOURCE), str(root / mode), mode],
                        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                        env={**os.environ, "PATH": str(commands) + os.pathsep + os.environ["PATH"],
                             "WATCHDOG_TEST_LOG": str(root / (mode + ".log"))},
                    )
                    processes.append((mode, process))
                ready_deadline = started + 3
                while time.monotonic() < ready_deadline and any(not (root / mode / "ready").exists()
                                                               for mode, _ in processes):
                    time.sleep(0.02)
                # Parent death/SSH closure cannot let a later attempt freeze the
                # same workers while its detached watchdog is still recovering.
                for mode, _ in processes:
                    self.assertTrue((root / mode / "ready").exists(), mode)
                    with (root / mode / "recovery.lock").open("a") as recovery:
                        with self.assertRaises(BlockingIOError):
                            fcntl.flock(recovery, fcntl.LOCK_EX | fcntl.LOCK_NB)
                for mode, process in processes:
                    process.communicate(timeout=max(1, 21 - (time.monotonic() - started)))
                    self.assertEqual(process.returncode, -signal.SIGKILL if mode == "stall" else 0)
                deadline = started + 21
                while time.monotonic() < deadline and any(not (root / (mode + ".log")).exists()
                                                           for mode, _ in processes):
                    time.sleep(0.05)
                for mode, _ in processes:
                    log = root / (mode + ".log")
                    self.assertTrue(log.exists(), mode)
                    events = [json.loads(line) for line in log.read_text().splitlines()]
                    if mode == "retire":
                        self.assertTrue(any(event[0] == "rm" for event in events))
                        self.assertFalse(any(event[0] == "unpause" for event in events))
                    else:
                        self.assertTrue(any(event[0] == "unpause" for event in events))
                        self.assertFalse(any(event[0] == "rm" for event in events))
                        self.assertEqual((root / mode / "phase").read_text().strip(), "released")
                    with (root / mode / "recovery.lock").open("a") as recovery:
                        while True:
                            try:
                                fcntl.flock(recovery, fcntl.LOCK_EX | fcntl.LOCK_NB)
                                break
                            except BlockingIOError:
                                self.assertLess(time.monotonic(), deadline)
                                time.sleep(0.05)
            finally:
                for _, process in processes:
                    if process.poll() is None:
                        process.kill()
                    process.communicate()


if __name__ == "__main__":
    unittest.main()
