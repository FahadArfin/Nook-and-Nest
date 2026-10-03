import math
from pathlib import Path
import runpy
import unittest
from collections import Counter

API=runpy.run_path(str(Path(__file__).resolve().parents[1]/'tools/blender/catalog_realism/refinements/compact_construction.py'))


def edges(faces):
    return Counter(tuple(sorted((a,b))) for face in faces for a,b in zip(face,face[1:]+face[:1]))


class CompactConstructionTests(unittest.TestCase):
    def test_trap_is_closed_and_connects_drain_to_rear(self):
        path=API['trap_path']();vertices,faces=API['tube'](path)
        self.assertEqual(set(edges(faces).values()),{2})
        self.assertEqual(path[0],(0,-.02,.701))
        self.assertEqual(path[-1],(0,.255,.62))
        self.assertLess(min(p[2] for p in path),.53)
        self.assertGreater(path[-1][2],min(p[2] for p in path)+.09)
        self.assertLess(sum(len(f)-2 for f in faces),2000)
        self.assertTrue(all(math.isfinite(v) for p in vertices for v in p))

    def test_closed_ring_has_no_caps_or_open_edges(self):
        geometry=API['tube']([(0,.02*math.cos(i*math.tau/32),.02*math.sin(i*math.tau/32)) for i in range(32)],.003,8,True)
        self.assertEqual(set(edges(geometry[1]).values()),{2})
        self.assertEqual(len(geometry[0]),256)

    def test_canopy_has_sewn_shell_and_sag_between_ribs(self):
        source=[(x,-.24*math.sin(i*math.pi/20),.8+.21*math.cos(i*math.pi/20)) for x in (-.19,.19) for i in range(11)]
        vertices,faces=API['canopy'](source)
        self.assertEqual(set(edges(faces).values()),{2})
        row=16*17
        self.assertAlmostEqual(vertices[row+8][2],vertices[row][2]-.006,places=7)
        self.assertAlmostEqual(vertices[32*17+8][2],vertices[32*17][2],places=7)
        self.assertLess(sum(len(f)-2 for f in faces),5000)

    def test_fold_variation_keeps_weighted_hem_fixed(self):
        box={'min':[-1,-.11,0],'max':[1,.07,2.07]}
        for x in (-.95,-.65,.4,.9):
            for y in (-.11,-.02,.07):
                self.assertEqual(API['drapery_point']((x,y,0),box),(x,y,0))
                point=API['drapery_point']((x,y,1),box)
                self.assertGreaterEqual(point[1],-.11)
                self.assertLessEqual(point[1],.07)
                self.assertLessEqual(abs(point[0]-x),.012)

    def test_profile_preserves_measured_endpoints(self):
        source=[(0,-.24*math.sin(i*math.pi/20),.8+.21*math.cos(i*math.pi/20)) for i in range(11)]
        result=API['interpolated_profile'](source)
        self.assertEqual(result[0],source[0]);self.assertEqual(result[-1],source[-1])
        self.assertTrue(all(a[1]>=b[1] and a[2]>=b[2] for a,b in zip(result,result[1:])))


if __name__=='__main__':unittest.main()
