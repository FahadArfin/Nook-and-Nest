"""Closed smooth stored cables, open inlet and source-accurate saw casing."""
from collections import Counter
from pathlib import Path
import math,runpy,unittest

ROOT=Path(__file__).resolve().parents[1]


class GarageConstructionTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.h=runpy.run_path(str(ROOT/'tools/blender/catalog_realism/refinements/garage_construction.py'))

 def closed(self,mesh):
  points,faces=mesh;edges=Counter();directions=Counter();volume=0
  for face in faces:
   self.assertEqual(len(face),len(set(face)))
   for a,b in zip(face,face[1:]+face[:1]):edges[tuple(sorted((a,b)))]+=1;directions[(a,b)]+=1
   a=points[face[0]]
   for i in range(1,len(face)-1):
    b,c=points[face[i]],points[face[i+1]]
    self.assertGreater(math.dist(self.h['cross'](self.h['sub'](b,a),self.h['sub'](c,a)),(0,0,0)),1e-13)
    volume+=self.h['dot'](a,self.h['cross'](b,c))/6
  self.assertEqual(set(edges.values()),{2})
  for a,b in edges:self.assertEqual(directions[(a,b)],directions[(b,a)])
  self.assertGreater(volume,0)

 def original_ring(self,segments=32):
  return [( (.2+.006*math.cos(p))*math.cos(t), .03+.005*math.sin(p), .3+(.24+.0072*math.cos(p))*math.sin(t))
          for t in [i*math.tau/segments for i in range(segments+1)] for p in [j*math.tau/8 for j in range(8)]]

 def test_coil_closes_the_duplicate_source_end_seam_and_keeps_exact_bounds(self):
  for segments in (32,40):
   original=self.original_ring(segments);mesh=self.h['coil'](original,segments)
   self.closed(mesh);self.assertEqual(self.h['bounds'](mesh[0]),self.h['bounds'](original))
   self.assertEqual(len(mesh[0]),960)
   self.assertTrue(all(len(f)==4 for f in mesh[1]))
   damaged=list(original);damaged[-1]=(0,0,0)
   with self.assertRaises(ValueError):self.h['coil'](damaged,segments)

 def test_frame_remains_continuous_through_three_dimensional_bends(self):
  anchors=[(-.1,0,.6),(-.1,0,.8),(.1,0,.8),(.14,.015,.75),(.14,.03,.3)]
  path=self.h['rounded_path'](anchors,cut=.03,spacing=.006)
  mesh=self.h['tube'](path,.01,16);self.closed(mesh)
  points=mesh[0]
  for i in range(len(path)-1):
   a=self.h['sub'](points[i*16],path[i]);b=self.h['sub'](points[(i+1)*16],path[i+1])
   self.assertGreater(self.h['dot'](a,b),0)

 def test_open_inlet_has_annular_ends_and_original_outer_envelope(self):
  box={'min':[-.1,-.12,.78],'max':[.025,-.07,.833]}
  mesh=self.h['inlet'](box);self.closed(mesh)
  for side in ('min','max'):
   for axis in range(3):self.assertAlmostEqual(self.h['bounds'](mesh[0])[side][axis],box[side][axis],places=12)
  self.assertTrue(all(len(f)==4 for f in mesh[1]))
  for p in mesh[0]:
   if abs(p[0]-box['max'][0])<1e-8:self.assertGreater(math.hypot(p[1]+.095,p[2]-.8065),.018)

 def test_connector_endpoint_is_on_measured_loop_centerline(self):
  original=self.original_ring(40);target=self.h['nearest_loop'](original,40,(-.16,.06,.28))
  self.assertAlmostEqual((target[0]/.2)**2+((target[2]-.3)/.24)**2,1)
  self.assertAlmostEqual(target[1],.03)

 def test_guard_retains_measured_semicircular_inner_and_outer_arcs(self):
  points=[]
  for x in (-.03,.03):
   for radius in (.148,.162):
    points += [(x,-.1+radius*math.cos(i*math.pi/36),.32+radius*math.sin(i*math.pi/36)) for i in range(37)]
  mesh=self.h['guard'](points);self.closed(mesh)
  self.assertEqual(self.h['bounds'](mesh[0]),self.h['bounds'](points))
  self.assertLess(len(mesh[0]),500)
  damaged=list(points);damaged[12]=(0,0,0)
  with self.assertRaises(ValueError):self.h['guard'](damaged)


if __name__=='__main__':unittest.main()
