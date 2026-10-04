import collections
import math
from pathlib import Path
import runpy
import unittest

ROOT = Path(__file__).resolve().parents[1]
HELPER = ROOT / 'tools/blender/catalog_realism/refinements/reviewed_living.py'


class LivingReviewTests(unittest.TestCase):
    def helper(self):
        self.assertTrue(HELPER.exists(), 'The exact reviewed construction helper is not implemented')
        return runpy.run_path(str(HELPER))

    def test_art_axes_are_upright_and_square_texels_remain_square(self):
        h = self.helper(); box = {'min': [-.378,-.0413,.06825], 'max': [.378,-.0259,.58175]}
        low = h['art_uv']((-.378,-.0413,.06825), box)
        right = h['art_uv']((.378,-.0413,.06825), box)
        top = h['art_uv']((-.378,-.0413,.58175), box)
        self.assertEqual(low[0], 0); self.assertEqual(right[0], 1)
        self.assertEqual(low[1], right[1]); self.assertEqual(low[0], top[0])
        self.assertGreater(top[1], low[1])
        self.assertAlmostEqual((right[0]-low[0])/.756, (top[1]-low[1])/.5135)
        self.assertGreaterEqual(low[1], 0); self.assertLessEqual(top[1], 1)

    def test_welt_sampling_has_no_long_floating_chords_and_closes(self):
        h = self.helper()
        line = h['rounded_loop'](-.62,.62,.46,.83,.035,.008)
        self.assertGreater(len(line), 300)
        for a,b in zip(line,line[1:]+line[:1]):
            self.assertGreater(math.dist(a,b), 1e-7)
            self.assertLessEqual(math.dist(a,b), .008001)
        centers=[(x,0,z) for x,z in line]; normals=[(0,-1,0)]*len(line)
        vertices,faces=h['sewn_tube'](centers,normals,.0024)
        edges=collections.Counter(tuple(sorted((a,b))) for f in faces for a,b in zip(f,f[1:]+f[:1]))
        self.assertTrue(all(n==2 for n in edges.values()))
        self.assertEqual(len(vertices),len(line)*8)

    def test_support_connects_measured_deck_backs_and_arms_inside_original_bounds(self):
        h=self.helper(); plan=h['loveseat_supports'](); self.assertEqual(len(plan),3)
        back=plan[0]['bounds']
        self.assertLess(back['min'][2], .35708)
        self.assertGreater(back['max'][2], .65923)
        self.assertLess(back['min'][1], .41716)
        self.assertGreater(back['max'][1], .41286)
        for row in plan:
            for axis,limit in enumerate([.725,.43,.85]):
                self.assertLessEqual(row['bounds']['max'][axis],limit)
                self.assertGreaterEqual(row['bounds']['min'][axis],0 if axis==2 else -limit)

    def test_closed_lift_case_has_real_reveal_slot_storage_floor_and_hinges(self):
        h=self.helper(); plan=h['lift_construction'](); roles={p['role'] for p in plan}
        self.assertTrue({'storage-floor','storage-side','storage-back','finger-pull-left','finger-pull-right','hinge-pin','folded-lift-link','top-mount'}.issubset(roles))
        walls=[p for p in plan if p['role'].startswith('storage-') or p['role'].startswith('finger-pull-')]
        self.assertAlmostEqual(max(p['bounds']['max'][2] for p in walls),.402)
        self.assertGreater(.4071633517742157-.402,.004)
        left=next(p for p in plan if p['role']=='finger-pull-left');right=next(p for p in plan if p['role']=='finger-pull-right')
        self.assertAlmostEqual(right['bounds']['min'][0]-left['bounds']['max'][0],.16)
        for p in plan:
            verts=h['part_geometry'](p)[0]
            for v in verts:
                self.assertTrue(-.55<=v[0]<=.55 and -.3<=v[1]<=.3 and 0<=v[2]<=.46)

    def test_reading_welt_budget_preserves_short_closed_runs(self):
        path=HELPER.with_name('reading_welt.py')
        self.assertTrue(path.exists(), 'Loveseat-only seam cost/contact correction is not implemented')
        h=runpy.run_path(str(path));base=self.helper()
        old=[(x,0,z) for x,z in base['rounded_loop'](-.32,.32,.45,.85,.035,.008)]
        revised=h['smooth_resample'](old,.012)
        self.assertLess(len(revised),len(old)*.8)
        for a,b in zip(revised,revised[1:]+revised[:1]):self.assertLessEqual(math.dist(a,b),.012001)
        vertices,faces=base['sewn_tube'](revised,[(0,-1,0)]*len(revised),.0024,sides=6)
        self.assertLess(len(faces)*2, len(old)*16*.65)
        for v in revised:self.assertTrue(-.320000000001<=v[0]<=.320000000001 and .449999999999<=v[2]<=.850000000001)


if __name__ == '__main__': unittest.main()
