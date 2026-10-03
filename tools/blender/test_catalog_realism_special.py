"""Measured additive detail contracts; no Blender runtime required."""
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('catalog_special', ROOT / 'tools/blender/catalog_realism/special.py')
special = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(special)


class SpecialDetailTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = json.loads((ROOT / 'assets-source/catalog-realism/source-inventory.json').read_text())['models']

    def test_explicit_models_have_bounded_additions_from_measured_components(self):
        for model_id in special.SUPPORTED:
            with self.subTest(model=model_id):
                result = special.plan(model_id, self.source[model_id]['objects'])
                self.assertTrue(result)
                for addition in result:
                    self.assertTrue(special.contained(addition['bounds'], addition['originalEnvelope']))
                    self.assertTrue(addition['name'].startswith(('detail_casework_', 'detail_fastener_')))
                    self.assertTrue(addition['contactEvidence'])
        self.assertEqual(special.plan('unreviewed-model', []), [])

    def test_all_aquarium_additions_use_opaque_casework_and_clear_entire_glass_water_union(self):
        for model_id in special.AQUARIUMS:
            rows = self.source[model_id]['objects']
            before = json.dumps(rows, sort_keys=True)
            for addition in special.plan(model_id, rows):
                self.assertEqual(addition['materialKey'], 'aquarium-charcoal-frame')
                exclusion = addition['contactEvidence']['glassWaterExclusion']
                self.assertTrue(special.separated(addition['bounds'], exclusion))
            self.assertEqual(before, json.dumps(rows, sort_keys=True))

    def test_art_profile_stays_behind_image_plane_and_outside_image_rectangle(self):
        for model_id in ['anime-landscape-1', 'anime-landscape-2', 'anime-landscape-3']:
            addition = special.plan(model_id, self.source[model_id]['objects'])[0]
            rect = addition['contactEvidence']['clearImageRectangleXZ']
            image_y = addition['contactEvidence']['imagePlaneY']
            for x, y, z in addition['vertices']:
                self.assertGreater(y, image_y)
                self.assertTrue(x <= rect[0] + 1e-8 or x >= rect[1] - 1e-8 or z <= rect[2] + 1e-8 or z >= rect[3] - 1e-8)

    def test_static_closet_hardware_stays_above_both_leafs(self):
        for addition in special.plan('door-closet-sliding', self.source['door-closet-sliding']['objects']):
            self.assertGreater(addition['bounds']['min'][2], addition['contactEvidence']['leafTopZ'] + .002)

    def test_stone_bearing_collar_bridges_actual_pedestal_gap(self):
        addition = special.plan('outdoor-round-conversation-table', self.source['outdoor-round-conversation-table']['objects'])[0]
        evidence = addition['contactEvidence']
        self.assertLess(addition['bounds']['min'][2], evidence['coreTopZ'])
        self.assertGreater(addition['bounds']['max'][2], evidence['tabletopUndersideZ'])
        self.assertAlmostEqual(evidence['jointGapM'], .008489906787872314)
        for face_uv in addition['uvFaces']:
            a, b, c = face_uv[:3]
            self.assertGreater(abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])), 1e-8)

    def test_changed_or_missing_authored_components_fail_closed(self):
        rows = self.source['desktop-aquarium']['objects']
        missing = [r for r in rows if 'aquarium-clear-glass' not in r['materials']]
        with self.assertRaisesRegex(ValueError, 'exclusion'):
            special.plan('desktop-aquarium', missing)
        self.assertFalse(special._opaque({'alphaMode': 'BLEND'}))
        self.assertFalse(special._opaque({'extensions': {'KHR_materials_transmission': {}}}))
        self.assertFalse(special._opaque({'emissiveFactor': [.1, 0, 0]}))
        self.assertTrue(special._opaque({'name': 'casework'}))

    def test_sofa_back_connects_platform_and_both_arms_without_moving_any_source_part(self):
        for mid in special.SOFA_FAMILY:
            with self.subTest(model=mid):
                rows = self.source[mid]['objects']
                unchanged = json.dumps(rows, sort_keys=True)
                addition = special.plan(mid, rows)[0]
                e, b = addition['contactEvidence'], addition['bounds']
                self.assertLess(b['min'][2], e['platformBounds']['max'][2])
                self.assertLess(b['min'][1], e['platformBounds']['max'][1])
                self.assertLess(b['min'][0], e['leftArmBounds']['max'][0])
                self.assertGreater(b['max'][0], e['rightArmBounds']['min'][0])
                self.assertGreater(b['max'][2], e['backCushionBounds']['min'][2])
                self.assertEqual(e['bevelSegments'], 3)
                self.assertEqual(unchanged, json.dumps(rows, sort_keys=True))

    def test_armchair_uprights_connect_rear_legs_seat_pan_and_back(self):
        result = special.plan('armchair', self.source['armchair']['objects'])
        self.assertEqual(len(result), 2)
        for addition in result:
            e = addition['contactEvidence']
            self.assertEqual(addition['materialKey'], 'modern-brushed-aluminum')
            for point, owner in [(e['attachmentCenters'][0], e['rearLegBounds']),
                                 (e['attachmentCenters'][1], e['seatPanBounds']),
                                 (e['attachmentCenters'][-1], e['backCushionBounds'])]:
                self.assertTrue(special.contained({'min': point, 'max': point}, owner))


if __name__ == '__main__':
    unittest.main()
