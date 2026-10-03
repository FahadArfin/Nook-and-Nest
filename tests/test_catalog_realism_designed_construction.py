"""Contract and geometry tests for the nine reviewed designed-collection fixes."""
from collections import Counter
from pathlib import Path
import json
import math
import runpy
import unittest

ROOT=Path(__file__).resolve().parents[1]
DIRECTORY=ROOT/'tools/blender/catalog_realism/refinements'
IDS=['decorative-bowl','designed-coffee-glass','designed-mirror-arch','designed-mirror-faceted','designed-sink-farmhouse','designed-sink-fluted','designed-sunroom-chair','designed-sunroom-chaise','designed-dresser-fluted']


def closed(test,geometry):
    vertices,faces=geometry;edges=Counter();directed=Counter()
    for face in faces:
        test.assertGreaterEqual(len(set(face)),3)
        for a,b in zip(face,face[1:]+face[:1]):edges[tuple(sorted((a,b)))]+=1;directed[a,b]+=1
    test.assertEqual(set(edges.values()),{2})
    for a,b in edges:test.assertEqual(directed[a,b],directed[b,a])


class DesignedConstructionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.h=runpy.run_path(str(DIRECTORY/'designed_construction.py'))
        cls.source=json.loads((ROOT/'assets-source/catalog-realism/source-inventory.json').read_text())['models']

    def test_planar_sweep_never_flips_at_vertical_tangent(self):
        path=[(0,0,0),(0,0,.3),(0,.05,.35),(0,.5,.35),(0,.6,.3)]
        smooth=self.h['rounded_path'](path)
        vertices,faces=self.h['sweep'](smooth,.015,(1,0,0),sides=16)
        closed(self,(vertices,faces))
        for i,p in enumerate(smooth):
            ring=vertices[i*16:(i+1)*16]
            self.assertAlmostEqual(max(q[0] for q in ring)-min(q[0] for q in ring),.03)
            for q in ring:self.assertAlmostEqual(math.dist(q,p),.015)
        self.assertEqual(smooth[0],path[0]);self.assertEqual(smooth[-1],path[-1])

    def test_closed_mirror_miters_have_constant_rails_and_exact_bounds(self):
        path=[(-.3,0,0),(.3,0,0),(.35,0,.1),(.35,0,.7),(.3,0,.8),(-.3,0,.8),(-.35,0,.7),(-.35,0,.1)]
        geometry=self.h['sweep'](path,.023,(0,1,0),closed=True,sides=16,miter=True)
        closed(self,geometry)
        # The long rail rings have the same orientation, unlike the original tube.
        for j in range(16):
            a,b=geometry[0][2*16+j],geometry[0][3*16+j]
            self.assertAlmostEqual(a[0],b[0]);self.assertAlmostEqual(a[1],b[1])

    def test_bowl_shell_is_closed_and_keeps_original_inner_floor_and_rim(self):
        box=next(r['bounds'] for r in self.source['decorative-bowl']['objects'] if r['name']=='open_centerpiece')
        geometry=self.h['bowl_shell'](box);closed(self,geometry)
        self.assertEqual(self.h['bounds'](geometry[0]),{k:box[k] for k in ('min','max')})
        axis=[p for p in geometry[0] if abs(p[0])+abs(p[1])<1e-10]
        self.assertEqual(len(axis),2)
        self.assertAlmostEqual(axis[1][2],box['max'][2]*.2)

    def test_rounded_bowl_flutes_stay_outside_inner_bowl_and_inside_original_envelope(self):
        r=.16780567169189453;geometry=self.h['bowl_flute'](0,r,.175,.12);closed(self,geometry)
        self.assertAlmostEqual(max(p[0] for p in geometry[0]),.175)
        self.assertGreater(min(math.hypot(p[0],p[1]) for p in geometry[0]),r*.88)
        self.assertAlmostEqual(max(p[2] for p in geometry[0]),.12)

    def test_sink_collars_have_real_open_holes_and_closed_annular_shells(self):
        for ident in ('designed-sink-farmhouse','designed-sink-fluted'):
            rows={r['name']:r for r in self.source[ident]['objects']}
            plans=self.h['sink_parts'](rows)
            self.assertEqual(len(plans),3 if ident.endswith('farmhouse') else 4)
            for plan in plans:
                closed(self,plan['geometry'])
                for point in plan['geometry'][0]:self.assertLessEqual(point[2],.911)
            for plan in plans:
                if plan['kind']!='deck':continue
                cx,cy=plan['holeCenter']
                # Annular top faces never span the open center.
                for face in plan['geometry'][1]:
                    points=[plan['geometry'][0][i] for i in face]
                    if all(abs(p[2]-points[0][2])<1e-8 for p in points):
                        self.assertTrue(all(p[0]<=cx for p in points) or all(p[0]>=cx for p in points) or all(p[1]<=cy for p in points) or all(p[1]>=cy for p in points))

    def test_dresser_flutes_close_smoothly_under_existing_budget(self):
        rows=[r for r in self.source['designed-dresser-fluted']['objects'] if r['name'].startswith('drawer flute')]
        self.assertEqual(len(rows),156)
        geometry=self.h['economical_flute'](rows[0]['bounds']);closed(self,geometry)
        triangles=sum(len(f)-2 for f in geometry[1]);self.assertEqual(triangles,92)
        self.assertLess(27696-156*156+156*triangles,27632)

    def test_dresser_checks_raw_mesh_and_live_modifier_instead_of_evaluated_count(self):
        spec=next(r for r in self.source['designed-dresser-fluted']['objects'] if r['name']=='drawer flute')
        width=min(spec['bounds']['size'])*.025
        modifier={'name':'Realism softened manufactured edge','type':'BEVEL','segments':3,'width':width}
        self.h['validate_flute_state'](20,spec,[modifier])
        with self.assertRaisesRegex(ValueError,'original20'):self.h['validate_flute_state'](80,spec,[modifier])
        with self.assertRaisesRegex(ValueError,'settings changed'):self.h['validate_flute_state'](20,spec,[dict(modifier,segments=2)])
        with self.assertRaisesRegex(ValueError,'original20'):self.h['validate_flute_state'](20,spec,[])

    def test_arch_resampling_preserves_authored_anchors_and_fails_on_drift(self):
        centers=[(-.38+.22*i/20,-.168+.336*i/20,.035+.294*math.sin(math.pi*i/20)) for i in range(21)]
        path=self.h['coffee_path'](centers)
        self.assertEqual(len(path),97);self.assertEqual(path[0],centers[0]);self.assertEqual(path[-1],centers[-1])
        self.assertAlmostEqual(path[48][2],centers[10][2])
        changed=centers[:];changed[6]=(changed[6][0],changed[6][1],changed[6][2]+.001)
        with self.assertRaisesRegex(ValueError,'centerline changed'):self.h['coffee_path'](changed)
        mirror=[(-.3,0,0),(.3,0,0),(.3,0,.5)]+[(.3*math.cos(i*math.pi/32),0,.5+.3*math.sin(i*math.pi/32)) for i in range(33)]+[(-.3,0,0)]
        outline=self.h['mirror_path'](mirror,True)
        self.assertEqual(len(outline),99);self.assertEqual(outline[:2],mirror[:2])
        self.assertAlmostEqual(max(p[2] for p in outline),.8)

    def test_all_entrypoints_bind_exact_roles_materials_and_helpers(self):
        catalog={r['id']:r for r in json.loads((ROOT/'assets-source/catalog-realism/catalog.json').read_text())['items']}
        for ident in IDS:
            path=DIRECTORY/(ident+'.py')
            if not path.exists():path=ROOT/'.generated/catalog-realism/designed-entrypoints'/(ident+'.py')
            module=runpy.run_path(str(path));self.assertEqual(module['CATALOG_ID'],ident)
            self.assertEqual(json.loads(path.with_suffix('.json').read_text()),{'version':1,'dependencies':['designed_construction.py','curved_construction.py','fixture_contacts.py','vessel_geometry.py']})
            original={r['name']:r for r in self.source[ident]['objects']}
            for spec in module['SOURCE_COMPONENTS']:
                row=original[spec['name']]
                self.assertEqual(row['materials'],spec['sourceMaterials'])
                for key in spec['materials']:self.assertIn(key,catalog[ident]['materialKeys'])
                self.h['_curves']['validate_source'](row['name'],row['vertices'],spec['materials'],row['bounds'],spec)


if __name__=='__main__':unittest.main()
