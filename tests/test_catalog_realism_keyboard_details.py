from pathlib import Path
from collections import Counter
import runpy,unittest
ROOT=Path(__file__).resolve().parents[1]
class KeyboardDetailsTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.h=runpy.run_path(str(ROOT/'tools/blender/catalog_realism/refinements/keyboard_details.py'))
 def test_bottom_row_has_a_real_spacebar_with_separated_modifiers(self):
  boxes=self.h['bottom_row'](-.294,.137,-.09,-.063,.020,.030)
  self.assertEqual(len(boxes),8)
  self.assertEqual(boxes[0]['min'][0],-.294);self.assertAlmostEqual(boxes[-1]['max'][0],.137)
  widths=[b['max'][0]-b['min'][0] for b in boxes]
  self.assertGreater(widths[3],max(widths[:3]+widths[4:])*4)
  self.assertTrue(all(b['min'][0]-a['max'][0]>.003 for a,b in zip(boxes,boxes[1:])))
 def test_mouse_shell_is_closed_curved_and_keeps_exact_envelope(self):
  box={'min':[.22,-.0575,.0005],'max':[.3,.0575,.035]}
  p,f=self.h['mouse_shell'](box);edges=Counter()
  for face in f:
   for a,b in zip(face,face[1:]+face[:1]):edges[tuple(sorted((a,b)))]+=1
  self.assertEqual(set(edges.values()),{2})
  self.assertEqual(self.h['bounds'](p),box)
  self.assertGreater(len(p),150);self.assertLess(len(p),500)
if __name__=='__main__':unittest.main()
