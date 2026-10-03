import collections
import json
import math
from pathlib import Path
import runpy
import unittest

ROOT=Path(__file__).resolve().parents[1]
HELPER=ROOT/'tools/blender/catalog_realism/refinements/reviewed_612.py'


class Reviewed612Tests(unittest.TestCase):
    def helper(self):
        self.assertTrue(HELPER.exists(),'Reviewed six-model corrections are not implemented')
        return runpy.run_path(str(HELPER))

    def closed(self,geometry):
        v,f=geometry
        edges=collections.Counter(tuple(sorted((a,b))) for p in f for a,b in zip(p,p[1:]+p[:1]))
        self.assertTrue(all(n==2 for n in edges.values()))
        self.assertTrue(all(math.isfinite(c) for p in v for c in p))

    def test_surround_is_closed_with_real_circular_aperture_and_exact_bounds(self):
        h=self.helper();box={'min':[-.6,-.4,.492], 'max':[.6,.4,.552]}
        geometry=h['surround_mesh'](box,.252)
        self.closed(geometry);v,f=geometry
        for face in f:
            center=[sum(v[i][a] for i in face)/len(face) for a in range(3)]
            self.assertGreater(math.hypot(center[0],center[1]),.250)
        self.assertEqual(h['bounds'](v),box)

    def test_logs_are_four_closed_thick_split_sections_inside_original_bounds(self):
        h=self.helper();box={'min':[-.243,-.168,.336], 'max':[.236,.162,.480]}
        geometry=h['firewood_mesh'](box)
        self.closed(geometry);v,f=geometry
        self.assertEqual(h['bounds'](v),box)
        self.assertLess(sum(len(p)-2 for p in f),4000)
        # Four separate closed bodies, not the original pointed 8-sided rods.
        graph={i:set() for i in range(len(v))}
        for face in f:
            for a,b in zip(face,face[1:]+face[:1]):graph[a].add(b);graph[b].add(a)
        todo=set(graph);groups=[]
        while todo:
            group={todo.pop()};stack=list(group)
            while stack:
                for i in graph[stack.pop()]-group:group.add(i);todo.discard(i);stack.append(i)
            groups.append(group)
        self.assertEqual(len(groups),4)
        for group in groups:
            b=h['bounds']([v[i] for i in group]);self.assertGreater(b['max'][2]-b['min'][2],.035)

    def test_canopy_interior_sags_but_original_rib_boundaries_and_rim_match(self):
        h=self.helper();source=json.loads((ROOT/'assets-source/catalog-realism/catalog-612-source-evidence.json').read_text())
        o=next(o for o in source['models']['patio-parasol']['objects'] if o['name']=='curved_sewn_canopy_gore')
        v,f=h['canopy_mesh'](o['points'])
        original=h['bounds'](o['points']);current=h['bounds'](v)
        for side in ('min','max'):
            for a in range(3):self.assertAlmostEqual(current[side][a],original[side][a],places=6)
        self.assertGreater(len(v),len(o['points']))
        self.assertLess(sum(len(p)-2 for p in f),3500)
        self.assertTrue(all(len(set(p))==len(p) for p in f))

    def test_hollow_shade_is_open_top_and_bottom_with_thin_closed_shell(self):
        h=self.helper();geometry=h['shade_mesh'](.316,.518,.16,.114,.0015)
        self.closed(geometry)
        for face in geometry[1]:
            points=[geometry[0][i] for i in face]
            self.assertGreater(math.hypot(sum(p[0] for p in points)/len(points),sum(p[1] for p in points)/len(points)),.11)
        self.assertLess(sum(len(p)-2 for p in geometry[1]),1000)


if __name__=='__main__':unittest.main()
