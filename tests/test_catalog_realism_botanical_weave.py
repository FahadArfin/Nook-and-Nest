from pathlib import Path
import math,runpy,unittest
ROOT=Path(__file__).resolve().parents[1]
class BotanicalWeaveTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.h=runpy.run_path(str(ROOT/'tools/blender/catalog_realism/refinements/botanical_weave.py'))
 def test_petal_rounding_keeps_original_root_tip_and_raised_center(self):
  outline=[(0,0),(.23,.65),(.55,1),(.84,.55),(1,0),(.84,-.55),(.55,-1),(.23,-.65)]
  points=[(.52,0,.17)]+[(x,y*.5,math.sin(x*math.pi)*.04) for x,y in outline]
  new,faces=self.h['rounded_organs'](points,False)
  self.assertIn(points[0],new);self.assertIn(points[1],new);self.assertIn(points[5],new)
  self.assertEqual(len(faces),16)
  self.assertEqual(self.h['bounds'](new),self.h['bounds'](points))
  with self.assertRaises(ValueError):self.h['rounded_organs'](points[:-1],False)
 def test_braided_rows_remain_in_rug_envelope_and_bounded_cost(self):
  total=0
  for row in range(1,30):
   r=row*.034;box={'min':[-r-.004,-r-.004,.010],'max':[r+.004,r+.004,.018]}
   p,f=self.h['jute_row'](box,row)
   self.assertTrue(all(abs(v[0])<=1 and abs(v[1])<=1 and .0099<=v[2]<=.01800001 for v in p))
   self.assertGreater(len(set(round(v[2],5) for v in p)),4)
   total+=sum(len(face)-2 for face in f)
  self.assertLess(total+1200,31992)
if __name__=='__main__':unittest.main()
