import collections
import json
import math
from pathlib import Path
import runpy
import unittest

ROOT=Path(__file__).resolve().parents[1]


class Reviewed828Tests(unittest.TestCase):
    def helper(self):return runpy.run_path(str(ROOT/'tools/blender/catalog_realism/refinements/reviewed_828.py'))
    def source(self,mid,name):
        d=json.loads((ROOT/'assets-source/catalog-realism/catalog-828-source-evidence.json').read_text())
        return next(o for o in d['models'][mid]['objects'] if o['name']==name)
    def closed(self,v,f):
        edges=collections.Counter(tuple(sorted((a,b))) for p in f for a,b in zip(p,p[1:]+p[:1]))
        self.assertTrue(all(n==2 for n in edges.values()))
    def test_sink_preserves_all_original_wall_vertices_and_adds_true_drain_passage(self):
        h=self.helper();o=self.source('vessel-sink','Fine rim vessel');v,f=h['drilled_vessel'](o['points'],o['polygons'])
        self.assertEqual(v[:len(o['points'])],o['points']);self.closed(v,f)
        for face in f:
            center=[sum(v[i][a] for i in face)/len(face) for a in range(3)]
            self.assertGreater(math.hypot(center[0],center[1]),.021)
        self.assertEqual(h['bounds'](v),h['bounds'](o['points']))
    def test_waffle_handle_is_constant_thickness_and_contacts_the_base(self):
        h=self.helper();v,f=h['waffle_handle'](-.17499999701976776);self.closed(v,f);b=h['bounds'](v)
        self.assertAlmostEqual(b['min'][1],-.17499999701976776,places=8)
        self.assertLess(b['min'][2],.06);self.assertLess(b['max'][2],.14)
        for j in range(0,len(v),16):
            row=v[j:j+16];center=[sum(p[a] for p in row)/16 for a in range(3)]
            self.assertTrue(all(abs(math.dist(p,center)-.008)<1e-8 for p in row))
    def test_stool_back_supports_overlap_seat_pan_and_back_pad_envelopes(self):
        h=self.helper();pan=self.source('upholstered-bar-stool','structural_seat_pan')['bounds'];back=self.source('upholstered-bar-stool','tailored_back_cushion')['bounds']
        supports=h['stool_supports'](pan,back)
        self.assertEqual(len(supports),2)
        for v,f in supports:
            self.closed(v,f);b=h['bounds'](v)
            self.assertLess(b['min'][2],pan['max'][2]);self.assertGreater(b['max'][2],back['min'][2]+.15)
            self.assertLessEqual(b['max'][1],back['max'][1]);self.assertGreaterEqual(b['min'][0],back['min'][0])


if __name__=='__main__':unittest.main()
