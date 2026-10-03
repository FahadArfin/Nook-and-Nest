"""Measured window handles must sweep continuously without section flips."""
from collections import Counter
from pathlib import Path
import math
import runpy
import unittest

DIRECTORY = Path(__file__).resolve().parents[1]/'tools/blender/catalog_realism/refinements'
HELPER = runpy.run_path(str(DIRECTORY/'final_contacts_864.py'))


class FinalContactTests(unittest.TestCase):
    def test_all_measured_window_grips_have_continuous_sections_and_seated_mounts(self):
        for ident in ('window-glider', 'window-tilt-turn', 'window-transom'):
            specs = {row['name']: row for row in runpy.run_path(str(DIRECTORY/(ident+'.py')))['EVIDENCE']['objects']}
            old = specs['window_lever']['bounds']
            z = (old['min'][2]+old['max'][2])/2
            for name, spec in specs.items():
                if not name.startswith('compression_sash_stile'):
                    continue
                with self.subTest(model=ident, stile=name):
                    points, faces = HELPER['handle_parts'](spec['bounds'], old['min'][1], z,
                                                         .095 if ident=='window-glider' else .12,
                                                         ident!='window-glider')
                    edges = Counter(tuple(sorted((a,b))) for face in faces for a,b in zip(face, face[1:]+face[:1]))
                    self.assertEqual(set(edges.values()), {2})
                    # The first eight vertices belong to the mounting rose;
                    # every later group of sixteen is a constant-radius ring.
                    tube = points[8:]
                    self.assertEqual(len(tube)%16, 0)
                    centers = [tuple(sum(p[a] for p in tube[i:i+16])/16 for a in range(3))
                               for i in range(0, len(tube), 16)]
                    for i, center in enumerate(centers):
                        for point in tube[i*16:(i+1)*16]:
                            self.assertAlmostEqual(math.dist(center, point), .0055, places=10)
                    for i in range(len(centers)-1):
                        radial = [tuple(tube[k*16][a]-centers[k][a] for a in range(3)) for k in (i,i+1)]
                        self.assertGreater(sum(a*b for a,b in zip(*radial))/.0055**2, .9,
                                           'Corresponding ring vertices must not flip across the tube')
                        center_step = math.dist(centers[i], centers[i+1])
                        if center_step < .002:
                            self.assertLess(max(math.dist(tube[i*16+j], tube[(i+1)*16+j]) for j in range(16)), .004,
                                            'Short bend segments must not span the handle diameter')
                    face = spec['bounds']['min'][1]
                    self.assertGreater(centers[0][1], face-.006)
                    self.assertLess(centers[0][1], face)
                    self.assertGreater(max(p[1] for p in points[:8]), face)
                    self.assertGreaterEqual(min(p[1] for p in points), old['min'][1])


if __name__ == '__main__':
    unittest.main()
