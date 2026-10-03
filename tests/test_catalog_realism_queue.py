"""Resume policy checks use temporary artifacts and mocked authoring/rendering."""
import hashlib
import json
import os
from pathlib import Path
import runpy
import tempfile
import unittest
from unittest.mock import patch


QUEUE = runpy.run_path(str(Path(__file__).resolve().parents[1] /
                          'tools/blender/catalog_realism/queue.py'))
REFINEMENTS = runpy.run_path(str(Path(__file__).resolve().parents[1] /
                                 'tools/blender/catalog_realism/refinements.py'))


class QueueResumeTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.item = {'id': 'fixture', 'contractSha256': 'a' * 64,
                     'sourceBlend': {'path': 'baseline.blend'},
                     'baselineGlb': {'path': 'baseline.glb'},
                     'outputs': {'receipt': 'receipt.json'}}
        self.write('baseline.blend', b'original blend')
        self.write('baseline.glb', b'original glb')
        self.write('tools/blender/catalog_realism/build.py', b'authoring helper')
        self.write('tools/blender/catalog_realism/review.py', b'render helper')
        for name in ('material-plan', 'material-provenance', 'scan-plan'):
            self.json('assets-source/catalog-realism/' + name + '.json', {})
        self.json('assets-source/catalog-realism/catalog.json', {'items': [self.item]})

    def write(self, name, value):
        target = self.root / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(value)
        return {'path': name, 'sha256': hashlib.sha256(value).hexdigest()}

    def json(self, name, value):
        return self.write(name, json.dumps(value).encode())

    def run_queue(self, stage='build', fail=False):
        calls = []
        def build(*args, **kwargs):
            calls.append(args)
            if fail:
                raise ValueError('fixture build failed')
            return {'id': 'fixture', 'renderedThisCall': 5, 'seconds': 0}
        with patch.object(QUEUE['runpy'], 'run_path', return_value={'build': build, 'render_model': build, 'inputs': REFINEMENTS['inputs']}):
            result = QUEUE['run'](self.root, stage=stage, limit=1)
        return result, calls

    def receipt(self):
        author = self.write('author.py', b'authoring')
        renderer = self.write('renderer.py', b'original rendering')
        outputs = {'sourceBlend': self.write('candidate.blend', b'new blend'),
                   'glb': self.write('candidate.glb', b'new glb')}
        renders = [self.write(f'view-{number}.webp', str(number).encode()) for number in range(5)]
        self.json('receipt.json', {'inputContractSha256': self.item['contractSha256'],
                                  'buildInputs': [author], 'inputs': [author, renderer],
                                  'outputs': outputs, 'renders': renders})

    def test_unchanged_failure_is_skipped_but_fixed_plan_retries_automatically(self):
        _, first = self.run_queue(fail=True)
        result, second = self.run_queue()
        self.assertEqual((len(first), len(second), result['remaining']), (1, 0, 1))
        self.json('assets-source/catalog-realism/material-plan.json', {'fixed': True})
        _, third = self.run_queue()
        self.assertEqual(len(third), 1)

    def test_referenced_texture_change_retries_without_helper_changes(self):
        image = self.write('texture.png', b'old texture')
        self.json('assets-source/catalog-realism/material-provenance.json', {'maps': [image]})
        self.run_queue(fail=True)
        self.write('texture.png', b'fixed texture')
        _, calls = self.run_queue()
        self.assertEqual(len(calls), 1)

    def test_baseline_source_change_retries_without_global_plan_changes(self):
        self.run_queue(fail=True)
        self.write('baseline.blend', b'fixed source')
        _, calls = self.run_queue()
        self.assertEqual(len(calls), 1)

    def test_new_model_recipe_invalidates_only_its_own_current_candidate(self):
        self.receipt()
        name = 'tools/blender/catalog_realism/refinements/'
        self.write(name+'unrelated.py', b'# other model correction')
        result, calls = self.run_queue()
        self.assertEqual((result['alreadyCurrent'], calls), (1, []))
        self.write(name+'fixture.py', b'# local model correction')
        _, calls = self.run_queue()
        self.assertEqual(len(calls), 1)
        result, calls = self.run_queue(stage='render')
        self.assertEqual((result['remaining'], calls), (1, []))

    def test_changed_model_recipe_retries_prior_failure(self):
        name = 'tools/blender/catalog_realism/refinements/fixture.py'
        self.write(name, b'# first recipe')
        self.run_queue(fail=True)
        _, skipped = self.run_queue()
        self.assertEqual(skipped, [])
        self.write(name, b'# corrected local recipe')
        _, calls = self.run_queue()
        self.assertEqual(len(calls), 1)

    def test_renderer_revision_rerenders_without_reauthoring_model(self):
        self.receipt()
        self.write('renderer.py', b'fixed rendering')
        result, authored = self.run_queue()
        self.assertEqual((result['alreadyCurrent'], authored), (1, []))
        _, rendered = self.run_queue(stage='render')
        self.assertEqual(len(rendered), 1)

    def test_changed_candidate_requires_rebuild_before_rendering(self):
        self.receipt()
        self.write('candidate.glb', b'changed output')
        result, rendered = self.run_queue(stage='render')
        self.assertEqual((result['remaining'], rendered), (1, []))
        _, authored = self.run_queue()
        self.assertEqual(len(authored), 1)

    def test_shared_status_input_is_hashed_once_per_run_and_never_across_runs(self):
        self.receipt()
        other = {**self.item, 'id': 'another', 'outputs': {'receipt': 'another-receipt.json'}}
        self.write('another-receipt.json', (self.root/'receipt.json').read_bytes())
        self.json('assets-source/catalog-realism/catalog.json', {'items': [self.item, other]})
        original = Path.read_bytes
        reads = []
        def read(path):
            if path == self.root/'author.py':
                reads.append(path)
            return original(path)
        with patch.object(Path, 'read_bytes', read):
            result, calls = self.run_queue()
            self.assertEqual((result['alreadyCurrent'], calls, len(reads)), (2, [], 1))
            self.run_queue()
            self.assertEqual(len(reads), 2)

    def test_status_cache_rehashes_same_length_file_after_metadata_change(self):
        record = self.write('status.bin', b'old')
        cache = {}
        self.assertTrue(QUEUE['current'](self.root, record, cache))
        file = self.root/record['path']; prior = file.stat()
        file.write_bytes(b'new')
        os.utime(file, ns=(prior.st_atime_ns, prior.st_mtime_ns+1000000))
        self.assertFalse(QUEUE['current'](self.root, record, cache))

    def test_status_cache_distinguishes_expected_hash_and_byte_count(self):
        record = self.write('status.bin', b'old')
        cache = {}
        self.assertTrue(QUEUE['current'](self.root, record, cache))
        self.assertFalse(QUEUE['current'](self.root, {**record, 'sha256': '0'*64}, cache))
        self.assertFalse(QUEUE['current'](self.root, {**record, 'bytes': 4}, cache))
        self.assertTrue(QUEUE['current'](self.root, {**record, 'bytes': 3}, cache))

    def test_file_changed_during_status_hash_is_not_current_or_cached(self):
        record = self.write('status.bin', b'old')
        cache = {}; original = Path.read_bytes
        def read(path):
            data = original(path)
            if path == self.root/record['path']:
                prior = path.stat(); path.write_bytes(b'new')
                os.utime(path, ns=(prior.st_atime_ns, prior.st_mtime_ns+1000000))
            return data
        with patch.object(Path, 'read_bytes', read):
            self.assertFalse(QUEUE['current'](self.root, record, cache))
        self.assertEqual(cache, {})


if __name__ == '__main__':
    unittest.main()
