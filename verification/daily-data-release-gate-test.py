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
    def test_new_paired_news_shards_are_allowed(self):
        digest='b'*64
        self.current['file_sha256']['daily-simulation/news-shards/'+digest+'.json']=digest
        self.current['file_sha256']['file-data/news-shards/'+digest+'.js']='c'*64
        self.assertTrue(gate.eligible(self.previous,self.current))
    def test_unpaired_or_forged_shards_are_blocked(self):
        digest='b'*64
        self.current['file_sha256']['daily-simulation/news-shards/'+digest+'.json']=digest
        self.current['file_sha256']['file-data/news-shards/'+digest+'.js']='c'*64
        self.current['file_sha256']['daily-simulation/news-shards/'+digest+'.json']='d'*64
        self.assertFalse(gate.eligible(self.previous,self.current))
    def test_modification_of_old_shard_is_blocked(self):
        digest='b'*64; path='daily-simulation/news-shards/'+digest+'.json'
        self.previous['file_sha256'][path]=digest
        self.current['file_sha256'][path]='c'*64
        self.assertFalse(gate.eligible(self.previous,self.current))
    def test_first_monthly_archive_activation_requires_manual_release(self):
        month='2026-11'
        self.current['file_sha256']['daily-simulation/documents.json']='b'*64
        self.current['file_sha256'][f'daily-simulation/archives/{month}/index.json']='c'*64
        self.assertFalse(gate.eligible(self.previous,self.current))

    def test_monthly_archive_update_after_manual_activation(self):
        sep='daily-simulation/archives/2026-09/index.json'
        self.previous['file_sha256'][sep]='a'*64
        self.current['file_sha256'][sep]='a'*64
        oct='daily-simulation/archives/2026-10/index.json'
        self.current['file_sha256'][oct]='b'*64
        self.current['file_sha256']['daily-simulation/documents.json']='b'*64
        self.assertTrue(gate.eligible(self.previous,self.current))

    def test_existing_month_rewrite_without_manifest_is_blocked(self):
        sep='daily-simulation/archives/2026-09/index.json'
        self.previous['file_sha256'][sep]='a'*64
        self.current['file_sha256'][sep]='b'*64
        self.assertFalse(gate.eligible(self.previous,self.current))

    def test_any_modified_app_file_still_blocks_monthly_release(self):
        sep='daily-simulation/archives/2026-09/index.json'
        self.previous['file_sha256'][sep]='a'*64
        self.current['file_sha256'][sep]='b'*64
        self.current['file_sha256']['daily-simulation/documents.json']='b'*64
        self.current['file_sha256']['daily-simulation/app.js']='c'*64
        self.assertFalse(gate.eligible(self.previous,self.current))

    def test_first_question_monthly_conversion_requires_manual_review(self):
        self.current['file_sha256'][gate.QUESTION_INDEX]='b'*64
        self.current['file_sha256'][gate.QUESTION_OFFLINE_INDEX]='c'*64
        self.assertFalse(gate.eligible(self.previous,self.current))

    def test_monthly_question_delta_only_after_activation(self):
        qindex=gate.QUESTION_INDEX;offline=gate.QUESTION_OFFLINE_INDEX
        self.previous['file_sha256'][qindex]='a'*64
        self.previous['file_sha256'][offline]='a'*64
        self.current['file_sha256'][qindex]='b'*64
        self.current['file_sha256'][offline]='c'*64
        digest='d'*64
        self.current['file_sha256']['daily-simulation/question-shards/'+digest+'.json']=digest
        self.current['file_sha256']['file-data/question-shards/'+digest+'.js']='e'*64
        self.assertTrue(gate.eligible(self.previous,self.current))

    def test_monthly_question_commit_without_manifest_is_blocked(self):
        self.previous['file_sha256'][gate.QUESTION_INDEX]='a'*64
        self.previous['file_sha256'][gate.QUESTION_OFFLINE_INDEX]='a'*64
        digest='d'*64
        self.current['file_sha256']['daily-simulation/question-shards/'+digest+'.json']=digest
        self.current['file_sha256']['file-data/question-shards/'+digest+'.js']='e'*64
        self.assertFalse(gate.eligible(self.previous,self.current))

    def test_legacy_question_update_after_monthly_activation_is_blocked(self):
        self.previous['file_sha256'][gate.QUESTION_INDEX]='a'*64
        self.previous['file_sha256'][gate.QUESTION_OFFLINE_INDEX]='a'*64
        self.current['file_sha256']['daily-simulation/questions.json']='b'*64
        self.assertFalse(gate.eligible(self.previous,self.current))

    def test_forged_new_question_shard_digest_is_blocked(self):
        self.previous['file_sha256'][gate.QUESTION_INDEX]='a'*64
        self.previous['file_sha256'][gate.QUESTION_OFFLINE_INDEX]='a'*64
        self.current['file_sha256'][gate.QUESTION_INDEX]='b'*64
        self.current['file_sha256'][gate.QUESTION_OFFLINE_INDEX]='c'*64
        digest='d'*64
        self.current['file_sha256']['daily-simulation/question-shards/'+digest+'.json']='f'*64
        self.assertFalse(gate.eligible(self.previous,self.current))

    def test_invalid_hash_blocks_release(self):
        self.current['file_sha256']['daily-simulation/questions.json'] = 'invalid'
        self.assertFalse(gate.eligible(self.previous, self.current))

if __name__ == '__main__':
    unittest.main()
