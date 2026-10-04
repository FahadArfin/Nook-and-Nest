from collections import Counter
from pathlib import Path
import math
import runpy
import unittest

API=runpy.run_path(str(Path(__file__).resolve().parents[1]/'tools/blender/catalog_realism/refinements/desk_appliance_construction.py'))


def rings(path,sides,radius=.009):
    return [(p[0]+radius*math.cos(i*math.tau/sides),p[1]+radius*math.sin(i*math.tau/sides),p[2]) for p in path for i in range(sides)]


def assert_closed(test,geometry):
    vertices,faces=geometry
    edges=Counter(tuple(sorted((a,b))) for f in faces for a,b in zip(f,f[1:]+f[:1]))
    test.assertEqual(set(edges.values()),{2})
    test.assertTrue(all(math.dist(vertices[a],vertices[b])>1e-9 for a,b in edges))
    test.assertLess(sum(len(f)-2 for f in faces),10000)


class DeskApplianceTests(unittest.TestCase):
    def test_ear_cavities_face_inward_and_keep_closed_backings(self):
        for side in (-1,1):
            box={'min':[side*.07-.011,-.041,.10],'max':[side*.07+.011,.041,.223]}
            geometry=API['headset_pad'](box);assert_closed(self,geometry)
            self.assertEqual(API['bounds'](geometry[0]),box)
            cy=0;cz=(.10+.223)/2
            center=[v for v in geometry[0] if abs(v[1]-cy)<1e-9 and abs(v[2]-cz)<1e-9]
            self.assertEqual(len(center),2)
            inward=box['max'][0] if side==-1 else box['min'][0]
            self.assertGreater(min(abs(v[0]-inward) for v in center),.014)
            # Retained cup extends27.1% through the pad; dark cavity floor must
            # clear it rather than reveal an orange wooden face through the pad.
            floor=max(v[0] for v in center) if side==-1 else min(v[0] for v in center)
            cup=box['min'][0]+.271*.022 if side==-1 else box['max'][0]-.271*.022
            self.assertGreater((floor-cup)*-side,.001)

    def test_trap_is_closed_and_keeps_measured_envelope(self):
        path=[(0,-.017,.376),(0,-.017,.298),(0,.005,.27),(0,.066,.27),(0,.086,.305),(0,.086,.351),(0,.209,.351)]
        source=rings(path,12,.022);geometry=API['trap'](source);assert_closed(self,geometry)
        for side in ('min','max'):
            for actual,expected in zip(API['bounds'](geometry[0])[side],API['bounds'](source)[side]):self.assertAlmostEqual(actual,expected,places=12)

    def test_handle_stays_inside_the_original_four_station_bounds(self):
        source=rings([(.05,.02,.365),(.108,.02,.365),(.108,.02,.216),(.046,.02,.216)],10)
        geometry=API['blender_handle'](source);assert_closed(self,geometry)
        self.assertEqual(API['bounds'](geometry[0]),API['bounds'](source))

    def test_headset_stand_uses_a_continuous_noncollapsed_sweep(self):
        source=rings([(0,.028,.012),(0,.036,.06),(0,.026,.16),(0,0,.272)],12,.011)
        geometry=API['smooth_stand'](source);assert_closed(self,geometry)
        self.assertEqual(API['bounds'](geometry[0]),API['bounds'](source))
        with self.assertRaises(ValueError):API['smooth_stand'](source[:-1])


if __name__=='__main__':unittest.main()
