from pathlib import Path
from collections import Counter
import math,runpy,unittest
ROOT=Path(__file__).resolve().parents[1]
class RoundFixtureTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.h=runpy.run_path(str(ROOT/'tools/blender/catalog_realism/refinements/round_fixture_construction.py'))
 def closed(self,mesh,limit=15000):
  p,f=mesh;edges=Counter(tuple(sorted((a,b))) for v in f for a,b in zip(v,v[1:]+v[:1]))
  self.assertEqual(set(edges.values()),{2});self.assertLess(sum(len(v)-2 for v in f),limit)
 def test_basin_preserves_measured_floor_and_extent_with_more_continuous_contours(self):
  profiles=[(.72,.72,0),(.9,.92,.015),(1,1,.097),(.99,.99,.1),(.95,.94,.096),(.72,.69,.032),(.42,.38,.01)]
  points=[(.255*x*math.copysign(abs(math.cos(i*math.tau/48))**(2/3.5),math.cos(i*math.tau/48)),.235*y*math.copysign(abs(math.sin(i*math.tau/48))**(2/3.5),math.sin(i*math.tau/48)),z) for x,y,z in profiles for i in range(48)]
  mesh,profile=self.h['smooth_basin'](points);self.closed(mesh,6000)
  self.assertEqual(self.h['bounds'](mesh[0]),self.h['bounds'](points))
  self.assertAlmostEqual(mesh[0][-1][2],.01)
  slab={'min':[-.8,-.27,.003],'max':[.8,.27,.027]}
  cutter=self.h['worktop_aperture'](profile,self.h['bounds'](points),slab);self.closed(cutter,6000)
  self.assertLess(self.h['bounds'](cutter[0])['min'][2],slab['min'][2])
  self.assertGreater(self.h['bounds'](cutter[0])['max'][2],slab['max'][2])
  with self.assertRaises(ValueError):self.h['smooth_basin'](points[:-1])
 def test_spun_shade_keeps_both_openings_and_measured_shell(self):
  points=[(r*math.cos(i*math.tau/48),r*math.sin(i*math.tau/48),z) for r,z in [(.022,.1),(.09,0),(.084,0),(.018,.095)] for i in range(48)]
  mesh=self.h['spun_shade'](points);self.closed(mesh,1000)
  self.assertTrue(all(math.hypot(p[0],p[1])>=.018-1e-6 for p in mesh[0]))
 def test_ring_closes_the_original_tapered_overlap_with_smooth_uniform_stock(self):
  points=[]
  for i in range(49):
   a=i*math.tau/48;r=.012*(1-.75*i/48)
   for j in range(8):
    t=j*math.tau/8;points.append(((.35+r*math.cos(t))*math.cos(a),(.39+r*math.cos(t))*math.sin(a),.02+r*math.sin(t)))
  mesh=self.h['smooth_ring'](points);self.closed(mesh,5000)
  self.assertEqual(len(mesh[0]),128*16)
  with self.assertRaises(ValueError):self.h['smooth_ring'](points[:-8])
 def test_small_vent_seats_into_lid_without_changing_its_thickness(self):
  box={'min':[.04,.02,.2397],'max':[.08,.06,.2517]}
  target=self.h['vent_target'](box,.23618)
  self.assertAlmostEqual(target['min'][2],.23518)
  self.assertAlmostEqual(target['max'][2]-target['min'][2],.012)
if __name__=='__main__':unittest.main()
