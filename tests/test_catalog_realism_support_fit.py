"""Physical support and exact-envelope tests for three further reviewed models."""
from collections import Counter
from pathlib import Path
import json
import math
import runpy
import unittest

ROOT=Path(__file__).resolve().parents[1]
HELPER=ROOT/'tools/blender/catalog_realism/refinements/support_fit.py'


class SupportFitTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.h=runpy.run_path(str(HELPER))
        cls.source=json.loads((ROOT/'assets-source/catalog-realism/source-inventory.json').read_text())['models']

    def test_counter_braces_connect_the_original_ring_to_all_four_leg_centers(self):
        rows={r['name']:r for r in self.source['counter-saddle-stool']['objects']}
        legs=[rows[n]['bounds'] for n in ['aluminum_foot','aluminum_foot.001','aluminum_foot.002','aluminum_foot.003']]
        paths=self.h['counter_braces'](rows['footrest']['bounds'],legs,[460,430,660])
        self.assertEqual(len(paths),4)
        for path,box in zip(paths,legs):
            self.assertGreater(math.dist(path[0],path[1]),.05)
            for a in (0,1):self.assertAlmostEqual(path[-1][a],(box['min'][a]+box['max'][a])/2)
            self.assertTrue(box['min'][2]<path[-1][2]<box['max'][2])

    def test_continuous_curved_back_is_closed_bounded_and_embedded_at_both_arms(self):
        vertices,faces=self.h['sofa_back']();box=self.h['bounds'](vertices)
        self.assertGreaterEqual(box['min'][0],-1.3);self.assertLessEqual(box['max'][0],1.3)
        self.assertLessEqual(box['max'][1],.55);self.assertGreaterEqual(box['min'][1],-.55)
        self.assertLess(box['min'][2],.3475);self.assertLess(box['max'][2],.80)
        self.assertGreater(box['max'][0],1.066);self.assertLess(box['min'][0],-1.066)
        edges=Counter();directions=Counter()
        for f in faces:
            for a,b in zip(f,f[1:]+f[:1]):edges[tuple(sorted((a,b)))]+=1;directions[a,b]+=1
        self.assertEqual(set(edges.values()),{2})
        for a,b in edges:self.assertEqual(directions[a,b],directions[b,a])
        self.assertLess(sum(len(f)-2 for f in faces),6000)

    def test_daybed_frame_uses_full_original_width_and_drawers_fit_between_ends(self):
        rows={r['name']:r for r in self.source['daybed']['objects']}
        plan=self.h['daybed_plan'](rows)
        factor=plan['frameScaleX'];self.assertGreater(factor,1.3)
        self.assertAlmostEqual(rows['daybed_end_frame.001']['bounds']['max'][0]*factor,1.024999976158142)
        boxes=[]
        for name,transform in plan['drawers'].items():
            old=rows[name]['bounds'];scale,offset=transform
            boxes.append([old[s][0]*scale+offset for s in ('min','max')])
        self.assertAlmostEqual(boxes[1][0]-boxes[0][1],.012)
        inner=rows['daybed_end_frame.001']['bounds']['min'][0]*factor
        self.assertAlmostEqual(inner-boxes[1][1],.004)
        self.assertGreater(boxes[0][0],-1.025);self.assertLess(boxes[1][1],1.025)
        # Individual frame/bedding objects use one common world-X transform;
        # relative seams and original Y/Z coordinates are not independently fit.
        mattress=rows['daybed_mattress']['bounds']
        self.assertLess(mattress['max'][0]*factor,1.025)

    def test_entrypoints_bind_exact_original_roles_and_all_transitive_helpers(self):
        catalog={r['id']:r for r in json.loads((ROOT/'assets-source/catalog-realism/catalog.json').read_text())['items']}
        for ident in ['counter-saddle-stool','curve-sofa','daybed']:
            entry=HELPER.with_name(ident+'.py')
            if not entry.exists():entry=ROOT/'.generated/catalog-realism/support-entrypoints'/(ident+'.py')
            module=runpy.run_path(str(entry));self.assertEqual(module['CATALOG_ID'],ident)
            self.assertEqual(json.loads(entry.with_suffix('.json').read_text()),{'version':1,'dependencies':['support_fit.py','curved_construction.py','fixture_contacts.py','textile_turning.py']})
            original={r['name']:r for r in self.source[ident]['objects']}
            for spec in module['SOURCE_COMPONENTS']:
                actual=original[spec['name']]
                self.assertEqual(actual['materials'],spec['sourceMaterials'])
                for raw,key in zip(spec['sourceMaterials'],spec['materials']):
                    self.assertIn(key,catalog[ident]['materialKeys'])
                    self.assertTrue(raw==key or raw.startswith(key+'.') and raw[len(key)+1:].isdigit())
                self.h['_curves']['validate_source'](actual['name'],actual['vertices'],spec['materials'],actual['bounds'],spec)


if __name__=='__main__':unittest.main()
