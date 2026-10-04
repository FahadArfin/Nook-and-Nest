"""Topology and dimension contracts for the four source-specific refinements."""
from collections import Counter
from pathlib import Path
import runpy
import json
import unittest

HELPER = Path(__file__).resolve().parents[1]/'tools/blender/catalog_realism/refinements/vessel_geometry.py'


class VesselGeometryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.helper = runpy.run_path(str(HELPER))

    def closed(self, mesh):
        vertices, faces = mesh
        edges = Counter()
        for face in faces:
            self.assertGreaterEqual(len(face), 3)
            self.assertEqual(len(set(face)), len(face))
            for a,b in zip(face,face[1:]+face[:1]): edges[tuple(sorted((a,b)))]+=1
        self.assertTrue(edges)
        self.assertEqual(set(edges.values()), {2}, 'Closed shell must have exactly two faces at every edge')
        adjacent={i:set() for i in range(len(vertices))}
        for a,b in edges:adjacent[a].add(b);adjacent[b].add(a)
        seen=set();pending=[0]
        while pending:
            current=pending.pop()
            if current in seen:continue
            seen.add(current);pending.extend(adjacent[current]-seen)
        self.assertEqual(len(seen),len(vertices),'Each constructed component must be connected')
        # Outward winding must give positive signed volume.
        volume = 0
        for face in faces:
            a=vertices[face[0]]
            for i in range(1,len(face)-1):
                b,c=vertices[face[i]],vertices[face[i+1]]
                volume += (a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6
        self.assertGreater(volume,0)

    def test_vessel_has_closed_base_inner_floor_and_full_bounds(self):
        mesh=self.helper['vessel_mesh']((-.05,-.07,0),(.05,.07,.2))
        self.closed(mesh)
        self.assertEqual(self.helper['bounds'](mesh[0]),{'min':[-.05,-.07,0.0],'max':[.05,.07,.2]})
        self.assertLess(len(mesh[0]),2500)
        self.assertTrue(any(all(mesh[0][i][2]==0 for i in f) for f in mesh[1]))
        self.assertTrue(any(all(abs(mesh[0][i][2]-.04)<1e-9 for i in f) for f in mesh[1]))

    def test_fire_bowl_is_closed_recessed_and_bounded(self):
        mesh=self.helper['fire_bowl_mesh']((-.4,-.4,.18),(.4,.4,.42))
        self.closed(mesh)
        actual=self.helper['bounds'](mesh[0]);self.assertAlmostEqual(actual['min'][2],.18);self.assertAlmostEqual(actual['max'][2],.42)
        self.assertLess(len(mesh[0]),6000)
        self.assertTrue(any(abs(v[0])<1e-9 and abs(v[1])<1e-9 and .18<v[2]<.25 for v in mesh[0]))

    def test_rolled_lip_is_closed_with_clear_center(self):
        mesh=self.helper['rim_mesh']((-.4,-.4,.41),(.4,.4,.43))
        self.closed(mesh)
        self.assertGreater(min((v[0]**2+v[1]**2)**.5 for v in mesh[0]),.37)

    def test_petals_have_volume_and_stay_in_each_authored_extent(self):
        original=[(0,0,0),(.016,.013,.0052),(.04,0,.0088),(.016,-.013,.0052)]
        mesh=self.helper['petal_mesh'](original)
        self.closed(mesh)
        self.assertEqual(self.helper['bounds'](mesh[0]),self.helper['bounds'](original))
        self.assertGreater(len(mesh[0]),40)
        self.assertLess(len(mesh[0]),500)

    def test_utensils_have_four_distinct_closed_connected_constructions(self):
        shapes=[]
        for kind in ['turner','slotted-turner','spoon','fork']:
            mesh=self.helper['utensil_mesh']((-.018,-.01,.268),(.018,.01,.33),kind)
            self.closed(mesh);shapes.append(mesh)
            bound=self.helper['bounds'](mesh[0]);self.assertEqual(bound['max'][2],.33)
            self.assertTrue(all(bound['min'][a]>=(-.018,-.01,.268)[a]-1e-8 and bound['max'][a]<=(.018,.01,.33)[a]+1e-8 for a in range(3)))
        self.assertEqual(len({repr(s) for s in shapes}),4)
        self.assertGreater(len(shapes[1][1]),len(shapes[0][1]))

    def test_source_scope_requires_exact_role_material_count_and_bounds(self):
        spec={'name':'open_vessel','vertices':128,'materials':['warm-porcelain'],'bounds':{'min':[-1,-1,0],'max':[1,1,2]}}
        self.helper['validate_source']('open_vessel',128,['warm-porcelain'],spec['bounds'],spec)
        for name,count,materials,bound in [('other',128,['warm-porcelain'],spec['bounds']),('open_vessel',127,['warm-porcelain'],spec['bounds']),('open_vessel',128,['glass'],spec['bounds']),('open_vessel',128,['warm-porcelain'],{'min':[-1,-1,0],'max':[1.1,1,2]})]:
            with self.assertRaises(ValueError):self.helper['validate_source'](name,count,materials,bound,spec)

    def test_entrypoints_bind_shared_helper_and_exact_catalog_source_roles(self):
        root=HELPER.parents[4]
        inventory=json.loads((root/'assets-source/catalog-realism/source-inventory.json').read_text())['models']
        catalog={item['id']:item for item in json.loads((root/'assets-source/catalog-realism/catalog.json').read_text())['items']}
        for ident in ['bud-vase-trio','pantry-jars','utensil-crock','patio-fire-bowl']:
            module=runpy.run_path(str(HELPER.with_name(ident+'.py')))
            self.assertEqual(module['CATALOG_ID'],ident)
            dependencies=['vessel_geometry.py']
            components=module['SOURCE_COMPONENTS']
            if ident=='patio-fire-bowl':
                dependencies=['reviewed_612.py','vessel_geometry.py']
                self.assertEqual(module['SOURCE_SHA256'],catalog[ident]['sourceBlend']['sha256'])
                self.assertEqual([(s['name'],s['kind']) for s in module['PRIOR_VESSEL_COMPONENTS']],
                                 [('double_walled_spun_bowl','fire-bowl'),('rolled_bowl_lip','rim')])
                self.assertEqual([s['name'] for s in components],['steel_fire_grate','split_firewood'])
                # The later firewood recipe must keep the accepted hollow bowl
                # recipe and remain scoped away from all authored flame parts.
                components=module['PRIOR_VESSEL_COMPONENTS']+components
            self.assertEqual(json.loads(HELPER.with_name(ident+'.json').read_text()),{'version':1,'dependencies':dependencies})
            originals={row['name']:row for row in inventory[ident]['objects']}
            for spec in components:
                source=originals[spec['name']]
                self.helper['validate_source'](source['name'],source['vertices'],source['materials'],source['bounds'],spec)
                if spec.get('kind')=='flower-center':self.assertLess(spec['seatedBaseZ'],source['bounds']['min'][2])
                if spec.get('kind')=='submerged-stem':self.assertLess(spec['hiddenBaseZ'],source['bounds']['max'][2])


if __name__ == '__main__':unittest.main()
