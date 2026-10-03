from pathlib import Path
import runpy,unittest
ROOT=Path(__file__).resolve().parents[1]
class KettleVentTests(unittest.TestCase):
 def test_plate_follows_dome_with_uniform_thickness_and_original_xy(self):
  h=runpy.run_path(str(ROOT/'tools/blender/catalog_realism/refinements/kettle_vent_contact.py'))
  points=[(x,y,z) for z in (.86,.867) for x,y in ((.05,-.06),(.16,-.06),(.16,.06),(.05,.06))]
  height=lambda x,y:.89-.6*x*x-.6*y*y
  new=h['seat_vertices'](points,height,-.0005,.003)
  self.assertEqual([v[:2] for v in new],[v[:2] for v in points])
  for a,b in zip(new[:4],new[4:]):self.assertAlmostEqual(b[2]-a[2],.003)
  for p in new[:4]:self.assertAlmostEqual(p[2]-height(*p[:2]),-.0005)
  self.assertLess(max(v[2] for v in new),.95)
  with self.assertRaises(ValueError):h['seat_vertices'](points,lambda x,y:1.5,0,.003)
 def test_plate_has_interior_sampling_and_closed_topology(self):
  from collections import Counter
  h=runpy.run_path(str(ROOT/'tools/blender/catalog_realism/refinements/kettle_vent_contact.py'))
  box={'min':[.05,-.06,.86],'max':[.16,.06,.867]}
  points,faces=h['conformed_disc'](box,lambda x,y:.89-.6*x*x-.6*y*y,-.0005,.003)
  edges=Counter(tuple(sorted((a,b))) for f in faces for a,b in zip(f,f[1:]+f[:1]))
  self.assertEqual(set(edges.values()),{2})
  self.assertGreater(len(points),300)
  self.assertLess(sum(len(f)-2 for f in faces),900)
if __name__=='__main__':unittest.main()
