"""Geometric contracts for the two reviewed, source-specific curve repairs."""
from collections import Counter
from pathlib import Path
import json
import math
import runpy
import unittest

ROOT = Path(__file__).resolve().parents[1]
HELPER = ROOT/'tools/blender/catalog_realism/refinements/curved_construction.py'


class CurvedConstructionTests(unittest.TestCase):
    def helper(self):
        self.assertTrue(HELPER.exists(), 'Source-specific curve construction has not been implemented')
        return runpy.run_path(str(HELPER))

    def closed(self, mesh):
        vertices, faces = mesh
        edges = Counter();directions=Counter()
        volume = 0
        for face in faces:
            self.assertEqual(len(set(face)), len(face))
            for a,b in zip(face,face[1:]+face[:1]):
                edges[tuple(sorted((a,b)))]+=1;directions[(a,b)]+=1
            a=vertices[face[0]]
            for i in range(1,len(face)-1):
                b,c=vertices[face[i]],vertices[face[i+1]]
                volume += (a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6
        self.assertEqual(set(edges.values()), {2}, 'Each shell must be closed')
        self.assertTrue(all(directions[(a,b)]==directions[(b,a)] for a,b in edges), 'Adjacent winding must agree')
        self.assertGreater(volume, 0, 'Shell winding must face outward')
        self.assertLess(len(vertices), 5000)

    def source(self, ident, contains):
        records=json.loads((ROOT/'assets-source/catalog-realism/source-inventory.json').read_text())['models'][ident]['objects']
        return [r for r in records if contains(r['name'])]

    def test_guitar_contour_retains_bouts_waist_extents_and_smooth_turns(self):
        h=self.helper();outline=h['guitar_outline']()
        self.assertGreater(len(outline),150)
        self.assertEqual(min(p[0] for p in outline),-206)
        self.assertEqual(max(p[0] for p in outline),206)
        self.assertEqual(min(p[1] for p in outline),105)
        self.assertEqual(max(p[1] for p in outline),596)
        for i,p in enumerate(outline):
            before=outline[i-1];after=outline[(i+1)%len(outline)]
            a=(p[0]-before[0],p[1]-before[1]);b=(after[0]-p[0],after[1]-p[1])
            angle=math.acos(max(-1,min(1,sum(x*y for x,y in zip(a,b))/math.hypot(*a)/math.hypot(*b))))
            self.assertLess(angle,.35,'The authored hard corners must become a smooth contour')
        self.assertLess(min(abs(x) for x,z in outline if 375<z<390),140)
        self.assertGreater(max(abs(x) for x,z in outline if 220<z<290),195)

    def test_guitar_soundboard_retains_an_open_sound_hole(self):
        h=self.helper();spec=self.source('acoustic-guitar-on-stand',lambda n:n.startswith('Spruce'))[0]
        mesh=h['guitar_mesh']('soundboard',spec['bounds']);self.closed(mesh)
        hole=h['GUITAR_HOLE'];vertices,faces=mesh
        self.assertTrue(all(((v[0]-hole[0])/hole[2])**2+((v[2]-hole[1])/hole[3])**2>=1-1e-8 for v in vertices))
        self.assertTrue(any(abs(((v[0]-hole[0])/hole[2])**2+((v[2]-hole[1])/hole[3])**2-1)<1e-8 for v in vertices))
        actual_area=0
        for face in faces:
            if all(abs(vertices[i][1]-spec['bounds']['min'][1])<1e-9 for i in face):
                self.assertEqual(len(face),3)
                a,b,c=[vertices[i] for i in face]
                actual_area+=abs((b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]))/2
                center=[sum(vertices[i][axis] for i in face)/3 for axis in (0,2)]
                self.assertGreater(((center[0]-hole[0])/hole[2])**2+((center[1]-hole[1])/hole[3])**2,.999)
        outline=h['planar_outline'](spec['bounds'])
        outer_area=abs(sum(a[0]*b[1]-a[1]*b[0] for a,b in zip(outline,outline[1:]+outline[:1])))/2
        hole_area=96*hole[2]*hole[3]*math.sin(math.tau/96)/2
        self.assertAlmostEqual(actual_area,outer_area-hole_area,places=10,msg='No crossed or doubled soundboard triangles')
        for side in ('min','max'):
            for a in range(3):self.assertAlmostEqual(h['bounds'](vertices)[side][a],spec['bounds'][side][a],places=7)

    def test_back_sides_and_binding_are_closed_bounded_construction(self):
        h=self.helper()
        roles={'Guitar solid mahogany back':'back','Guitar curved hollow body sides':'sides','Ivory body edge binding':'binding'}
        for spec in self.source('acoustic-guitar-on-stand',lambda n:n in roles):
            mesh=h['guitar_mesh'](roles[spec['name']],spec['bounds']);self.closed(mesh)
            box=h['bounds'](mesh[0])
            for side in ('min','max'):
                for a in range(3):self.assertAlmostEqual(box[side][a],spec['bounds'][side][a],places=7)

    def test_scalloped_crown_has_no_unfilled_valley_above_stem(self):
        h=self.helper();specs=self.source('arched-bed',lambda n:n.startswith('petal_headboard_arch'))
        stem=self.source('arched-bed',lambda n:n=='petal_headboard_stem')[0]['bounds']
        panels=h['crown_panels'](specs,stem)
        self.assertEqual(len(panels),5)
        for mesh in panels:self.closed(mesh)
        # Upper boundaries cover the full horizontal span with no black triangular holes.
        boxes=[h['bounds'](m[0]) for m in panels]
        for a,b in zip(boxes,boxes[1:]):self.assertAlmostEqual(a['max'][0],b['min'][0],places=8)
        self.assertAlmostEqual(max(b['max'][2] for b in boxes),1.2000000476837158)
        self.assertTrue(all(b['min'][2]<stem['max'][2] for b in boxes))
        self.assertTrue(all(b['min'][1]>=stem['min'][1] and b['max'][1]<=stem['max'][1] for b in boxes))

    def test_trim_sampling_is_closed_and_never_has_a_long_unsupported_span(self):
        h=self.helper();points=h['resample_closed']([(0,0,0),(.4,0,0),(.4,.3,0),(0,.3,0)],.008)
        self.assertLessEqual(max(math.dist(p,points[(i+1)%len(points)]) for i,p in enumerate(points)),.00800001)
        self.assertEqual(points[0],(0.,0.,0.))
        self.assertNotEqual(points[0],points[-1])

    def test_source_guard_rejects_changed_component_or_material(self):
        h=self.helper();spec={'name':'exact','vertices':24,'materials':['linen'],'bounds':{'min':[0,0,0],'max':[1,1,1]}}
        h['validate_source']('exact',24,['linen'],spec['bounds'],spec)
        for name,count,keys in [('other',24,['linen']),('exact',25,['linen']),('exact',24,['glass'])]:
            with self.assertRaises(ValueError):h['validate_source'](name,count,keys,spec['bounds'],spec)

    def test_tuft_contact_moves_only_towards_the_actual_headboard(self):
        h=self.helper()
        self.assertIn('tuft_shift',h,'The native contact adjustment needs a testable measured guard')
        shift=h['tuft_shift'](.792259156703949,.8929392695426941)
        self.assertAlmostEqual(.792259156703949+shift,.8949392695426941)
        with self.assertRaises(ValueError):h['tuft_shift'](.892,.893)
        with self.assertRaises(ValueError):h['tuft_shift'](.792,1.1)

    def test_source_material_guard_accepts_only_unused_empty_slots(self):
        h=self.helper();self.assertTrue(callable(h.get('material_slot_keys')))
        self.assertEqual(h['material_slot_keys'](['maple',None],[0,0]),['maple'])
        with self.assertRaises(ValueError):h['material_slot_keys'](['maple',None],[0,1])

    def test_authored_tapered_jittered_pipe_has_a_valid_closed_center_path(self):
        h=self.helper();self.assertTrue(callable(h.get('authored_trim_loop')))
        points=[]
        for i in range(25):
            theta=(i%24)*math.tau/24;center=(.23*math.cos(theta),.18*math.sin(theta),.56)
            radius=.0022*(1-.8*i/24)
            for j in range(6):
                a=j*math.tau/6;r=radius*(1+.07*math.sin(j*17+i))
                points.append((center[0]+r*math.cos(a),center[1],center[2]+r*math.sin(a)))
        centers,radius=h['authored_trim_loop'](points)
        self.assertEqual(len(centers),24);self.assertAlmostEqual(radius,.0022,delta=.0001)
        points[-1]=(points[-1][0]+.006,points[-1][1],points[-1][2])
        with self.assertRaises(ValueError):h['authored_trim_loop'](points)


if __name__=='__main__':unittest.main()
