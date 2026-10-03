from collections import Counter
from pathlib import Path
import math,runpy,unittest

BASE=Path(__file__).resolve().parents[1]/'tools/blender/catalog_realism/refinements'
T=runpy.run_path(str(BASE/'turned_684.py'))
U=runpy.run_path(str(BASE/'utility_684.py'))


def closed(test,g):
    v,f=g;edges=Counter((a,b) for face in f for a,b in zip(face,face[1:]+face[:1]))
    test.assertTrue(all(count==1 and edges[b,a]==1 for (a,b),count in edges.items()))
    test.assertTrue(all(math.dist(v[a],v[b])>1e-10 for a,b in edges))
    test.assertTrue(all(math.isfinite(x) for p in v for x in p))


class Reviewed684Tests(unittest.TestCase):
    def test_tilted_plate_preserves_bounds_with_closed_rounded_rim(self):
        v=[(.11*math.cos(j*math.tau/32),.11*math.sin(j*math.tau/32)*.6-.008*k,.11*math.sin(j*math.tau/32)*.8+.006*k) for k in range(2) for j in range(32)]
        f=[tuple(range(32)),tuple(range(32,64))]+[(j,(j+1)%32,(j+1)%32+32,j+32) for j in range(32)]
        g=T['rounded_cylinder'](v,f);closed(self,g)
        for side in ('min','max'):
            for a,b in zip(T['bounds'](v)[side],T['bounds'](g[0])[side]):self.assertAlmostEqual(a,b,12)
        self.assertLess(sum(len(face)-2 for face in g[1]),1400)

    def test_arbitrary_plate_is_rejected(self):
        with self.assertRaises(ValueError):T['rounded_cylinder']([(0,0,0)],[(0,)])

    def test_secretary_has_open_compartment_and_closed_panels(self):
        box={'min':[-.49,-.07875,0],'max':[.49,.24,1.48]}
        g=U['secretary_case'](box);closed(self,g)
        self.assertEqual(U['bounds'](g[0]),box)
        # No face spans the front opening at writing/cubby height.
        for face in g[1]:
            pts=[g[0][i] for i in face]
            if all(abs(p[1]+.07875)<1e-10 for p in pts):
                z=sum(p[2] for p in pts)/len(pts);x=sum(p[0] for p in pts)/len(pts)
                self.assertTrue(z<=.79 or z>=1.45 or abs(x)>=.46)

    def test_label_follows_surface_without_buried_center(self):
        body={'min':[-.0623,-.06132,.0072],'max':[.04188,.06132,.3558]}
        box={'min':[-.04563,-.06071,.13459],'max':[.02521,-.05948,.27794]}
        g=U['wrapped_label'](box,body);closed(self,g)
        for x,y,z in g[0]:
            depth=U['label_y'](x,body,0)-y
            self.assertGreaterEqual(depth,.0001799);self.assertLessEqual(depth,.0014001)
        self.assertLess(sum(len(f)-2 for f in g[1]),600)

    def test_cavity_backing_is_oval_and_closed(self):
        box={'min':[-.195,.218,.282],'max':[.195,.245,.646]}
        g=U['cylinder'](box,1);closed(self,g)
        for x,y,z in g[0]:self.assertLessEqual((x/.195)**2+((z-.464)/.182)**2,1.000001)


if __name__=='__main__':unittest.main()
