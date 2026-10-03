"""The native probe must reject stale inputs without opening Blender here."""
from pathlib import Path
import json
import runpy
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
API = runpy.run_path(str(ROOT/'tools/blender/catalog_realism/editability_probe.py'))


class EditabilityProbeTests(unittest.TestCase):
    def test_bound_candidate_and_dependency_reject_mutated_bytes_or_size(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root/'source.blend').write_bytes(b'BLENDER-editable-fixture')
            record = API['file_record'](root, 'source.blend')
            self.assertEqual(API['check_record'](root, record), record)
            with self.assertRaisesRegex(ValueError, 'size changed'):
                API['check_record'](root, {**record, 'bytes': record['bytes']+1})
            (root/'source.blend').write_bytes(b'BLENDER-mutated-fixture!')
            with self.assertRaisesRegex(ValueError, 'dependency changed'):
                API['check_record'](root, record)
            with self.assertRaises(ValueError):
                API['file_record'](root, '../outside.blend')

    def test_representatives_bind_current_editable_outputs_and_cover_protected_and_modifier_cases(self):
        items = {x['id']: x for x in json.loads((ROOT/'assets-source/catalog-realism/catalog.json').read_text())['items']}
        ids = API['REPRESENTATIVES']
        self.assertEqual(len(ids), len(set(ids)))
        self.assertTrue(8 <= len(ids) <= 12)
        self.assertTrue({'sofa', 'queen-bed', 'spruce-tree', 'vessel-sink', 'reef-aquarium',
                         'sonos-sub-mini', 'landscape-painting', 'sculpture-glass-table'} <= set(ids))
        for ident in ids:
            item = items[ident]
            self.assertEqual(item['outputs']['sourceBlend'], f'assets-source/catalog-realism/candidates/{ident}.blend')
            receipt = json.loads((ROOT/item['outputs']['receipt']).read_text())
            API['check_record'](ROOT, receipt['outputs']['sourceBlend'])


if __name__ == '__main__':
    unittest.main()
