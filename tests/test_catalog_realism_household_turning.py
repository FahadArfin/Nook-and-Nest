from pathlib import Path
from collections import Counter
import math,runpy,unittest
ROOT=Path(__file__).resolve().parents[1]
class HouseholdTurningTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.h=runpy.run_path(str(ROOT/'tools/blender/catalog_realism/refinements/household_turning.py'))
 def test_dome_is_smooth_closed_shell_with_original_extent(self):
  profile=[(1,0),(.94,.25),(.72,.65),(.36,.93),(0,1)]
  box={'min':[-.32,-.35,.66],'max':[.32,.35,.89]}
  p,f=self.h['kettle_shell'](profile,box,'lid');edges=Counter()
  for face in f:
   for a,b in zip(face,face[1:]+face[:1]):edges[tuple(sorted((a,b)))]+=1
  self.assertEqual(set(edges.values()),{2})
  for side in ('min','max'):
   for a in range(3):self.assertAlmostEqual(self.h['bounds'](p)[side][a],box[side][a],places=10)
  self.assertLess(sum(len(v)-2 for v in f),15000)
  self.assertGreater(len(set(round(v[2],7) for v in p)),30)
 def test_spline_keeps_measured_turning_stations_and_monotonicity(self):
  rows=[(0,1),(.36,.93),(.72,.65),(.94,.25),(1,0)]
  new=self.h['monotone'](rows,6,zero_start=True)
  for row in rows:self.assertIn(row,new)
  self.assertTrue(all(a[1]>=b[1] for a,b in zip(new,new[1:])))
  with self.assertRaises(ValueError):self.h['monotone']([(0,0),(0,1)])
 def test_mug_rounding_retains_endpoints_and_exact_component_envelope(self):
  points=[(.024,0,.082),(.045,0,.084),(.055,0,.077),(.058,0,.066),(.057,0,.039),(.05,0,.026),(.04,0,.023),(.024,0,.03)]
  box={'min':[.018,-.006,.017],'max':[.064,.006,.09]}
  p,f=self.h['mug_handle'](points,.006,box)
  for s in ('min','max'):
   for a in range(3):self.assertAlmostEqual(self.h['bounds'](p)[s][a],box[s][a],places=10)
  self.assertGreater(len(p),96);self.assertLess(len(p),4000)
if __name__=='__main__':unittest.main()
