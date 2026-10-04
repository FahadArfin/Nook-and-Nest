"""The dresser's grouped receipt retains every measured flute refinement."""
from pathlib import Path
import runpy
import unittest

ROOT = Path(__file__).resolve().parents[1]


class DresserEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.module = runpy.run_path(str(ROOT/'tools/blender/catalog_realism/refinements/designed-dresser-fluted.py'))
        self.records = [{'kind': 'source-evidenced-construction', 'component': s['name'],
                         'before': {'vertices': 20}, 'after': {'vertices': 48},
                         'bounds': s['bounds']} for s in self.module['SOURCE_COMPONENTS']]

    def test_one_bounded_group_preserves_all_156_component_records(self):
        result = self.module['group_flute_evidence'](self.records)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['kind'], 'source-evidenced-construction')
        self.assertEqual(result[0]['components'], self.records)
        self.assertEqual(result[0]['componentCount'], 156)
        self.assertLess(164 + len(result), 256)

    def test_missing_duplicate_or_unexpected_component_is_rejected(self):
        group = self.module['group_flute_evidence']
        with self.assertRaises(ValueError): group(self.records[:-1])
        with self.assertRaises(ValueError): group(self.records[:-1]+self.records[:1])
        with self.assertRaises(ValueError): group([{**r, 'kind': 'unknown'} for r in self.records])


if __name__ == '__main__': unittest.main()
