"""Hosting source identity gates fail before any Git write; Git is fully mocked."""
import hashlib
import io
import json
from pathlib import Path
import runpy
import tarfile
import tempfile
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/prepare-sites-source.py'
PUBLIC = 'appgprj_6a96455b69c08191bac4a9aa7cdd7e43'
BETA = 'appgprj_6aa3491b56808191b9322b08eb92e7ef'
COMMIT, PARENT, SNAPSHOT = 'a' * 40, 'b' * 40, 'c' * 40


class PrepareSitesSourceTests(unittest.TestCase):
    def fixture(self, directory, parent_project=PUBLIC, source_project=PUBLIC,
                source_commit=COMMIT, phase='staging', baseline_parent=PARENT,
                prior_phase='staging', prior_release='d' * 64):
        root = Path(directory)
        archive = root / 'sites-source.tar.gz'
        with tarfile.open(archive, 'w:gz') as tar:
            for name, value in {
                '.openai/hosting.json': {'project_id': source_project, 'd1': 'DB', 'r2': 'LIBRARY'},
                'SOURCE_PROVENANCE.json': {'github_commit': source_commit},
            }.items():
                data = json.dumps(value).encode()
                member = tarfile.TarInfo(name)
                member.size = len(data)
                tar.addfile(member, io.BytesIO(data))
        receipt = {
            'project_id': PUBLIC, 'commit_sha': COMMIT,
            'archives': {'sites-source.tar.gz': {
                'sha256': hashlib.sha256(archive.read_bytes()).hexdigest()}},
            'catalog_staging': {'baseline': {'hosting_source': baseline_parent}},
        }
        (root / 'release.json').write_text(json.dumps(receipt))
        proof = root / 'proof.json'
        proof.write_text('{}')
        output = root / 'prepared-source.json'
        calls = []

        def git(args, **kwargs):
            self.assertEqual(args[0], 'git')
            calls.append(args[1:])
            if args[1:] == ['cat-file', '-t', PARENT]:
                return b'commit\n'
            if args[1:] == ['show', PARENT + ':.openai/hosting.json']:
                return json.dumps({'project_id': parent_project}).encode()
            if args[1:] == ['show', PARENT + ':DEPLOYMENT_PHASE.json']:
                return json.dumps({'phase': prior_phase,
                                   'release_sha256': prior_release}).encode()
            if args[1] in ('read-tree', 'update-index', 'update-ref'):
                return b''
            if args[1] == 'hash-object':
                return ('1' * 40).encode()
            if args[1] == 'write-tree':
                return ('2' * 40).encode()
            if args[1] == 'commit-tree':
                self.assertEqual(args[3:5], ['-p', PARENT])
                return SNAPSHOT.encode()
            raise AssertionError('Unexpected Git call: ' + str(args))

        def phase_gate(args):
            self.assertEqual(args[0], 'node')
            self.assertEqual(args[2], 'gate-' + phase)
            Path(args[-1]).write_text(json.dumps({
                'project_id': PUBLIC, 'github_commit': COMMIT,
                'phase': phase, 'release_sha256': 'd' * 64,
            }))

        def run():
            argv = [str(SCRIPT), str(root), '--parent', PARENT,
                    '--output', str(output), '--phase', phase,
                    '--storage-proof', str(proof)]
            with patch('sys.argv', argv), \
                 patch('subprocess.check_output', side_effect=git), \
                 patch('subprocess.check_call', side_effect=phase_gate), \
                 redirect_stdout(io.StringIO()):
                runpy.run_path(str(SCRIPT), run_name='__main__')
        return run, calls, output

    def assert_no_git_writes(self, calls, output):
        self.assertTrue(calls)
        self.assertTrue(all(call[0] in ('cat-file', 'show') for call in calls), calls)
        self.assertFalse(output.exists())

    def test_beta_hosting_parent_is_rejected_before_git_writes(self):
        with tempfile.TemporaryDirectory() as directory:
            run, calls, output = self.fixture(directory, parent_project=BETA)
            with self.assertRaisesRegex(AssertionError, 'Hosting parent belongs to another project'):
                run()
            self.assert_no_git_writes(calls, output)

    def test_beta_source_archive_is_rejected_before_git_writes(self):
        with tempfile.TemporaryDirectory() as directory:
            run, calls, output = self.fixture(directory, source_project=BETA)
            with self.assertRaisesRegex(AssertionError, 'Source archive belongs to another project'):
                run()
            self.assert_no_git_writes(calls, output)

    def test_mismatched_source_commit_is_rejected_before_git_writes(self):
        with tempfile.TemporaryDirectory() as directory:
            run, calls, output = self.fixture(directory, source_commit='e' * 40)
            with self.assertRaisesRegex(AssertionError, 'Source archive commit differs'):
                run()
            self.assert_no_git_writes(calls, output)

    def test_matching_public_source_creates_only_a_forward_snapshot(self):
        with tempfile.TemporaryDirectory() as directory:
            run, calls, output = self.fixture(directory)
            run()
            self.assertEqual(json.loads(output.read_text()), {
                'commit_sha': SNAPSHOT, 'github_commit': COMMIT,
                'parent': PARENT, 'phase': 'staging',
            })
            self.assertEqual(sum(call[0] == 'commit-tree' for call in calls), 1)
            self.assertEqual(sum(call[0] == 'update-ref' for call in calls), 1)
            self.assertFalse(any(call[0] in ('checkout', 'switch', 'reset', 'clean', 'push')
                                 for call in calls))

    def test_changed_public_parent_cannot_reinstall_the_pinned_staging_app(self):
        with tempfile.TemporaryDirectory() as directory:
            run, calls, output = self.fixture(directory, baseline_parent='f' * 40)
            with self.assertRaisesRegex(AssertionError, 'Pinned public baseline is no longer the hosting head'):
                run()
            self.assert_no_git_writes(calls, output)

    def test_final_cutover_rejects_wrong_phase_or_release_before_git_writes(self):
        for prior_phase, prior_release in [('final', 'd' * 64), ('staging', 'e' * 64)]:
            with self.subTest(prior_phase=prior_phase, prior_release=prior_release):
                with tempfile.TemporaryDirectory() as directory:
                    run, calls, output = self.fixture(directory, phase='final',
                                                      prior_phase=prior_phase,
                                                      prior_release=prior_release)
                    with self.assertRaisesRegex(AssertionError, 'Final snapshot must follow this exact release staging snapshot'):
                        run()
                    self.assert_no_git_writes(calls, output)

    def test_final_cutover_accepts_its_exact_staging_parent(self):
        with tempfile.TemporaryDirectory() as directory:
            run, calls, output = self.fixture(directory, phase='final')
            run()
            self.assertEqual(json.loads(output.read_text())['phase'], 'final')
            self.assertIn(['show', PARENT + ':DEPLOYMENT_PHASE.json'], calls)
            self.assertEqual(sum(call[0] == 'commit-tree' for call in calls), 1)


if __name__ == '__main__':
    unittest.main()
