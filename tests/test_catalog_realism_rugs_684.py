import collections
import math
from pathlib import Path
import runpy
import unittest

ROOT=Path(__file__).resolve().parents[1]


class ReviewedRugTests(unittest.TestCase):
    def load(self,name):
        entry=runpy.run_path(str(ROOT/'tools/blender/catalog_realism/refinements'/f'{name}.py'))
        helper=runpy.run_path(str(ROOT/'tools/blender/catalog_realism/refinements/reviewed_rugs_684.py'))
        return entry,helper

    def test_three_continuous_bodies_are_closed_bounded_and_preserve_palette(self):
        for name in ('round-rug','runner-rug','scallop-rug'):
            entry,h=self.load(name)
            specs=[s for s in entry['SOURCE_COMPONENTS'] if 'fringe' not in s['name']]
            vertices,faces,keys=h['rug_body'](name,specs)
            edges=collections.Counter(tuple(sorted((a,b))) for f in faces for a,b in zip(f,f[1:]+f[:1]))
            self.assertTrue(all(n==2 for n in edges.values()),name)
            expected={s:[fn(o['bounds'][s][a] for o in specs) for a in range(3)] for s,fn in [('min',min),('max',max)]}
            actual=h['bounds'](vertices)
            for side in ('min','max'):
                for a in range(3):self.assertAlmostEqual(actual[side][a],expected[side][a],places=6)
            self.assertEqual(set(keys),set(k for s in specs for k in s['materials']))
            self.assertLess(sum(len(f)-2 for f in faces),18000)
            # Single shared face geometry: colored regions introduce no raised islands.
            self.assertEqual(len(keys),len(faces))

    def test_runner_fringe_is_separate_closed_strands_with_measured_extents(self):
        entry,h=self.load('runner-rug')
        spec=next(s for s in entry['SOURCE_COMPONENTS'] if 'fringe' in s['name'])
        v,f=h['fringe'](spec['bounds'])
        self.assertEqual(h['bounds'](v),spec['bounds'])
        edges=collections.Counter(tuple(sorted((a,b))) for p in f for a,b in zip(p,p[1:]+p[:1]))
        self.assertTrue(all(n==2 for n in edges.values()))
        self.assertGreater(len(v),96)
        self.assertLess(sum(len(p)-2 for p in f)*24,17000)

    def test_scallop_followup_has_no_dart_discontinuities_and_remains_closed(self):
        entry,h=self.load('scallop-rug')
        follow=runpy.run_path(str(ROOT/'tools/blender/catalog_realism/refinements/scallop_outline_684.py'))
        points=follow['outline'](entry['SOURCE_COMPONENTS'])
        self.assertLess(max(math.dist(a,b) for a,b in zip(points,points[1:]+points[:1])),.03)
        v,f,keys=follow['geometry'](entry['SOURCE_COMPONENTS'])
        edges=collections.Counter(tuple(sorted((a,b))) for p in f for a,b in zip(p,p[1:]+p[:1]))
        self.assertTrue(all(n==2 for n in edges.values()))
        original=h['rug_body']('scallop-rug',entry['SOURCE_COMPONENTS'])
        actual=h['bounds'](v);expected=h['bounds'](original[0])
        for side in ('min','max'):
            for a in range(3):self.assertAlmostEqual(actual[side][a],expected[side][a],places=9)
        self.assertLess(sum(len(p)-2 for p in f),15000)


if __name__=='__main__':unittest.main()
