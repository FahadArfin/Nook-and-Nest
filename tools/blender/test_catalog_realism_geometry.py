"""Pure shape and contact contracts for the Blender geometry recipes."""
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]


class GeometryTests(unittest.TestCase):
    def setUp(self):
        spec = importlib.util.spec_from_file_location('catalog_geometry', ROOT / 'tools/blender/catalog_realism/geometry.py')
        self.g = importlib.util.module_from_spec(spec)
        try:
            spec.loader.exec_module(self.g)
        except ModuleNotFoundError as error:
            self.fail('Geometry selection and bounds helpers must run without Blender: ' + str(error))

    def test_rotated_pad_fit_preserves_exact_world_component_envelope(self):
        points = [(-.42, -.12, -.22), (.46, -.13, -.12), (.22, .10, .38), (-.30, .11, .35)]
        target = {'min': [1., 2., 3.], 'max': [1.60, 2.25, 3.40]}
        fitted = self.g.fit_points_to_bounds(points, target)
        actual = self.g.point_bounds(fitted)
        for side in ['min', 'max']:
            for a, b in zip(actual[side], target[side]):
                self.assertAlmostEqual(a, b, places=10)

    def test_pad_selector_uses_pillow_construction_over_legacy_palette(self):
        self.assertEqual(self.g.pad_recipe('queen-bed', 'bed', 'gusseted_pillow.001', ['modern-porcelain-detail'], 96), 'pillow')
        self.assertEqual(self.g.pad_recipe('sofa', 'seat', 'angled_back_cushion', ['upholstery-textured'], 96), 'back')
        self.assertIsNone(self.g.pad_recipe('sofa', 'seat', 'integrated_track_arm', ['upholstery-textured'], 96))
        self.assertIsNone(self.g.pad_recipe('chester-sofa', 'seat', 'seat_cushion', ['upholstery-textured'], 96))

    def test_shelf_pins_require_two_real_side_panels_and_remain_bounded(self):
        shelf = {'min': [-.4, -.22, .5], 'max': [.4, .22, .52]}
        sides = [{'min': [-.425, -.25, 0], 'max': [-.405, .25, 1.]}, {'min': [.405, -.25, 0], 'max': [.425, .25, 1.]}]
        envelope = {'min': [-.45, -.3, 0], 'max': [.45, .3, 1.]}
        pins = self.g.shelf_support_plan(shelf, sides, envelope)
        self.assertEqual(len(pins), 4)
        self.assertFalse(self.g.shelf_support_plan(shelf, sides[:1], envelope))
        for pin in pins:
            self.assertTrue(self.g.inside_bounds(pin['bounds'], envelope))
            self.assertLessEqual(pin['bounds']['max'][2], shelf['min'][2] + .001)

    def test_mounting_blocks_require_leg_contact_with_tabletop(self):
        top = {'min': [-.6, -.35, .72], 'max': [.6, .35, .75]}
        legs = [{'min': [-.5, -.27, 0], 'max': [-.44, -.21, .722]}, {'min': [.44, .21, 0], 'max': [.5, .27, .722]}]
        envelope = {'min': [-.6, -.35, 0], 'max': [.6, .35, .75]}
        self.assertEqual(len(self.g.mounting_block_plan(top, legs, envelope)), 2)
        distant = [{'min': [-.5, -.27, 0], 'max': [-.44, -.21, .4]}]
        self.assertEqual(self.g.mounting_block_plan(top, distant, envelope), [])

    def test_zero_geometry_change_cannot_be_reported_as_refinement(self):
        a = {'sha256': 'same', 'vertices': 8, 'triangles': 12, 'bounds': {'min': [0, 0, 0], 'max': [1, 1, 1]}}
        self.assertIsNone(self.g.change_evidence(a, a))
        b = dict(a, sha256='different', vertices=24, triangles=44)
        self.assertTrue(self.g.change_evidence(a, b)['geometryChanged'])

    def test_new_detail_uvs_do_not_collapse_cylinder_caps_or_box_sides(self):
        for normal, points in [((1, 0, 0), [(0, 0, 0), (0, .1, 0), (0, .1, .1)]),
                               ((0, 1, 0), [(0, 0, 0), (.1, 0, 0), (.1, 0, .1)]),
                               ((0, 0, 1), [(0, 0, 0), (.1, 0, 0), (.1, .1, 0)])]:
            a, b, c = [self.g.face_uv(p, normal) for p in points]
            determinant = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
            self.assertGreater(abs(determinant), .009)

    def test_welt_selection_does_not_jump_to_adjacent_cushion(self):
        pads = [{'bounds': {'min': [-1, 0, 0], 'max': [0, 1, .2]}},
                {'bounds': {'min': [.02, 0, 0], 'max': [1.02, 1, .2]}}]
        welt = {'min': [-.98, .02, .18], 'max': [-.01, .98, .205]}
        sample = {'min': [-.012, .8, .19], 'max': [-.008, .804, .194]}
        self.assertEqual(self.g.trim_candidate_indices('tailored_cushion_welt', welt, pads, sample), [0])
        self.assertEqual(self.g.trim_candidate_indices('decorative_metal_rail', welt, pads, sample), [])

    def test_merged_stitches_choose_per_component_instead_of_one_pad_for_entire_mesh(self):
        pads = [{'bounds': {'min': [-1, 0, 0], 'max': [0, 1, .2]}},
                {'bounds': {'min': [.02, 0, 0], 'max': [1.02, 1, .2]}}]
        mesh = {'min': [-.95, .02, .18], 'max': [.97, .98, .205]}
        sample = {'min': [.2, .8, .19], 'max': [.206, .804, .194]}
        self.assertEqual(self.g.trim_candidate_indices('Tailoring - individual saddle stitches', mesh, pads, sample), [1])

    def test_short_edge_groups_preserve_tube_rings_and_individual_stitches(self):
        points = [(0, 0, 0), (0, .003, 0), (0, .003, .003), (0, 0, .003),
                  (.1, 0, 0), (.1, .003, 0), (.1, .003, .003), (.1, 0, .003)]
        edges = [(0, 1), (1, 2), (2, 3), (3, 0), (4, 5), (5, 6), (6, 7), (7, 4), (0, 4), (1, 5), (2, 6), (3, 7)]
        self.assertEqual(self.g.trim_local_groups(points, edges), [[0, 1, 2, 3], [4, 5, 6, 7]])

    def test_pillow_welt_allows_embedded_source_but_seats_inside_new_surface(self):
        pair = {'component': 'gusseted_pillow.001',
                'bounds': {'min': [0, 0, .56], 'max': [.64, .42, .68]}}
        policy = self.g.pillow_welt_attachment('pillow_welt.001', pair, .0025)
        self.assertGreater(policy['sourceDistanceLimitM'], .02)
        self.assertLessEqual(policy['sourceDistanceLimitM'], .04)
        self.assertGreater(policy['surfaceOffsetM'], 0)
        self.assertLess(policy['surfaceOffsetM'], .0025)
        self.assertIsNone(self.g.pillow_welt_attachment('seat_cushion_welt', pair, .0025))
        self.assertIsNone(self.g.pillow_welt_attachment('pillow_welt', dict(pair, component='seat_cushion'), .0025))

    def test_pillow_long_spans_are_densified_independently_without_merging_rings(self):
        import math
        points = [(x, .0025*math.cos(i*math.tau/8), .0025*math.sin(i*math.tau/8))
                  for x in (0, .48, .72) for i in range(8)]
        edges = [(r*8+i,r*8+(i+1)%8) for r in range(3) for i in range(8)]
        edges += [(r*8+i,(r+1)*8+i) for r in range(2) for i in range(8)]
        plans = self.g.pillow_welt_subdivisions(points,edges)
        self.assertEqual(len(plans),2)
        self.assertNotEqual(plans[0]['cuts'],plans[1]['cuts'])
        for plan in plans:
            self.assertEqual(len(plan['edgeIndices']),8)
            self.assertGreater(plan['maxSpanM']/(plan['cuts']+1),.007)
            self.assertLessEqual(plan['maxSpanM']/(plan['cuts']+1),.016)

    def test_missing_stitch_uv_role_is_exact_and_never_overwrites_authored_uv(self):
        component = 'Tailoring - individual saddle stitches'
        self.assertTrue(self.g.uvless_stitch_role('chair-sleeper',component,['household-slate-fabric'],[]))
        self.assertTrue(self.g.uvless_stitch_role('chair-sleeper-open',component,['entry-slate-upholstery'],[]))
        self.assertFalse(self.g.uvless_stitch_role('chair-sleeper',component,['household-slate-fabric'],['UVMap']))
        self.assertFalse(self.g.uvless_stitch_role('sofa',component,['household-slate-fabric'],[]))
        self.assertFalse(self.g.uvless_stitch_role('chair-sleeper','artwork',['household-slate-fabric'],[]))
        self.assertFalse(self.g.uvless_stitch_role('chair-sleeper',component,['original-printed-art'],[]))

    def test_missing_stitch_uvs_have_physical_scale_and_nonzero_area_on_each_axis(self):
        for points in [[(0,0,0),(.003,0,0),(.003,.006,0)],
                       [(0,0,0),(0,.003,0),(0,.003,.006)],
                       [(0,0,0),(.003,0,0),(.003,0,.006)]]:
            uv = self.g.uvless_stitch_uvs(points,[(0,1,2)],.3)[0]
            self.assertAlmostEqual(abs(uv[1][0]-uv[0][0]),.01)
            determinant=(uv[1][0]-uv[0][0])*(uv[2][1]-uv[0][1])-(uv[2][0]-uv[0][0])*(uv[1][1]-uv[0][1])
            self.assertAlmostEqual(abs(determinant),.0002)


if __name__ == '__main__':
    unittest.main()
