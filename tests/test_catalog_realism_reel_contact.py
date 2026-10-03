"""Only the rejected cord reel's free lead gets a guide contact correction."""
from pathlib import Path
import math,runpy,unittest

ROOT=Path(__file__).resolve().parents[1]

class ReelContactTests(unittest.TestCase):
 def test_lead_enters_source_guide_while_outlet_and_other_anchors_stay_exact(self):
  h=runpy.run_path(str(ROOT/'tools/blender/catalog_realism/refinements/reel_guide_contact.py'))
  path=[(.103,-.098,.291),(.145,-.1,.215),(.124,-.101,.056),(.078,-.102,.028)]
  guide={'min':[.091,-.119,.297],'max':[.111,-.076,.376]}
  fixed=h['seat_guide'](path,guide,.0054)
  self.assertEqual(fixed[1:],path[1:]);self.assertEqual(fixed[0][:2],path[0][:2])
  self.assertGreaterEqual(fixed[0][2]-guide['min'][2],.0054)
  self.assertLess(fixed[0][2],guide['max'][2]-.0054)
  self.assertEqual(path[0],(.103,-.098,.291))
  with self.assertRaises(ValueError):h['seat_guide']([(0,0,.291),*path[1:]],guide,.0054)
  with self.assertRaises(ValueError):h['seat_guide']([(.103,-.098,.1),*path[1:]],guide,.0054)

if __name__=='__main__':unittest.main()
