"""Measured construction checks for three reviewed fixture defects."""
from collections import Counter
from pathlib import Path
import math
import json
import runpy
import unittest

ROOT = Path(__file__).resolve().parents[1]
HELPER = ROOT/'tools/blender/catalog_realism/refinements/fixture_contacts.py'


class FixtureContactTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.h = runpy.run_path(str(HELPER))

    def closed(self, geometry):
        vertices, faces = geometry
        edges = Counter();directions=Counter()
        volume = 0
        for face in faces:
            self.assertEqual(len(face), len(set(face)))
            for a, b in zip(face, face[1:] + face[:1]):
                edges[tuple(sorted((a, b)))] += 1
                directions[(a,b)] += 1
            a = vertices[face[0]]
            for j in range(1, len(face)-1):
                b, c = vertices[face[j]], vertices[face[j+1]]
                volume += (a[0]*(b[1]*c[2]-b[2]*c[1]) + a[1]*(b[2]*c[0]-b[0]*c[2]) + a[2]*(b[0]*c[1]-b[1]*c[0]))/6
        self.assertEqual(set(edges.values()), {2})
        for a,b in edges:self.assertEqual(directions[(a,b)],directions[(b,a)])
        self.assertGreater(volume, 0)

    def test_stool_tubes_are_closed_bounded_and_connect_reviewed_parts(self):
        paths = self.h['stool_paths']()
        self.assertEqual(len(paths), 6)
        for row in paths:
            self.closed(row['geometry'])
            box = self.h['bounds'](row['geometry'][0])
            self.assertTrue(all(box['min'][i] >= (-.21, -.21, 0)[i] and box['max'][i] <= (.21, .21, .72)[i] for i in range(3)))
            self.assertLess(len(row['geometry'][0]), 800)
            if row['role'] == 'back-mount':
                self.assertTrue(.276 < row['path'][0][2] < .322)
                self.assertTrue(.403 < row['path'][-1][2] < .72)
                self.assertTrue(.041 < row['path'][-1][1] < .21)
            else:
                self.assertAlmostEqual(row['path'][0][2], .14058493077754974)
                self.assertGreater(math.hypot(*row['path'][-1][:2]), .23)

    def test_only_planar_extreme_mirror_caps_are_selected(self):
        points = [(-.2,-.025,.1),(.2,-.025,.1),(.2,-.025,.8),(-.2,-.025,.8),
                  (-.2,-.018,.1),(.2,-.018,.1),(.2,-.018,.8),(-.2,-.018,.8),
                  (0,-.023,.4)]
        faces = [(0,1,2,3),(4,7,6,5),(0,4,5,1),(0,1,8)]
        self.assertEqual(self.h['planar_caps'](points,faces), [0,1])
        # A warped reflective face must never be silently accepted as planar.
        points[2] = (.2,-.0249,.8)
        self.assertEqual(self.h['planar_caps'](points,faces), [1])

    def test_dispensing_recess_has_real_cup_clearance_and_preserved_case_envelope(self):
        plan = self.h['coffee_plan']()
        self.closed(plan['cutter'])
        box = self.h['bounds'](plan['cutter'][0])
        self.assertLess(box['min'][1], -.2084)
        self.assertAlmostEqual(box['max'][1], -.065)
        self.assertGreater(box['min'][0], -.15)
        self.assertLess(box['max'][0], .1085)  # original steam wand remains outside
        self.assertLess(box['max'][2], .27)  # display untouched
        self.assertGreater(plan['cupClearanceM'], .095)
        self.assertGreater(plan['recessDepthM'], .11)
        self.closed(plan['head'])
        head = self.h['bounds'](plan['head'][0])
        self.assertLess(head['min'][2], .21000234783)
        self.assertGreater(head['max'][2], box['max'][2])
        self.assertGreater(head['max'][1], box['max'][1])
        self.assertEqual(len(plan['grilleRails']),2)
        for rail in plan['grilleRails']:
            self.closed(rail)
            support=self.h['bounds'](rail[0])
            self.assertLess(support['min'][2],.0355162248)
            self.assertGreater(support['max'][2],.048299998)
            self.assertGreater(support['max'][1],-.065)

    def test_spouts_have_closed_walls_and_open_bore_in_exact_original_bounds(self):
        lo,hi = (-.04328457266,-.20660962164,.14404365420),(-.02134308591,-.18225941062,.21000234783)
        mesh = self.h['spout_sleeve'](lo,hi)
        self.closed(mesh)
        actual = self.h['bounds'](mesh[0])
        for side,expected in [('min',lo),('max',hi)]:
            for i in range(3):self.assertAlmostEqual(actual[side][i],expected[i],places=10)
        cx,cy=(lo[0]+hi[0])/2,(lo[1]+hi[1])/2
        self.assertGreater(min(math.hypot(x-cx,y-cy) for x,y,z in mesh[0]), .005)
        self.assertLess(len(mesh[0]), 300)

    def test_exact_component_guards_reject_a_different_source(self):
        spec={'name':'mirror_glass','vertices':344,'materials':['bathroom-mirror'],
              'bounds':{'min':[-.25,-.025,.025],'max':[.25,-.017857,.925]}}
        self.h['validate_source'](spec['name'],344,spec['materials'],spec['bounds'],spec)
        with self.assertRaises(ValueError):self.h['validate_source']('mirror_glass',343,spec['materials'],spec['bounds'],spec)
        with self.assertRaises(ValueError):self.h['validate_source']('mirror_glass',344,['other'],spec['bounds'],spec)

    def test_entrypoints_bind_all_helpers_and_exact_original_roles(self):
        inventory=json.loads((ROOT/'assets-source/catalog-realism/source-inventory.json').read_text())['models']
        for ident in ['bar-stool','bath-mirror-pill','bean-coffee-machine']:
            entry=HELPER.with_name(ident+'.py')
            if not entry.exists():entry=ROOT/'.generated/catalog-realism/fixture-entrypoints'/(ident+'.py')
            module=runpy.run_path(str(entry))
            self.assertEqual(module['CATALOG_ID'],ident)
            self.assertEqual(json.loads(entry.with_suffix('.json').read_text()),{'version':1,'dependencies':['fixture_contacts.py','curved_construction.py']})
            originals={row['name']:row for row in inventory[ident]['objects']}
            for spec in module['SOURCE_COMPONENTS']:
                original=originals[spec['name']]
                self.h['validate_source'](original['name'],original['vertices'],original['materials'],original['bounds'],spec)


if __name__ == '__main__':
    unittest.main()
