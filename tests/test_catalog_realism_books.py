"""Pure geometry and source-evidence checks; no Blender process is started."""
import json
import math
from pathlib import Path
import runpy
import unittest

ROOT = Path(__file__).resolve().parents[1]
MODULE = ROOT / 'tools/blender/catalog_realism/books.py'
BOOKS = runpy.run_path(str(MODULE)) if MODULE.exists() else {}


class BookConstructionTests(unittest.TestCase):
    def test_only_exact_authored_book_groups_are_selected(self):
        inventory = json.loads((ROOT/'assets-source/catalog-realism/source-inventory.json').read_text())
        for model_id, count in [('bookshelf', 24), ('books-upright', 7), ('books-stacked', 5)]:
            groups = BOOKS['source_groups'](model_id, inventory['models'][model_id]['objects'])
            self.assertEqual(len(groups), count)
            for group in groups:
                self.assertNotIn('shelf', group['body']['name'])
        self.assertEqual(BOOKS['source_groups']('desk', [{'name': 'book_0'}]), [])

    def test_missing_or_protected_source_components_fail_closed(self):
        rows = json.loads((ROOT/'assets-source/catalog-realism/source-inventory.json').read_text())['models']['bookshelf']['objects']
        with self.assertRaisesRegex(ValueError, 'exactly|authored|count'):
            BOOKS['source_groups']('bookshelf', [row for row in rows if row['name'] != 'book_23'])
        rows = json.loads(json.dumps(rows));next(row for row in rows if row['name'] == 'book_0')['motionRole'] = 'sliding_leaf'
        with self.assertRaisesRegex(ValueError, 'protected|motion'):
            BOOKS['source_groups']('bookshelf', rows)

    def test_covers_spine_and_recessed_pages_are_closed_bounded_distinct_construction(self):
        for orientation, high in [('upright', [.07,.15,.25]), ('stacked', [.33,.23,.045])]:
            bounds = {'min':[0,0,0], 'max':high}
            parts = BOOKS['book_geometry'](bounds, orientation, 'cover-key', 'linen-textured')
            self.assertEqual(len([p for p in parts if p['role']=='cover-board']), 2)
            self.assertTrue({'page-block','rounded-spine','spine-label'}.issubset({p['role'] for p in parts}))
            triangles = 0
            for part in parts:
                self.assertIn(part['materialKey'], ['cover-key','linen-textured'])
                self.assertTrue(all(math.isfinite(v) for point in part['vertices'] for v in point))
                self.assertTrue(all(-1e-9 <= point[i] <= high[i]+1e-9 for point in part['vertices'] for i in range(3)))
                edges = {}
                for face in part['faces']:
                    triangles += len(face)-2
                    for a,b in zip(face, face[1:]+face[:1]):
                        edge = tuple(sorted((a,b)));edges[edge]=edges.get(edge,0)+1
                self.assertTrue(all(count==2 for count in edges.values()), part['role'])
                volume = 0
                for face in part['faces']:
                    a=part['vertices'][face[0]]
                    for i in range(1,len(face)-1):
                        b,c=part['vertices'][face[i]],part['vertices'][face[i+1]]
                        volume += sum(a[j]*(b[(j+1)%3]*c[(j+2)%3]-b[(j+2)%3]*c[(j+1)%3]) for j in range(3))/6
                self.assertGreater(volume, 0, part['role'])
            self.assertLess(triangles, 800)
            pages=next(p for p in parts if p['role']=='page-block')
            thickness_axis=0 if orientation=='upright' else 2
            self.assertGreater(min(p[thickness_axis] for p in pages['vertices']), 0)
            self.assertLess(max(p[thickness_axis] for p in pages['vertices']), high[thickness_axis])

    def test_fine_paper_uv_density_targets_page_faces_only(self):
        for orientation, high in [('upright', [.07,.15,.25]), ('stacked', [.33,.23,.045])]:
            parts=BOOKS['book_geometry']({'min':[0,0,0],'max':high},orientation,'linen-textured')
            for part in parts:
                self.assertEqual(part['paperFaces'],part['role']=='page-block')
            # Even white covers, spine labels and rules keep their existing scale.
            for normal in [(1,0,0),(0,1,0),(0,0,1)]:
                ordinary=BOOKS['face_uv']((.03,.07,.12),normal,False)
                paper=BOOKS['face_uv']((.03,.07,.12),normal,True)
                self.assertEqual(paper,tuple(value*12 for value in ordinary))
            self.assertEqual(BOOKS['PAPER_FACE_ATTRIBUTE'],'catalog_paper_faces')


if __name__ == '__main__':
    unittest.main()
