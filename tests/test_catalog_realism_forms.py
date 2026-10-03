import runpy
import unittest
from pathlib import Path

forms = runpy.run_path(str(Path(__file__).resolve().parents[1] / 'tools/blender/catalog_realism/forms.py'))


class FormsTests(unittest.TestCase):
    def test_pillow_has_a_lofted_center_and_compressed_sewn_edge(self):
        geometry=runpy.run_path(str(Path(__file__).resolve().parents[1]/'tools/blender/catalog_realism/geometry.py'))
        shape=geometry['bedding_cover_position']
        center=shape(0,0,(.64,.42,.12),0,'top',0,'pillow',True)
        seam=shape(.32,0,(.64,.42,.12),0,'top',0,'pillow',True)
        bottom=shape(0,0,(.64,.42,.12),0,'bottom',0,'pillow',True)
        self.assertGreater(center[2]-seam[2],.05)
        self.assertAlmostEqual(bottom[2],-.06)

    def test_turned_recipe_requires_both_construction_and_material(self):
        choose = forms['ceramic_part']
        self.assertTrue(choose('table_lamp_ceramic_body.002', 72, 'ceramic'))
        self.assertTrue(choose('handthrown_terracotta_pot', 128, 'clay'))
        for name, count, profile in [('rectangular_vessel_basin', 64, 'ceramic'),
                                      ('ceramic_body_panel', 64, 'ceramic'),
                                      ('ceramic_body', 64, 'metal'),
                                      ('ceramic_body', 2048, 'ceramic'),
                                      ('tile', 64, 'ceramic')]:
            self.assertFalse(choose(name, count, profile))

    def test_leaf_outline_keeps_attachment_and_smooth_species_stations(self):
        width = forms['smooth_width']
        for t, expected in [(0, 0), (.23, .65), (.55, 1), (.84, .55), (1, 0)]:
            self.assertAlmostEqual(width(t), expected)
        self.assertTrue(all(0 <= width(i / 1000) <= 1 for i in range(1001)))
        for t in (.23, .55, .84):
            self.assertLess(abs((width(t + 1e-5)-width(t - 1e-5))/2e-5), .001)


if __name__ == '__main__':
    unittest.main()
