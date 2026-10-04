from collections import Counter
from pathlib import Path
import math
import runpy
import unittest

API=runpy.run_path(str(Path(__file__).resolve().parents[1]/'tools/blender/catalog_realism/refinements/laundry_construction.py'))


def ring(hx,hy,rx,ry,z):
    centers=[(hx-rx,hy-ry),(-hx+rx,hy-ry),(-hx+rx,-hy+ry),(hx-rx,-hy+ry)]
    return [(x+rx*math.cos((q+j/6)*math.pi/2),y+ry*math.sin((q+j/6)*math.pi/2),z) for q,(x,y) in enumerate(centers) for j in range(7)]


def assert_closed(test,g):
    vertices,faces=g
    edges=Counter(tuple(sorted((a,b))) for f in faces for a,b in zip(f,f[1:]+f[:1]))
    test.assertEqual(set(edges.values()),{2})
    test.assertTrue(all(math.dist(vertices[a],vertices[b])>1e-9 for a,b in edges))
    test.assertLess(sum(len(f)-2 for f in faces),18000)
    for f in faces:
        a,b,c=[vertices[i] for i in f[:3]];u=[b[i]-a[i] for i in range(3)];v=[c[i]-a[i] for i in range(3)]
        cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
        test.assertGreater(sum(x*x for x in cross),1e-24)


class LaundryTests(unittest.TestCase):
    def test_molded_basket_stays_hollow_closed_and_in_original_envelope(self):
        stations=[(.24,.14,.09,.09,0),(.296,.19,.13,.13,.225),(.305,.20,.137,.137,.237),(.303,.197,.137,.137,.248),(.293,.188,.13,.13,.243),(.235,.135,.09,.09,.014)]
        points=[p for row in stations for p in ring(*row)]+[(0,0,.014),(0,0,0)]
        geometry=API['hollow_container'](points);assert_closed(self,geometry)
        self.assertEqual(API['bounds'](geometry[0]),API['bounds'](points))
        # The only central vertices are the separate inside/outside floors.
        self.assertEqual(sorted(p[2] for p in geometry[0] if abs(p[0])+abs(p[1])<1e-8),[0,.014])

    def test_cloth_sack_keeps_suspension_rim_and_nested_inner_floor(self):
        stations=[(.121,.146,.03,.03,.135),(.143,.176,.034,.034,.674),(.147,.180,.034,.034,.701),(.136,.168,.034,.034,.699),(.132,.163,.03,.03,.158)]
        points=[p for row in stations for p in ring(*row)]+[(0,0,.158),(0,0,.135)]
        geometry=API['hollow_container'](points,True);assert_closed(self,geometry)
        box=API['bounds'](geometry[0]);self.assertAlmostEqual(box['max'][2],.701)
        floor=[p for p in geometry[0] if abs(p[2]-.158)<1e-9]
        self.assertLess(max(abs(p[0]) for p in floor),.123)
        self.assertLess(max(abs(p[1]) for p in floor),.148)

    def test_spatial_hose_and_closed_ribs_have_no_duplicate_capped_seam(self):
        path=[(-.1,-.14,.16),(-.13,-.17,.28),(-.16,-.18,.5),(-.15,-.16,.75),(-.13,-.1,1.2),(-.1,-.075,1.42)]
        smooth=API['_design']['rounded_path'](path,cut=.06,spacing=.008)
        assert_closed(self,API['tube'](smooth,.014,20))
        loop=[(.02*math.cos(j*math.tau/24),.02*math.sin(j*math.tau/24),.3) for j in range(24)]
        assert_closed(self,API['tube'](loop,.0018,8,True))

    def test_flat_iron_profiles_remain_finite_and_closed(self):
        outline=[(0,-.15),(.028,-.12),(.055,-.07),(.07,0),(.068,.10),(.052,.13),(-.052,.13),(-.068,.10),(-.07,0),(-.055,-.07),(-.028,-.12)]
        source=[(x*s,y*s,z) for s,z in [(1,0),(.95,.025),(.7,.06)] for x,y in outline]
        geometry=API['iron_shell'](source);assert_closed(self,geometry)
        for side in ('min','max'):
            for actual,expected in zip(API['bounds'](geometry[0])[side],API['bounds'](source)[side]):self.assertAlmostEqual(actual,expected,places=12)


if __name__=='__main__':unittest.main()
