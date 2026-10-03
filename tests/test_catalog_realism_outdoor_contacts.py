from pathlib import Path
from collections import Counter
import math,runpy,unittest
ROOT=Path(__file__).resolve().parents[1]
class OutdoorContactsTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.h=runpy.run_path(str(ROOT/'tools/blender/catalog_realism/refinements/outdoor_contacts.py'))
 def closed(self,mesh):
  points,faces=mesh;edges=Counter(tuple(sorted((a,b))) for f in faces for a,b in zip(f,f[1:]+f[:1]))
  self.assertEqual(set(edges.values()),{2});self.assertTrue(all(math.isfinite(v) for p in points for v in p))
 def test_shower_is_one_closed_continuous_sweep_in_its_original_envelope(self):
  path=[(0,.185,.036),(0,.181,.9),(0,.160,1.690),(0,.090,2.040),(0,-.053,2.2),(0,-.241,2.255),(0,-.38,2.225)]
  box={'min':[-.066,-.39,.036],'max':[.066,.223,2.29]}
  mesh=self.h['shower_sweep'](path,box,.034);self.closed(mesh)
  self.assertLess(sum(len(f)-2 for f in mesh[1]),15000)
  actual=self.h['bounds'](mesh[0]);self.assertAlmostEqual(actual['min'][2],.032)
  self.assertAlmostEqual(actual['max'][2],2.29)
  self.assertEqual(len(mesh[0])%24,0)
 def test_bistro_braces_meet_the_original_inclined_frames_at_the_same_height(self):
  for ends,z,expected in [(((-.238,.011),(.208,.763)),.077,-.1988563829787234),(((.227,.011),(-.191,.467)),.087,.1573333333)]:
   self.assertAlmostEqual(self.h['line_y'](ends,z),expected,places=9)
  with self.assertRaises(ValueError):self.h['line_y'](((0,0),(1,1)),2)
 def test_rounded_water_handles_are_closed_and_neck_connects_measured_rose(self):
  path=[(-.088,0,.24),(-.081,0,.325),(-.04,0,.359),(.041,0,.359),(.078,0,.325),(.086,0,.24)]
  mesh=self.h['handle'](path,.012,{'min':[-.1,-.012,.228],'max':[.098,.012,.371]});self.closed(mesh)
  neck=self.h['neck']((.389,0,.292),(.4062,0,.3049),(.8,0,.6));self.closed(neck)
  self.assertLess(sum(len(f)-2 for f in neck[1]),200)
  with self.assertRaises(ValueError):self.h['neck']((0,0,0),(.3,0,.3),(.8,0,.6))
if __name__=='__main__':unittest.main()
