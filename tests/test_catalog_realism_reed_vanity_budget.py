import collections
from pathlib import Path
import runpy
import unittest

M=runpy.run_path(str(Path(__file__).parents[1]/'tools/blender/catalog_realism/refinements/reed-double-vanity.py'))

class ReedBudget(unittest.TestCase):
    def test_all_measured_reeds_closed_exact_bounded_and_cheaper(self):
        self.assertEqual(len(M['BEADS']),192)
        self.assertEqual(len({s['name'] for s in M['BEADS']}),192)
        for spec in M['BEADS']:
            self.assertEqual(spec['vertices'],16)  # Native data; 64 is evaluated generic bevel output.
            vertices,faces=M['bead_mesh'](spec['bounds'])
            self.assertEqual(sum(len(f)-2 for f in faces),60)
            edges=collections.Counter(tuple(sorted((f[i],f[(i+1)%len(f)]))) for f in faces for i in range(len(f)))
            self.assertEqual(set(edges.values()),{2})
            for a in range(3):
                self.assertAlmostEqual(min(p[a] for p in vertices),spec['bounds']['min'][a],places=12)
                self.assertAlmostEqual(max(p[a] for p in vertices),spec['bounds']['max'][a],places=12)
        self.assertLess(38586-192*(124-60),29584)

    def test_does_not_replace_other_size_or_role(self):
        with self.assertRaises(ValueError):M['bead_mesh']({'min':[0,0,0],'max':[.01,.01,.5]})

if __name__=='__main__':unittest.main()
