from collections import Counter
from pathlib import Path
import math
import runpy
import unittest

ROOT=Path(__file__).resolve().parents[1]/'tools/blender/catalog_realism/refinements'
API=runpy.run_path(str(ROOT/'utility_construction.py'))


def closed(test,geometry):
    points,faces=geometry
    edges=Counter(tuple(sorted((a,b))) for face in faces for a,b in zip(face,face[1:]+face[:1]))
    test.assertEqual(set(edges.values()),{2})
    test.assertTrue(all(math.dist(points[a],points[b])>1e-9 for a,b in edges))


class UtilityConstructionTests(unittest.TestCase):
    def test_vertical_bend_has_constant_radius_and_no_collapsed_sections(self):
        path=API['_design']['rounded_path']([(0,0,1),(.2,0,1),(.2,0,.1),(0,0,.1)],cut=.06,spacing=.01)
        geometry=API['tube'](path,.009,20);closed(self,geometry)
        for i,p in enumerate(path):
            for v in geometry[0][i*20:(i+1)*20]:self.assertAlmostEqual(math.dist(p,v),.009,places=10)
        with self.assertRaises(ValueError):API['tube']([(0,0,0),(0,1,0),(0,2,0)],.01)

    def test_guard_keeps_closed_solid_and_original_envelope(self):
        points=[]
        for r,y in [(.09,-.02),(.09,.02),(.10,-.02),(.10,.02)]:
            points += [(r*math.cos(math.pi*j/28),y,.11+r*math.sin(math.pi*j/28)) for j in range(29)]
        geometry=API['guard'](points,[()] * 114,math.pi)
        closed(self,geometry)
        self.assertEqual(API['bounds'](geometry[0]),API['bounds'](points))
        self.assertLess(sum(len(f)-2 for f in geometry[1]),1000)
        points[5]=(points[5][0]+.001,points[5][1],points[5][2])
        with self.assertRaises(ValueError):API['guard'](points,[()] * 114,math.pi)

    def test_source_path_topology_is_required(self):
        with self.assertRaises(ValueError):API['original_centers']([(0,0,0)]*31)

    def test_lamp_shells_have_open_mouths_and_no_collapsed_closure_ring(self):
        for kind in ('shade','hem'):
            profile=API['lamp_profile'](kind)
            self.assertGreater(min(r for r,z in profile),.4)
            closed(self,API['_shell']['lathe'](profile,{'min':[-.2,-.2,0],'max':[.2,.2,.3]},48))


if __name__=='__main__':unittest.main()
