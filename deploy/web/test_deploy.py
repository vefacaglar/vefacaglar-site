"""Deployment contracts, route isolation and interrupted-rollout recovery."""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parent


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class WebDeploymentTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        shutil.copyfile(SOURCE / 'deploy.py', self.root / 'deploy.py')
        shutil.copyfile(SOURCE / 'persist-caddy-network.py', self.root / 'persist-caddy-network.py')
        shutil.copyfile(SOURCE.parent / 'api/configure-caddy.py', self.root / 'caddy-target.py')
        self.web = load(self.root / 'deploy.py', 'web_deploy')

    def test_managed_switch_preserves_all_other_sites(self):
        original = 'auth.vefacaglar.com {\n    reverse_proxy authserver:5175\n}\n'
        initial = self.web.caddy_config(original, {}, 'web-blue:3000', 'blue-1')
        switched = self.web.caddy_config(initial, {}, 'web-green:3000', 'green-2', 'web-blue:3000')
        self.assertTrue(switched.startswith(original))
        self.assertIn('vefacaglar.com, www.vefacaglar.com {', switched)
        self.assertIn('reverse_proxy web-green:3000', switched)
        self.assertNotIn('reverse_proxy web-blue:3000', switched)
        self.assertEqual(switched.count(self.web.BEGIN), 1)

    def test_unmanaged_domain_in_import_or_multisite_is_rejected(self):
        adapted = {'routes': [{'match': [{'host': ['vefacaglar.com']}]}]}
        with self.assertRaisesRegex(RuntimeError, 'unmanaged'):
            self.web.caddy_config('import sites/*\n', adapted, 'web:3000', 'blue-1')

    def test_saved_upstream_mismatch_refuses_switch(self):
        initial = self.web.caddy_config('', {}, 'web:3000', 'blue-1')
        with self.assertRaisesRegex(RuntimeError, 'upstream differs'):
            self.web.caddy_config(initial, {}, 'new:3000', 'green-2', 'wrong:3000')

    def test_recovery_restores_before_removing_candidate(self):
        source = self.root / 'Caddyfile'
        source.write_text('after')
        candidate = {'id': 'blue-1'}
        self.web.save(self.root / '.pending-release.json', {
            'source': str(source), 'before': 'before', 'after': 'after', 'candidate': candidate,
            'command': ['caddy'], 'config': str(source),
        })
        with patch.object(self.web, 'run') as command, patch.object(self.web, 'compose') as compose:
            self.web.recover(self.root)
        self.assertEqual(source.read_text(), 'before')
        self.assertEqual(command.call_count, 2)
        compose.assert_called_once_with(self.root / 'releases/blue-1', 'down', '--timeout', '30')
        self.assertFalse((self.root / '.pending-release.json').exists())

    def test_grace_period_regression_restores_route_and_active_state(self):
        bundle = self.root / 'bundle'
        bundle.mkdir()
        (bundle / '.env').write_text('WEB_DOCKER_NETWORK=databases_default\n')
        (bundle / 'settings.json').write_text('{"verify_https": false}')
        for name in ('compose.yml', 'web.env'):
            (bundle / name).write_text('')
        source = self.root / 'Caddyfile'
        source.write_text(self.web.caddy_config('', {}, '127.0.0.1:3100', 'blue-1'))
        original = source.read_text()
        active = {'id': 'blue-1', 'port': '127.0.0.1:3100'}
        state_path = self.root / '.releases.json'
        self.web.save(state_path, {'active': active})
        def compose(directory, *args):
            return '127.0.0.1:3200' if args[0] == 'port' else ''
        with patch.object(self.web.NETWORK, 'persist'), \
             patch.object(self.web.PROXY, 'target', return_value=(source, ['caddy'], str(source), '')), \
             patch.object(self.web, 'compose', side_effect=compose) as docker, \
             patch.object(self.web, 'run', return_value='{}'), \
             patch.object(self.web, 'verify_origin', side_effect=[None, RuntimeError('regression')]), \
             patch.object(self.web.time, 'sleep'):
            with self.assertRaisesRegex(RuntimeError, 'regression'):
                self.web.deploy(self.root, bundle, 'ghcr.io/example/web@sha256:' + 'a' * 64)
        self.assertEqual(source.read_text(), original)
        self.assertEqual(self.web.read(state_path), {'active': active})
        self.assertFalse((self.root / '.pending-release.json').exists())
        self.assertFalse(any(call.args[1] == 'stop' for call in docker.call_args_list))

    def test_external_caddy_edit_keeps_recovery_record_and_candidate(self):
        source = self.root / 'Caddyfile'
        source.write_text('external change')
        self.web.save(self.root / '.pending-release.json', {
            'source': str(source), 'before': 'before', 'after': 'after',
            'candidate': {'id': 'blue-1'}, 'command': ['caddy'], 'config': str(source),
        })
        with patch.object(self.web, 'compose') as compose:
            with self.assertRaisesRegex(RuntimeError, 'edited externally'):
                self.web.recover(self.root)
        compose.assert_not_called()
        self.assertTrue((self.root / '.pending-release.json').exists())


class PersistentNetworkTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.source = self.root / 'compose.yaml'
        self.original = 'services:\n  caddy:\n    image: caddy:2\n    ports: ["443:443"]\n  postgres:\n    image: postgres:17\nvolumes:\n  data: {}\n'
        self.source.write_text(self.original)
        self.network = load(SOURCE / 'persist-caddy-network.py', 'persistent_network')
        self.labels = json.dumps({'com.docker.compose.project.config_files': str(self.source), 'com.docker.compose.service': 'caddy'})
        self.current = json.dumps({'services': {'caddy': {'networks': {'default': {}}}}})

    def test_default_network_is_preserved_without_recreating_caddy(self):
        candidate = json.dumps({'services': {'caddy': {'networks': {'default': {}, 'vefacaglar-web': {}}}}})
        with patch.object(self.network, 'run', side_effect=[self.labels, self.current, candidate]) as command:
            self.network.persist(['docker', 'exec', 'caddy', 'caddy'], 'vefacaglar-web', self.root)
        written = self.source.read_text()
        self.assertIn('      default: {}\n      vefacaglar-web: {}', written)
        self.assertIn('  postgres:\n    image: postgres:17', written)
        self.assertEqual((self.root / '.caddy-compose-backup.yaml').read_text(), self.original)
        self.assertTrue(all('up' not in call.args[0] for call in command.call_args_list))

    def test_invalid_compose_restores_exact_original(self):
        with patch.object(self.network, 'run', side_effect=[self.labels, self.current, RuntimeError('invalid')]):
            with self.assertRaisesRegex(RuntimeError, 'invalid'):
                self.network.persist(['docker', 'exec', 'caddy', 'caddy'], 'vefacaglar-web', self.root)
        self.assertEqual(self.source.read_text(), self.original)


class PrepareTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.destination = Path(self.temporary.name) / 'bundle'
        self.prepare = load(SOURCE / 'prepare-deploy.py', 'web_prepare')
        self.environment = {
            'WEB_IMAGE': 'ghcr.io/example/site-web@sha256:' + 'a' * 64,
            'REGISTRY_USER': 'example', 'AUTH_MODE': 'oidc',
            'OIDC_ISSUER': 'https://auth.vefacaglar.com', 'OIDC_CLIENT_ID': 'web $client',
            'WEB_VERIFY_HTTPS': 'false',
        }

    def test_raw_values_permissions_and_first_staging_mode(self):
        with patch.dict(os.environ, self.environment, clear=True):
            self.prepare.prepare(self.destination)
        self.assertIn('OIDC_CLIENT_ID=web $client\n', (self.destination / 'web.env').read_text())
        self.assertEqual((self.destination / 'web.env').stat().st_mode & 0o777, 0o600)
        self.assertFalse(json.loads((self.destination / 'settings.json').read_text())['verify_https'])
        self.assertTrue((self.destination / 'caddy-target.py').is_file())

    def test_secret_injection_and_unused_runtime_keys_rejected(self):
        for extra in ({'OIDC_CLIENT_ID': 'value\nINJECTED=yes'}, {'WEB_ENV': 'DATABASE_URL=secret'}):
            with self.subTest(extra=extra):
                with patch.dict(os.environ, self.environment | extra, clear=True):
                    with self.assertRaises(ValueError):
                        self.prepare.prepare(self.destination)


if __name__ == '__main__':
    unittest.main()
