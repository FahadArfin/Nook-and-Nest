from pathlib import Path
from collections import Counter
import math,runpy,unittest
M=runpy.run_path(str(Path(__file__).parents[1]/'tools/blender/catalog_realism/refinements/final_seating_fixtures.py'))

def closed(test,mesh):
    v,f=mesh;test.assertTrue(all(math.isfinite(x) for p in v for x in p))
    edges=Counter(tuple(sorted((row[i],row[(i+1)%len(row)]))) for row in f for i in range(len(row)))
    test.assertEqual(set(edges.values()),{2})

class FinalFixtures(unittest.TestCase):
    def test_rays_are_closed_shallow_inlays_with_preserved_footprint(self):
        source=[(.44,0,.0054),(.62,.045,.022),(.8,0,.0054),(.62,-.045,.022)]
        mesh=M['sun_ray'](source,.0203,.022);closed(self,mesh);b=M['bounds'](mesh[0])
        self.assertEqual(b,{'min':[.44,-.045,.0203],'max':[.8,.045,.022]})
        with self.assertRaises(ValueError):M['sun_ray'](source,.005,.022)

    def test_five_drawers_preserve_outer_front_envelope_and_gap(self):
        boxes=[{'min':[-.323,-.2265,.097+i*(1.1/3)],'max':[.323,-.2039,.4496666666667+i*(1.1/3)]} for i in range(3)]
        plan=M['drawer_plan'](boxes);self.assertEqual(len(plan),5)
        self.assertEqual(plan[0]['min'],boxes[0]['min']);self.assertEqual(plan[-1]['max'],boxes[-1]['max'])
        for a,b in zip(plan,plan[1:]):self.assertAlmostEqual(b['min'][2]-a['max'][2],.014)

    def test_arch_end_stock_matches_piers_and_meets_top(self):
        piers=[{'min':[-.405,-.2485,0],'max':[-.315,-.1295,.2661]},{'min':[-.405,.1295,0],'max':[-.315,.2485,.2661]}]
        mesh,spring=M['arch_bridge'](piers,{'min':[-.6,-.35,.3296],'max':[.6,.35,.38]});closed(self,mesh)
        box=M['bounds'](mesh[0]);self.assertEqual(box['min'][0],-.405);self.assertEqual(box['max'][0],-.315)
        self.assertAlmostEqual(box['max'][2],.3446);self.assertAlmostEqual(box['min'][2],spring)

    def test_spreader_passes_through_source_leg_centerlines(self):
        points=[]
        for i in range(3):
            angle=i*math.tau/3
            for r,z in ((.24,0),(.04,1.24)):
                for j in range(8):
                    a=j*math.tau/8;points.append((r*math.cos(angle)+.015*math.cos(a),r*.9*math.sin(angle)+.015*math.sin(a),z))
        contacts,tops,center,rx,ry=M['tripod_anchors'](points,.576)
        self.assertEqual(len(contacts),3);closed(self,M['ring'](center,rx,ry,.006))
        for i,p in enumerate(contacts):self.assertLess(math.dist(p,(center[0]+rx*math.cos(i*math.tau/3),center[1]+ry*math.sin(i*math.tau/3),.576)),1e-9)

    def test_existing_open_shade_has_no_disc_spanning_either_aperture(self):
        points=[(r*math.cos(i*math.tau/48),r*.9*math.sin(i*math.tau/48),z) for r,z in [(.22,1.59),(.294,1.15),(.286,1.15),(.212,1.59)] for i in range(48)]
        mesh=M['hollow_shade'](points);closed(self,mesh)
        self.assertEqual(len(mesh[0]),384)
        self.assertTrue(all(math.hypot(p[0],p[1])>.18 for p in mesh[0]))

if __name__=='__main__':unittest.main()
