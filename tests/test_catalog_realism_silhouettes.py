"""Manufactured curves retain source envelopes and form closed oriented shells."""
from collections import Counter
from pathlib import Path
import runpy
import unittest

M=runpy.run_path(str(Path(__file__).resolve().parents[1]/'tools/blender/catalog_realism/refinements/silhouette_geometry.py'))


class SilhouetteTests(unittest.TestCase):
    def check_shell(self,mesh,box):
        points,faces=mesh;edges=Counter();direction=Counter()
        for face in faces:
            self.assertGreaterEqual(len(set(face)),3)
            for a,b in zip(face,face[1:]+face[:1]):
                edges[tuple(sorted((a,b)))]+=1;direction[(a,b)]+=1
        self.assertEqual(set(edges.values()),{2})
        self.assertTrue(all(direction[a,b]==direction[b,a] for a,b in direction))
        actual=M['bounds'](points)
        for side in ('min','max'):
            for a in range(3):self.assertAlmostEqual(actual[side][a],box[side][a],places=8)
        self.assertLess(sum(len(face)-2 for face in faces),14000)

    def test_arched_glass_and_frame_have_planar_caps_and_no_overlapping_disc(self):
        box={'min':[-.31,-.03,0],'max':[.31,.03,1.0744]}
        mesh=M['arched_panel'](box);self.check_shell(mesh,box)
        points,faces=mesh
        for face in faces[:2]:self.assertEqual(len({points[i][1] for i in face}),1)
        self.assertEqual(len(points),134)

    def test_opal_dome_is_closed_dense_and_inside_original_extents(self):
        box={'min':[-.09,-.09,.159],'max':[.09,.09,.26]}
        mesh=M['dome'](box);self.check_shell(mesh,box)
        self.assertGreater(len(mesh[0]),2500)

    def test_hollow_cone_retains_both_openings_with_closed_wall_rims(self):
        box={'min':[-.1,-.07,.4],'max':[.1,.07,.55]}
        mesh=M['lathe']([(.022,.55),(.13,.4),(.124,.4),(.018,.545)],box)
        self.check_shell(mesh,box)
        self.assertTrue(all(abs(p[0])+abs(p[1])>1e-6 for p in mesh[0]))

    def test_arc_is_continuous_bounded_and_seated_at_shade(self):
        box={'min':[-.291,-.0146,.04],'max':[.2575,.0146,1.8]}
        shade={'min':[.0477,-.21,1.4837],'max':[.45,.21,1.66245]}
        mesh=M['arc_tube'](box,shade);self.check_shell(mesh,box)
        endpoint=[sum(p[a] for p in mesh[0][-16:])/16 for a in range(3)]
        self.assertGreater(endpoint[2],shade['max'][2]-.02)
        self.assertLess(endpoint[2],shade['max'][2]+.01)
        self.assertAlmostEqual(endpoint[0],(shade['min'][0]+shade['max'][0])/2,delta=.006)


if __name__=='__main__':unittest.main()
