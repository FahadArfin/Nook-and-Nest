from pathlib import Path
import math,runpy,unittest
ROOT=Path(__file__).resolve().parents[1]
class ShellChairContactTests(unittest.TestCase):
 def test_child_cover_is_closed_without_corner_puckers_and_keeps_source_box(self):
  h=runpy.run_path(str(ROOT/'tools/blender/catalog_realism/refinements/shell_chair_contact.py'))
  box={'min':[-.128,-.182,.226],'max':[.128,.125,.371]}
  points,faces=h['child_cover'](box)
  self.assertEqual(h['bounds'](points),box)
  from collections import Counter
  edges=Counter(tuple(sorted((a,b))) for f in faces for a,b in zip(f,f[1:]+f[:1]))
  self.assertEqual(set(edges.values()),{2})
  self.assertLess(sum(len(f)-2 for f in faces),6000)
  top=points[6*64:7*64]
  self.assertLess(max(p[2] for p in top)-min(p[2] for p in top),1e-8)
 def test_ring_topology_survives_independent_transport_without_distance_guessing(self):
  h=runpy.run_path(str(ROOT/'tools/blender/catalog_realism/refinements/shell_chair_contact.py'))
  points=[]
  for i in range(24):
   a=i*math.tau/24
   for j in range(8):
    t=j*math.tau/8;points.append((.12*math.cos(a)+.0015*math.cos(t),.14*math.sin(a),.35+.013*(i%2)+.0015*math.sin(t)))
  faces=[(i*8+j,((i+1)%24)*8+j,((i+1)%24)*8+(j+1)%8,i*8+(j+1)%8) for i in range(24) for j in range(8)]
  centers,radius=h['seat_path'](points,faces)
  self.assertEqual(len(centers),24);self.assertAlmostEqual(radius,.0015)
  self.assertAlmostEqual(centers[1][2],.363)
  with self.assertRaises(ValueError):h['seat_path'](points,faces[:-1])
  damaged=list(faces);damaged[0]=(0,8,10,7)
  with self.assertRaises(ValueError):h['seat_path'](points,damaged)
if __name__=='__main__':unittest.main()
