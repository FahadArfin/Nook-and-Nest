"""Round-trip evidence fingerprints must include face boundaries and UV values."""
from pathlib import Path
import runpy
import unittest

ROOT = Path(__file__).resolve().parents[1]
API = runpy.run_path(str(ROOT/'tools/blender/catalog_realism/editability_roundtrip.py'))


class RoundTripFingerprintTests(unittest.TestCase):
    def test_face_partition_and_uv_edit_change_fingerprints(self):
        digest = API['digest_rows']
        self.assertNotEqual(digest([(0, 1, 2), (2, 3, 0)], 'I'), digest([(0, 1, 2, 2, 3, 0)], 'I'))
        self.assertNotEqual(digest([(0.0, 0.0), (1.0, 1.0)], 'f'), digest([(0.0, 0.0), (1.0, .9)], 'f'))
        self.assertEqual(digest([(0.0, 0.0), (1.0, 1.0)], 'f'), digest(iter([(0.0, 0.0), (1.0, 1.0)]), 'f'))


if __name__ == '__main__':
    unittest.main()
