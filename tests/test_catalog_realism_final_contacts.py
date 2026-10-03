import collections
import math
import runpy
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API = runpy.run_path(str(ROOT / 'tools/blender/catalog_realism/refinements/final_contacts_864.py'))


class FinalContactsTests(unittest.TestCase):
    def test_handle_is_closed_attached_and_within_window_depth(self):
        stile = {'min': [.4565, -.0455, .0683], 'max': [.4985, .0095, 1.4134]}
        for lever in (False, True):
            vertices, faces = API['handle_parts'](stile, -.0945, .733, lever=lever)
            edges = collections.Counter((a, b) for f in faces for a, b in zip(f, f[1:] + f[:1]))
            self.assertTrue(all(edges[(b, a)] == count == 1 for (a, b), count in edges.items()))
            self.assertTrue(all(math.isfinite(v) for p in vertices for v in p))
            self.assertGreater(max(p[1] for p in vertices), stile['min'][1])
            self.assertGreaterEqual(min(p[1] for p in vertices), -.0945)
            self.assertGreaterEqual(min(p[0] for p in vertices), stile['min'][0])
            self.assertLessEqual(max(p[0] for p in vertices), stile['max'][0])

    def test_unusable_mount_or_depth_is_rejected(self):
        with self.assertRaises(ValueError):
            API['handle_parts']({'min': [0, 0, 0], 'max': [.3, .03, 1]}, -.04, .5)
        with self.assertRaises(ValueError):
            API['handle_parts']({'min': [0, 0, 0], 'max': [.042, .03, 1]}, 0, .5)


if __name__ == '__main__':
    unittest.main()
