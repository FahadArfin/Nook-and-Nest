import collections
from pathlib import Path
import runpy
import unittest

ROOT=Path(__file__).resolve().parents[1]


class Reviewed720Tests(unittest.TestCase):
    def helper(self):return runpy.run_path(str(ROOT/'tools/blender/catalog_realism/refinements/reviewed_720.py'))

    def test_headphone_cavity_backing_clears_original_cup_and_preserves_bounds(self):
        h=self.helper();box={'min':[-.055784617,-.038072914,.004009124],'max':[-.045015384,.038072914,.088200666]}
        cup={'min':[-.08,-.0425,0.],'max':[-.049230766,.0425,.092209794]}
        v,f,e=h['ear_pad'](box,cup)
        actual=h['bounds'](v)
        for side in ('min','max'):
            for a in range(3):self.assertAlmostEqual(actual[side][a],box[side][a],places=8)
        self.assertAlmostEqual(e['backingClearanceM'],.0006,places=8)
        self.assertGreater(e['earCavityDepthM'],.003)
        edges=collections.Counter(tuple(sorted((a,b))) for p in f for a,b in zip(p,p[1:]+p[:1]))
        self.assertTrue(all(n==2 for n in edges.values()))
        # The only ear-facing center surface is recessed behind the annular pad.
        center=[p for p in v if abs(p[1])<1e-10 and abs(p[2]-(box['min'][2]+box['max'][2])/2)<1e-10]
        self.assertTrue(all(p[0]<box['max'][0]-.003 for p in center))

    def test_closed_sliding_pair_has_overlap_track_clearance_and_same_envelope(self):
        h=self.helper();parts=h['closet_parts']();doors=[p for p in parts if p['role']=='leaf']
        self.assertEqual(len(doors),2)
        left,right=doors
        self.assertGreater(left['bounds']['max'][0],right['bounds']['min'][0])
        self.assertLess(left['bounds']['max'][1],right['bounds']['min'][1])
        for p in parts:
            b=p['bounds'];self.assertGreaterEqual(b['min'][0],-.9);self.assertLessEqual(b['max'][0],.9)
            self.assertGreaterEqual(b['min'][1],-.32500001);self.assertLessEqual(b['max'][1],.325)
            self.assertGreaterEqual(b['min'][2],0);self.assertLessEqual(b['max'][2],2.3)
        self.assertGreater(min(p['bounds']['max'][2]-p['bounds']['min'][2] for p in doors),2.)
        self.assertEqual({p['material'] for p in parts},{'wood-honey-textured','modern-recess-charcoal','modern-brushed-aluminum'})


if __name__=='__main__':unittest.main()
