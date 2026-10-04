"""Measured turned silhouettes, hollow pour lip and seated appliance trim."""
from collections import Counter
from pathlib import Path
import math
import runpy
import unittest

ROOT=Path(__file__).resolve().parents[1]
HELPER=ROOT/'tools/blender/catalog_realism/refinements/round_appliances.py'


class RoundApplianceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.h=runpy.run_path(str(HELPER))

    def closed(self,mesh):
        points,faces=mesh;edges=Counter();directed=Counter();volume=0
        for face in faces:
            self.assertEqual(len(face),len(set(face)))
            for a,b in zip(face,face[1:]+face[:1]):edges[tuple(sorted((a,b)))]+=1;directed[(a,b)]+=1
            a=points[face[0]]
            for i in range(1,len(face)-1):
                b,c=points[face[i]],points[face[i+1]]
                cross=self.h['cross'](self.h['sub'](b,a),self.h['sub'](c,a))
                self.assertGreater(math.dist(cross,(0,0,0)),1e-13)
                volume+=self.h['dot'](a,self.h['cross'](b,c))/6
        self.assertEqual(set(edges.values()),{2})
        for a,b in edges:self.assertEqual(directed[(a,b)],directed[(b,a)])
        self.assertGreater(volume,0)

    def test_even_and_non_cardinal_rings_recover_measured_profiles(self):
        for sides,axis in ((32,2),(24,2),(24,1),(14,1)):
            box={'min':[-.2,-.3,.1],'max':[.2,.3,.8]}
            profile=[(0,0),(.94,0),(.98,.1),(1,.2),(1,.8),(.98,.9),(.94,1),(0,1)]
            points,_=self.h['turned'](profile,box,sides,axis)
            actual=self.h['bounds'](points)
            recovered=self.h['recover_profile'](points,axis,sides)
            mesh=self.h['turned'](recovered,actual,128,axis)
            self.closed(mesh)
            for side in ('min','max'):
                for a in range(3):self.assertAlmostEqual(self.h['bounds'](mesh[0])[side][a],actual[side][a],places=10)
            self.assertAlmostEqual(recovered[3][0],1,places=7)
            damaged=list(points);index=next(i for i,p in enumerate(points) if abs(p[0])>.1)
            p=damaged[index];damaged[index]=(p[0]+.005,p[1],p[2])
            with self.assertRaises(ValueError):self.h['recover_profile'](damaged,axis,sides)

    def test_hollow_spout_has_no_end_disc_and_preserves_source_envelope(self):
        # The source is an affine-transformed eight-sided capped tube.
        a=(.03,0,.12);b=(.1,0,.2);u=(.008,0,-.006);v=(0,.015,0)
        points=[];faces=[]
        for t in (0,.1,.9,1):
            for i in range(8):
                angle=i*math.tau/8
                points.append(tuple(a[k]+t*(b[k]-a[k])+(u[k]*math.cos(angle)+v[k]*math.sin(angle)) for k in range(3)))
        for ring in range(3):
            for i in range(8):j=(i+1)%8;faces.append((ring*8+i,ring*8+j,(ring+1)*8+j,(ring+1)*8+i))
        faces += [tuple(reversed(range(8))),tuple(range(24,32))]
        mesh,evidence=self.h['hollow_spout'](points,faces)
        self.closed(mesh)
        self.assertEqual(self.h['bounds'](mesh[0]),self.h['bounds'](points))
        self.assertGreater(evidence['openingRadiusRatio'],.7)
        self.assertTrue(all(len(face)==4 for face in mesh[1]))
        self.assertLess(len(mesh[0]),700)
        with self.assertRaises(ValueError):self.h['hollow_spout'](points,faces[:-1])

    def test_gaskets_follow_the_rim_and_are_seated_within_original_front(self):
        box={'min':[-.22,-.331,.19],'max':[.22,-.278,.634]}
        for half in range(2):
            mesh,evidence=self.h['door_gasket'](box,half);self.closed(mesh)
            self.assertGreater(evidence['seatedDepthM'],0)
            self.assertLess(self.h['bounds'](mesh[0])['min'][1],box['min'][1])
            self.assertGreater(self.h['bounds'](mesh[0])['max'][1],box['min'][1])
            self.assertTrue(all(box['min'][0]<=p[0]<=box['max'][0] and box['min'][2]<=p[2]<=box['max'][2] for p in mesh[0]))

    def test_pedestal_target_closes_only_the_measured_top_gap(self):
        base={'min':[-.2,-.2,.03],'max':[.2,.2,.3391635]}
        top={'min':[-.43,-.43,.3493029],'max':[.43,.43,.4]}
        target,evidence=self.h['contact_target'](base,top)
        self.assertEqual(target['min'],base['min'])
        self.assertEqual(target['max'][:2],base['max'][:2])
        self.assertAlmostEqual(target['max'][2],top['min'][2]+.003)
        self.assertAlmostEqual(evidence['originalTopGapM'],.0101394)
        with self.assertRaises(ValueError):self.h['contact_target'](base,{'min':[0,0,.5],'max':[0,0,.6]})

    def test_knurl_ribs_stay_on_vertical_knob_and_inside_appliance_height(self):
        box={'min':[-.025,-.025,.208],'max':[.017,.025,.25]}
        for i in range(20):
            mesh=self.h['knob_rib'](box,i);self.closed(mesh)
            b=self.h['bounds'](mesh[0])
            self.assertGreater(b['min'][2],box['min'][2])
            self.assertLess(b['max'][2],box['max'][2])
            self.assertAlmostEqual(b['max'][2]-b['min'][2],.006)


if __name__=='__main__':unittest.main()
