from pathlib import Path
import math,runpy,unittest
ROOT=Path(__file__).resolve().parents[1]
class HouseholdUpholsteryTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.h=runpy.run_path(str(ROOT/'tools/blender/catalog_realism/refinements/household_upholstery.py'))
 def test_dense_shell_preserves_source_profile_and_original_bounds(self):
  p=[]
  for i in range(41):
   a=i*math.pi/40;rise=.58+.42*math.sin(a)
   for j in range(12):
    t=j*math.tau/12;r=.04*math.cos(t)
    p.append(((.13+r)*math.cos(a),(.15+r)*math.sin(a)-.01,.30+.2*rise*.46+.2*rise*.48*math.sin(t)))
  new,f=self.h['shell'](p)
  for s in ('min','max'):
   for a in range(3):self.assertAlmostEqual(self.h['bounds'](new)[s][a],self.h['bounds'](p)[s][a],places=10)
  self.assertEqual(len(new),97*32);self.assertLess(sum(len(x)-2 for x in f),7000)
  with self.assertRaises(ValueError):self.h['shell'](p[:-1])
 def test_only_the_small_pillow_loop_is_selected(self):
  points=[(-.1,.5,.49),(.1,.7,.49),(-.4,-.8,.4),(.4,.8,.4),(-.4,-.7,.43),(.4,.3,.43)]
  box={'min':[-.3,.44,.39],'max':[.3,.83,.49]}
  self.assertEqual(self.h['pillow_loop'](points,[[0,1],[2,3],[4,5]],box),0)
  with self.assertRaises(ValueError):self.h['pillow_loop'](points,[[0,1],[0,1],[4,5]],box)
if __name__=='__main__':unittest.main()
