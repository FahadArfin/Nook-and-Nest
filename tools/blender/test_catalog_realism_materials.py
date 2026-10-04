"""Compatibility and role regressions; runs without Blender."""
import importlib.util
import copy
from io import BytesIO
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest

ROOT = Path(__file__).resolve().parents[2]
MODULE = ROOT / 'tools/blender/catalog_realism/materials.py'


class MaterialPlanTests(unittest.TestCase):
    def setUp(self):
        self.assertTrue(MODULE.exists(), 'Catalog material implementation is missing')
        spec = importlib.util.spec_from_file_location('catalog_materials', MODULE)
        self.m = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.m)

    def test_leaf_and_rug_names_do_not_become_timber(self):
        self.assertEqual(self.m.classify('maple-tree', 'maple-ochre', {})['profile'], 'leaf')
        self.assertEqual(self.m.classify('braided-rug', 'wood-dark', {})['profile'], 'fabric')
        self.assertEqual(self.m.classify('checker-rug', 'wood-dark', {})['profile'], 'fabric')
        self.assertEqual(self.m.classify('bookshelf', 'wood-dark', {})['profile'], 'wood')

    def test_special_materials_and_aquariums_are_preserved(self):
        for model, key, mat in [('planted-aquarium', 'wood-dark', {}),
                               ('poster', 'original-studio-art', {}),
                               ('lamp', 'arbitrary', {'emissiveFactor': [1, 0, 0]}),
                               ('chair', 'arbitrary', {'alphaMode': 'BLEND'}),
                               ('desk', 'countertop-surface', {})]:
            result = self.m.classify(model, key, mat)
            self.assertIsNone(result['profile'])
            self.assertTrue(result['protectedReason'])

    def test_unknown_and_suffixes_are_never_silently_guessed(self):
        self.assertEqual(self.m.classify('unknown-model', 'mystery', {})['status'], 'unclassified')
        self.assertEqual(self.m.classify('unknown-model', 'wood-dark.999', {})['status'], 'unclassified')

    def test_legacy_wood_keys_on_molded_products_do_not_gain_woodgrain(self):
        for model in ['smart-pet-feeder', 'pet-water-fountain', 'rotating-cat-litter-box', 'sonos-era-100', 'brick-space-cruiser']:
            self.assertEqual(self.m.classify(model, 'wood-honey-textured', {})['profile'], 'polymer')

    def test_metres_projection_retains_physical_scale_and_handles_rotation(self):
        # The projection uses evaluated part-local axes with metric lengths;
        # scale is a per-profile Mapping operation, never destructive UV edits.
        a = self.m.project_metres((.2, .1, .4), (0, 0, 1), (1, 1, 1), False)
        b = self.m.project_metres((.4, .1, .4), (0, 0, 1), (1, 1, 1), False)
        self.assertAlmostEqual(abs(b[0] - a[0]), .2)

    def test_only_tagged_book_page_faces_receive_twelve_times_uv_density(self):
        attribute = SimpleNamespace(domain='FACE', data_type='BOOLEAN',
                                    data=[SimpleNamespace(value=True), SimpleNamespace(value=False)])
        mesh = SimpleNamespace(attributes={'catalog_paper_faces': attribute})
        self.assertEqual(self.m.face_uv_density(mesh, 0), 12.0)
        self.assertEqual(self.m.face_uv_density(mesh, 1), 1.0)
        self.assertEqual(self.m.face_uv_density(SimpleNamespace(attributes={}), 0), 1.0)
        attribute.domain = 'POINT'
        with self.assertRaises(ValueError):
            self.m.face_uv_density(mesh, 0)

    def test_generated_library_is_deterministic_and_lossless(self):
        with tempfile.TemporaryDirectory() as temporary:
            a = self.m.create_library(temporary)
            b = self.m.create_library(temporary)
            self.assertEqual(a, b)
            for maps in a.values():
                for record in maps.values():
                    self.assertTrue((Path(temporary) / record['path']).read_bytes().startswith(b'\x89PNG'))
                    self.assertEqual(record['colorSpace'], 'Non-Color')

    def test_scanned_roughness_keeps_spatial_detail_and_neutral_other_channels(self):
        from PIL import Image
        source = Image.new('L', (3, 2))
        source.putdata([0, 64, 255, 192, 128, 32])
        encoded = BytesIO(); source.save(encoded, format='PNG')
        packed = self.m.pack_scanned_roughness(encoded.getvalue(), (.5, .65))
        result = Image.open(BytesIO(packed))
        self.assertEqual(result.size, source.size, 'Scan must not be resized or rotated')
        self.assertEqual([result.getpixel((x, y)) for y in range(2) for x in range(3)], [(255, 128, 255), (255, 137, 255),
                         (255, 166, 255), (255, 156, 255), (255, 147, 255), (255, 132, 255)])
        # No added periodic crosshatch may obscure the measured grain pattern.
        self.assertEqual(packed, self.m.pack_scanned_roughness(encoded.getvalue(), (.5, .65)))

    def test_plan_keeps_exact_keys_and_default_color(self):
        baseline = {'name': 'fish-pearl-stripe.002', 'pbrMetallicRoughness': {'baseColorFactor': [.2, .3, .4, .7]}}
        result = self.m.material_record('planted-aquarium', baseline)
        self.assertEqual(result['materialKey'], 'fish-pearl-stripe.002')
        self.assertEqual(result['baseline']['baseColorFactor'], [.2, .3, .4, .7])

    def test_white_cloth_sheen_is_reduced_without_recoloring_base(self):
        original = {'name': 'upholstery-textured', 'pbrMetallicRoughness': {'baseColorFactor': [.2, .4, .1, 1]},
                    'extensions': {'KHR_materials_sheen': {'sheenColorFactor': [1, 1, 1]}}}
        record = self.m.material_record('sofa', original)
        self.assertEqual(record['surfaceAdjustments'][0]['value'], [.032, .064, .016])
        self.assertEqual(record['baseline']['baseColorFactor'], [.2, .4, .1, 1])
        self.assertEqual(self.m.classify('queen-bed', 'modern-porcelain-detail', {})['profile'], 'fabric')

    def test_bed_mattress_and_pillow_role_overrides_are_exact_and_evidenced(self):
        beds = ['canopy-bed', 'channel-upholstered-bed', 'floating-platform-bed',
                'low-platform-bed', 'metal-canopy-bed', 'queen-bed', 'single-bed',
                'storage-lift-bed', 'storage-platform-bed', 'wingback-bed']
        for model in beds:
            role = self.m.classify(model, 'modern-porcelain-detail', {})
            self.assertEqual(role['profile'], 'fabric', model)
            self.assertIn('gusseted_pillow', role['roleEvidence'])
        for model in ['pedestal-sink', 'two-piece-toilet', 'unknown-bed']:
            self.assertEqual(self.m.classify(model, 'modern-porcelain-detail', {})['profile'], 'ceramic')

    def test_motion_subtree_materials_are_protected_even_when_shared_by_static_parts(self):
        document = {'materials': [{'name': 'leaf'}, {'name': 'wood-dark'}],
                    'meshes': [{'primitives': [{'material': 0}]}, {'primitives': [{'material': 1}]}],
                    'nodes': [{'extras': {'shared_geometry': True}, 'children': [1]},
                              {'mesh': 0}, {'mesh': 0}, {'mesh': 1}]}
        self.assertEqual(self.m._protected_motion_keys(document), {'leaf'})

    def test_scan_exception_requires_explicit_existing_ordinary_albedo_and_separate_uv(self):
        material = {'name': 'wood-dark', 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}}}
        entry = self.m.material_record('bookshelf', material)
        request = {'materialKey': 'wood-dark', 'kind': 'baseColor', 'profile': 'wood', 'repeatM': [1.83, 1.83], 'texCoord': 1,
                   'source': {'path': 'scan.jpg', 'sha256': 'a'*64}, 'provenance': {'path': 'license.json', 'sha256': 'b'*64}}
        self.m.validate_scan_request(entry, request)
        for invalid in [dict(request, texCoord=0), dict(request, profile='polymer'), dict(request, repeatM=[0, 1])]:
            with self.assertRaises(ValueError):
                self.m.validate_scan_request(entry, invalid)
        protected = self.m.material_record('planted-aquarium', material)
        with self.assertRaises(ValueError):
            self.m.validate_scan_request(protected, request)

    def test_scan_hash_or_path_drift_is_rejected(self):
        import hashlib
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve()
            (root / 'scan.jpg').write_bytes(b'licensed scan fixture')
            asset = {'path': 'scan.jpg', 'sha256': hashlib.sha256(b'licensed scan fixture').hexdigest(), 'bytes': 21}
            self.assertEqual(self.m._verified_scan_file(root, asset), root / 'scan.jpg')
            with self.assertRaises(ValueError):
                self.m._verified_scan_file(root, dict(asset, sha256='0'*64))
            with self.assertRaises(ValueError):
                self.m._verified_scan_file(root, dict(asset, path='../outside.jpg'))

    def test_coherent_scan_requires_all_channels_and_preserves_dielectric_factors(self):
        baseline = {'name': 'wood-dark', 'pbrMetallicRoughness': {
            'baseColorTexture': {'index': 0}, 'metallicFactor': 0, 'roughnessFactor': .82}}
        entry = self.m.material_record('bookshelf', baseline)
        common = {'materialKey': 'wood-dark', 'profile': 'wood', 'family': 'walnut', 'repeatM': [1, 1]}
        maps = [{**common, 'kind': kind, 'texCoord': 1, 'reason': 'matching licensed family',
                 'source': {'path': kind + '.jpg', 'sha256': 'a'*64},
                 'provenance': {'path': 'license.json', 'sha256': 'b'*64}}
                for kind in ['baseColor', 'normal', 'orm']]
        bundle = {**common, 'normalStrength': .14, 'roughnessFactor': .82, 'grainAxis': 'u',
                  'maps': maps, 'replacements': [{**maps[0], 'oldSha256': 'c'*64}]}
        self.m.validate_scan_bundle(entry, bundle, baseline)
        for changed in [dict(bundle, maps=maps[:2]), dict(bundle, roughnessFactor=.3),
                        dict(bundle, replacements=[]), dict(bundle, grainAxis='x')]:
            with self.assertRaises(ValueError):
                self.m.validate_scan_bundle(entry, changed, baseline)
        mixed = copy.deepcopy(bundle)
        mixed['maps'][1]['repeatM'] = [2, 2]
        with self.assertRaises(ValueError):
            self.m.validate_scan_bundle(entry, mixed, baseline)
        for pbr in [{'baseColorTexture': {'index': 0}},
                    {**baseline['pbrMetallicRoughness'], 'metallicFactor': .2}]:
            with self.assertRaises(ValueError):
                self.m.validate_scan_bundle(entry, bundle, {**baseline, 'pbrMetallicRoughness': pbr})

    def test_coherent_scan_requires_existing_normal_scale_and_explicit_replacement(self):
        baseline = {'name': 'wood-dark', 'normalTexture': {'index': 1, 'scale': .33},
                    'pbrMetallicRoughness': {'baseColorTexture': {'index': 0},
                                             'metallicFactor': 0, 'roughnessFactor': .9}}
        entry = self.m.material_record('bookshelf', baseline)
        common = {'materialKey': 'wood-dark', 'profile': 'wood', 'family': 'walnut', 'repeatM': [1, 1]}
        maps = [{**common, 'kind': kind, 'texCoord': 1,
                 'source': {'path': kind + '.jpg', 'sha256': 'a'*64},
                 'provenance': {'path': 'license.json', 'sha256': 'b'*64}}
                for kind in ['baseColor', 'normal', 'orm']]
        bundle = {**common, 'normalStrength': .33, 'roughnessFactor': .9, 'grainAxis': 'v',
                  'maps': maps, 'replacements': [{**m, 'oldSha256': 'c'*64} for m in maps[:2]]}
        self.m.validate_scan_bundle(entry, bundle, baseline)
        for changed in [dict(bundle, normalStrength=.14),
                        dict(bundle, replacements=bundle['replacements'][:1])]:
            with self.assertRaises(ValueError):
                self.m.validate_scan_bundle(entry, changed, baseline)


if __name__ == '__main__':
    unittest.main()
