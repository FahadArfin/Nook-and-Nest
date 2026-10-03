import collections
import math
from pathlib import Path
import runpy
import unittest

ROOT = Path(__file__).resolve().parents[1]
HELPER = ROOT / 'tools/blender/catalog_realism/refinements/reviewed_504.py'


def overlap(a, b):
    return all(min(a['max'][i], b['max'][i]) > max(a['min'][i], b['min'][i]) for i in range(3))


class Reviewed504ConstructionTests(unittest.TestCase):
    def helper(self):
        self.assertTrue(HELPER.exists(), 'Four exact source corrections are not implemented')
        return runpy.run_path(str(HELPER))

    def test_joined_clock_case_has_one_closed_shell_and_preserves_extrema(self):
        h = self.helper()
        box = {'min': [-.096,-.002298852,.043313164], 'max': [.096,.044827588,.29]}
        v, f = h['arched_shell'](box, .183396637, 64)
        edges = collections.Counter(tuple(sorted((a,b))) for face in f for a,b in zip(face,face[1:]+face[:1]))
        self.assertTrue(all(n == 2 for n in edges.values()))
        self.assertEqual(len(v)-len(edges)+len(f), 2)
        got = h['bounds'](v)
        for side in ('min','max'):
            for axis in range(3): self.assertAlmostEqual(got[side][axis],box[side][axis],places=8)
        self.assertEqual(sum(len(face)>4 for face in f),2, 'Only one planar cap per front/rear')
        self.assertLess(sum(len(face)-2 for face in f), 300)

    def test_two_chair_mounts_bridge_measured_seat_and_back_without_extending_outline(self):
        h = self.helper(); rows = h['chair_supports']()
        bars = [p for p in rows if p['role']=='back-upright']
        self.assertEqual(len(bars),2)
        seat = {'min':[-.241,.197,.3625], 'max':[.241,.2354,.40724]}
        back = {'min':[-.26,.168,.450337], 'max':[.26,.272,.82]}
        for bar in bars:
            box = h['bounds'](h['part_geometry'](bar)[0])
            self.assertTrue(overlap(box,seat)); self.assertTrue(overlap(box,back))
            self.assertTrue(h['inside'](box,{'min':[-.26,-.285,0],'max':[.26,.285,.82]}))
        self.assertLess(sum((len(h['part_geometry'](p)[1])*2) for p in rows),200)

    def test_sofa_rails_join_posts_and_existing_deck_arm_and_back(self):
        h = self.helper(); rows = h['sofa_supports']()
        posts = [p for p in rows if p['role']=='rear-upright']; rails=[p for p in rows if p['role']=='back-rail']
        self.assertEqual(len(posts),3); self.assertEqual(len(rails),2)
        deck={'min':[-.9847,-.43,.208], 'max':[.9847,.40571,.333126]}
        for post in posts:
            self.assertTrue(overlap(post['bounds'],deck))
            self.assertTrue(all(overlap(post['bounds'],r['bounds']) for r in rails))
        for p in rows:
            self.assertTrue(h['inside'](p['bounds'],{'min':[-1.025,-.43,0], 'max':[1.025,.43,.83]}))
        self.assertTrue(any(p['bounds']['max'][2]>.69 for p in rails))

    def test_mirror_backing_captures_every_original_ray_and_touches_frame(self):
        h=self.helper(); box,spring=h['mirror_backing']()
        # Measured source ray centers. Testing ellipse interior, not just its AABB.
        centers=[(.149689,1.20627),(.112675,1.254613),(.060862,1.286588),(.001056,1.297997),(-.05889,1.28734),(-.11110,1.25602),(-.148719,1.208145)]
        for x,z in centers:
            self.assertLess((x/(box['max'][0]))**2+((z-spring)/(box['max'][2]-spring))**2, .95)
        self.assertLess(box['min'][2],1.08075)
        self.assertLess(box['min'][1],.018)
        self.assertGreater(box['max'][1],.018)
        self.assertTrue(h['inside'](box,{'min':[-.35,-.06,0], 'max':[.35,.116,1.358518362]}))


if __name__=='__main__': unittest.main()
