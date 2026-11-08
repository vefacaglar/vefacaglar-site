import runpy
import tempfile
import unittest
from pathlib import Path

prepare_module = runpy.run_path(str(Path(__file__).with_name("prepare-deploy.py")))
prepare = prepare_module["prepare"]

IMAGE = "ghcr.io/vefacaglar/vefacaglar-site-worker@sha256:" + "a" * 64
BASE = {
    "DATABASE_URL": "postgresql://u:p@postgres:5432/db",
    "TYPESENSE_HOST": "typesense",
    "TYPESENSE_API_KEY": "key$with spaces",
    "WORKER_IMAGE": IMAGE,
    "REGISTRY_USER": "github-actions[bot]",
}


class PrepareDeployTest(unittest.TestCase):
    def run_prepare(self, environ):
        directory = Path(tempfile.mkdtemp()) / "bundle"
        prepare(directory, environ)
        return directory

    def test_writes_bundle(self):
        bundle = self.run_prepare({**BASE, "WORKER_ENV": "RUST_LOG=debug\n# comment\n"})
        env = (bundle / "worker.env").read_text()
        self.assertIn("RUST_LOG=debug\n", env)
        self.assertIn("TYPESENSE_API_KEY=key$with spaces\n", env)
        self.assertEqual(
            (bundle / "compose.env").read_text(),
            f"WORKER_IMAGE={IMAGE}\nWORKER_DOCKER_NETWORK=databases_default\n",
        )
        for name in ("compose.yml", "deploy.sh", "receive.sh", "blue-green.py", "legacy-bootstrap.py", "image", "registry-user"):
            self.assertTrue((bundle / name).is_file(), name)

    def test_individual_secrets_override_worker_env(self):
        bundle = self.run_prepare({
            **BASE,
            "WORKER_ENV": "TYPESENSE_HOST=old\nIGDB_CLIENT_SECRET=old-secret\n",
            "IGDB_CLIENT_ID": "catalog-client",
            "IGDB_CLIENT_SECRET": "new-secret$with spaces",
        })
        env = (bundle / "worker.env").read_text()
        self.assertIn("TYPESENSE_HOST=typesense\n", env)
        self.assertIn("IGDB_CLIENT_ID=catalog-client\n", env)
        self.assertIn("IGDB_CLIENT_SECRET=new-secret$with spaces\n", env)

    def test_rejects_invalid_input(self):
        for override in (
            {"DATABASE_URL": ""},
            {"TYPESENSE_API_KEY": ""},
            {"TYPESENSE_PROTOCOL": "ftp"},
            {"DATABASE_URL": "a\nb"},
            {"IGDB_CLIENT_SECRET": "a\nb"},
            {"WORKER_IMAGE": "ghcr.io/x/y:latest"},
            {"WORKER_DOCKER_NETWORK": "bad network"},
            {"WORKER_ENV": "not a setting"},
            {"WORKER_ENV": "A=1\nA=2"},
        ):
            with self.subTest(override=override), self.assertRaises(ValueError):
                self.run_prepare({**BASE, **override})


if __name__ == "__main__":
    unittest.main()
