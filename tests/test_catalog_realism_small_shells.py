from collections import Counter
from pathlib import Path
import runpy
import unittest

ROOT=Path(__file__).resolve().parents[1]/'tools/blender/catalog_realism/refinements'
SHELL=runpy.run_path(str(ROOT/'small_turned_shells.py'))
LATHE=runpy.run_path(str(ROOT/'silhouette_geometry.py'))


class SmallShellTests(unittest.TestCase):
    def test_manufactured_shells_are_closed_and_bounded(self):
        for kind in ('cup','plate','nixie'):
            vertices,faces=LATHE['lathe'](SHELL['profile'](kind),{'min':[-1,-1,0],'max':[1,1,1]},48)
            edges=Counter(tuple(sorted((a,b))) for face in faces for a,b in zip(face,face[1:]+face[:1]))
            self.assertEqual(set(edges.values()),{2},kind)
            self.assertEqual(LATHE['bounds'](vertices),{'min':[-1.0,-1.0,0.0],'max':[1.0,1.0,1.0]})
            self.assertLess(sum(len(f)-2 for f in faces),2600)

    def test_nixie_crown_is_rounded_and_hollow(self):
        profile=SHELL['profile']('nixie')
        self.assertGreater(sum(.83<z<1 for r,z in profile),10)
        self.assertTrue(any(abs(r)<1e-10 and z==1 for r,z in profile))
        self.assertTrue(any(abs(r)<1e-10 and .98<z<1 for r,z in profile))

    def test_plate_center_is_recessed_below_rolled_rim(self):
        profile=SHELL['profile']('plate')
        self.assertEqual(profile[-1],(0,.35))
        self.assertGreater(max(z for r,z in profile if r>.9),.95)
        self.assertLess(profile[0][1],profile[-1][1])

    def test_pencil_has_separate_wood_and_colored_lead_regions(self):
        profile,body,lead=SHELL['pencil_profile'](.1546)
        self.assertLess(body,lead);self.assertLess(lead,1)
        self.assertAlmostEqual((lead-body)*.1546,.0102)
        self.assertEqual(profile[-1],(0,1))
        with self.assertRaises(ValueError):SHELL['pencil_profile'](.01)


if __name__=='__main__':unittest.main()
