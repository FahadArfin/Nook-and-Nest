from collections import Counter
from pathlib import Path
import math
import runpy
import unittest

API=runpy.run_path(str(Path(__file__).resolve().parents[1]/'tools/blender/catalog_realism/refinements/room_construction.py'))


def closed(test,g):
    v,f=g;edges=Counter((a,b) for face in f for a,b in zip(face,face[1:]+face[:1]))
    test.assertTrue(all(count==1 and edges[b,a]==1 for (a,b),count in edges.items()))
    test.assertTrue(all(math.dist(v[a],v[b])>1e-10 for a,b in edges))
    test.assertLess(sum(len(face)-2 for face in f),14000)


class RoomConstructionTests(unittest.TestCase):
    def test_cubby_has_actual_open_front_and_closed_inner_shell(self):
        box={'min':[-.14,-.23,.31],'max':[.14,.12,.77]};entry={'min':[-.096,-.25,.33],'max':[.096,-.218,.75]}
        geometry=API['cubby'](box,entry);closed(self,geometry)
        self.assertEqual(API['bounds'](geometry[0]),box)
        # Front-panel faces all stop outside the oval opening.
        for face in geometry[1][:512]:
            pts=[geometry[0][i] for i in face]
            if all(abs(p[1]+.23)<1e-8 for p in pts):
                x=sum(p[0] for p in pts)/len(pts);z=sum(p[2] for p in pts)/len(pts)
                self.assertGreater((x/(.192*.41))**2+((z-.54)/(.42*.445))**2,.99)

    def test_opal_globe_is_closed_smooth_and_keeps_oval_envelope(self):
        box={'min':[-.115,-.135,.15],'max':[.115,.06,.4]};g=API['globe'](box);closed(self,g)
        self.assertEqual(API['bounds'](g[0]),box)

    def test_ceramic_loft_has_opposed_edges_and_closed_caps(self):
        g=API['rounded_loft']({'min':[-.12,-.15,0],'max':[.12,.22,.25]},[(.94,.94,0),(1,1,.04),(1,1,.12),(.93,.98,.75),(.97,1,1)],.06)
        closed(self,g)

    def test_canopy_cloth_preserves_rib_endpoints_and_closed_thickness(self):
        center=(.07,0,2.58);edge=[(.07+1.63*math.cos(i*math.pi/8),1.69*math.sin(i*math.pi/8),2.239 if i%2==0 else 2.191) for i in range(16)]
        points=[center,*edge]+[(x,y,z-.003) for x,y,z in [center,*edge]]
        g=API['canopy'](points);closed(self,g)
        for p in edge[::2]:self.assertTrue(any(math.dist(p,v)<1e-9 for v in g[0]))
        self.assertGreaterEqual(min(p[2] for p in g[0]),2.1879)


if __name__=='__main__':unittest.main()
