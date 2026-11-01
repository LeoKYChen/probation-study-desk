"""Regression checks for the narrow daily production publishing exception."""
import copy
import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('gate', Path(__file__).resolve().parents[1] / 'scripts/daily-data-release-gate.py')
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)

class ReleaseGateTest(unittest.TestCase):
    def setUp(self):
        self.previous = {'repository': gate.REPOSITORY, 'source_commit': 'a' * 40,
                         'file_sha256': {p: 'a' * 64 for p in gate.ALLOWED | {'index.html', 'daily-simulation/app.js'}}}
        self.current = copy.deepcopy(self.previous)
    def test_each_daily_data_file_can_change(self):
        for path in gate.ALLOWED:
            with self.subTest(path=path):
                current = copy.deepcopy(self.previous)
                current['file_sha256'][path] = 'b' * 64
                self.assertTrue(gate.eligible(self.previous, current))
    def test_no_changes_do_not_publish(self):
        self.assertFalse(gate.eligible(self.previous, self.current))
    def test_pending_application_change_blocks_data_release(self):
        self.current['file_sha256']['daily-simulation/questions.json'] = 'b' * 64
        self.current['file_sha256']['daily-simulation/app.js'] = 'b' * 64
        self.assertFalse(gate.eligible(self.previous, self.current))
    def test_added_or_deleted_files_block_release(self):
        for add in (True, False):
            current = copy.deepcopy(self.previous)
            if add:
                current['file_sha256']['new.html'] = 'b' * 64
            else:
                del current['file_sha256']['index.html']
            self.assertFalse(gate.eligible(self.previous, current))
    def test_invalid_provenance_blocks_release(self):
        for key, value in [('repository', 'other'), ('source_commit', ''), ('file_sha256', {})]:
            current = copy.deepcopy(self.previous)
            current[key] = value
            self.assertFalse(gate.eligible(self.previous, current))
    def test_invalid_hash_blocks_release(self):
        self.current['file_sha256']['daily-simulation/questions.json'] = 'invalid'
        self.assertFalse(gate.eligible(self.previous, self.current))

if __name__ == '__main__':
    unittest.main()
