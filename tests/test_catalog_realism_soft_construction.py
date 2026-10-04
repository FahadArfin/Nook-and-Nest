"""Geometry contracts for exact cloth, vegetation and furniture refinements."""
from collections import Counter
from pathlib import Path
import math
import runpy
import unittest

ROOT=Path(__file__).resolve().parents[1]
API=runpy.run_path(str(ROOT/'tools/blender/catalog_realism/refinements/soft_construction.py'))
SILHOUETTE=runpy.run_path(str(ROOT/'tools/blender/catalog_realism/refinements/silhouette_geometry.py'))


def closed(test,vertices,faces):
    edges=Counter()
    for face in faces:
        test.assertGreaterEqual(len(face),3)
        test.assertEqual(len(face),len(set(face)))
        for a,b in zip(face,face[1:]+face[:1]):edges[(a,b)]+=1
    for (a,b),count in edges.items():
        test.assertEqual(count,1)
        test.assertEqual(edges[(b,a)],1)
    test.assertTrue(all(math.isfinite(v) for p in vertices for v in p))


class SoftConstructionTests(unittest.TestCase):
    def test_curved_blades_keep_envelope_and_smooth_outward_transition(self):
        blade=[(0,-.003,0),(0,.003,0),(0,-.002,.2),(0,.002,.2),(.15,0,.4)]
        points=blade*42;box=API['bounds'](points)
        vertices,faces=API['grass'](points,box)
        self.assertEqual(API['bounds'](vertices),box)
        self.assertEqual(len(vertices),42*43)
        self.assertLess(sum(len(f)-2 for f in faces),2500)
        self.assertGreater(vertices[22][0],0)
        self.assertLess(vertices[22][0],.15)
        self.assertEqual(vertices[42],(.15,0,.4))

    def test_roman_is_closed_thin_cloth_with_central_sag(self):
        box={'min':[-.588,-.06,0],'max':[.588,.002222,1.25]}
        vertices,faces=API['roman'](box)
        closed(self,vertices,faces)
        for side in ('min','max'):
            for a in range(3):self.assertAlmostEqual(API['bounds'](vertices)[side][a],box[side][a])
        edge=70*17;center=edge+8
        self.assertLess(vertices[center][2],vertices[edge][2]-.02)
        self.assertLess(sum(len(f)-2 for f in faces),11000)

    def test_braids_are_closed_interlaced_loops_with_bounded_delivery_cost(self):
        groups=API['braided_rows']();triangles=0;points=[]
        for vertices,faces in groups:
            closed(self,vertices,faces)
            triangles+=sum(len(f)-2 for f in faces);points+=vertices
        self.assertEqual(triangles,15360)
        self.assertLess(max(abs(p[0]) for p in points),.8)
        self.assertLess(max(abs(p[1]) for p in points),.5)
        self.assertAlmostEqual(max(p[2] for p in points),.06849999725818634)
        self.assertAlmostEqual(min(p[2] for p in points),.025)
        self.assertGreater(len({round(p[2],5) for p in points}),6)

    def test_tulip_profile_closes_and_has_a_slender_curved_waist(self):
        profile=API['tulip_profile']()
        self.assertTrue(all(0<=r<=1 and 0<=z<=1 for r,z in profile))
        box={'min':[-.289,-.289,0],'max':[.289,.289,.705]}
        vertices,faces=SILHOUETTE['lathe'](profile,box,64)
        closed(self,vertices,faces)
        self.assertLess(sum(len(f)-2 for f in faces),12000)
        self.assertLess(min(r for r,z in profile if .4<z<.7),.21)
        self.assertGreater(profile[-2][0],.5)

    def test_unsupported_blade_topology_is_rejected(self):
        with self.assertRaises(ValueError):API['grass']([(0,0,0)]*5,{'min':[0,0,0],'max':[1,1,1]})


if __name__=='__main__':unittest.main()
