"""Only source-evidenced legacy UV repairs may change an original binding."""
import copy
import hashlib
import json
import struct
import unittest
import test_catalog_realism_glb as fixtures
from test_catalog_realism_glb import fixture, glb, png


class LegacyUvTests(unittest.TestCase):
    setUp = fixtures.PreservationTests.setUp
    save = fixtures.PreservationTests.save
    def legacy(self, missing=False):
        ident, key = ('bud-vase-trio', 'dusty-rose') if missing else ('designed-rug-kilim', 'original-cultural-rug-pattern')
        doc, binary = fixture(image=png((10, 20, 30)))
        doc['materials'][0]['name'] = key
        doc['materials'][0]['pbrMetallicRoughness']['baseColorTexture'] = {'index': 0, 'texCoord': -1}
        values = (0, 1, 0, 1, 0, 1) if missing else (0, 0, 1, 0, 0, 1)
        binary = binary[:36] + struct.pack('<6f', *values) + binary[60:]
        self.save((doc, binary), (doc, binary))
        def record(name, raw):
            file = self.root / name; file.parent.mkdir(parents=True, exist_ok=True); file.write_bytes(raw)
            return {'path': name, 'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)}
        item = {'id': ident, 'sourceBlend': record('source.blend', b'BLENDER-source'), 'baselineGlb': record('baseline.glb', self.baseline.read_bytes())}
        repair = {'materialKey': key, 'kind': 'baseColor', 'from': -1, 'to': 0,
                  'mode': 'missing-source-uv-zero' if missing else 'authored-source-uv0',
                  'imageSha256': hashlib.sha256(png((10,20,30))).hexdigest(), 'reason': 'Restore the source-evidenced original UV binding.'}
        evidence = {'version': 1, 'scope': 'read-only-native-source-uv', 'before': {'counts': {}}, 'after': {'counts': {}},
                    'models': {ident: {**item, 'materials': [{'materialKey': key, 'baselineTextureInfo': {'index': 0, 'texCoord': -1},
                     'nodes': [{'name': 'Image Texture', 'type': 'TEX_IMAGE', 'inputs': [{'name': 'Vector', 'links': [], 'default': [0,0,0]}]},
                               {'type': 'BSDF_PRINCIPLED', 'inputs': [{'name': 'Base Color', 'links': [{'node':'Image Texture','socket':'Color'}]}]}],
                     'meshCharts': [{'materialPolygonCount': 1, 'layers': [] if missing else [{'index':0,'name':'UVMap','activeRender':True,'active':True}]}]}]}}}
        ev = record('assets-source/catalog-realism/legacy-uv-source-evidence.json', json.dumps(evidence).encode())
        plan = {'version':1,'scope':'beta-only','sourceEvidence':ev,'models':{ident:{'sourceBlendSha256':item['sourceBlend']['sha256'],'baselineGlbSha256':item['baselineGlb']['sha256'],'repairs':[repair]}}}
        record('assets-source/catalog-realism/legacy-uv-repair-plan.json', json.dumps(plan).encode())
        return item, doc, repair, plan, record

    def test_exact_binding_only_and_original_files_unchanged(self):
        for missing in (False, True):
            item, doc, repair, _, _ = self.legacy(missing)
            old = self.baseline.read_bytes()
            result = glb.repair_legacy_uv_bindings(self.root, self.candidate, item)
            actual, _ = glb.read_glb(self.candidate)
            expected = copy.deepcopy(doc); expected['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['texCoord'] = 0
            self.assertEqual(actual, expected)
            self.assertEqual(result['repairs'], [repair])
            self.assertEqual(len(result['inputs']), 2)
            self.assertEqual(self.baseline.read_bytes(), old)

    def test_missing_uv_source_must_remain_constant_and_atomic(self):
        item, doc, _, _, _ = self.legacy(True)
        _, binary = glb.read_glb(self.candidate)
        glb.write_glb(self.candidate, doc, binary[:36] + struct.pack('<6f', 0,1,.1,1,0,1) + binary[60:])
        before = self.candidate.read_bytes()
        with self.assertRaisesRegex(ValueError, 'constant'):
            glb.repair_legacy_uv_bindings(self.root, self.candidate, item)
        self.assertEqual(before, self.candidate.read_bytes())

    def test_unknown_id_stale_source_and_image_fail_closed(self):
        for mode in ('id','source','image','evidence'):
            item, doc, _, plan, record = self.legacy()
            if mode == 'id': item['id'] = 'unreviewed-rug'
            elif mode == 'source': (self.root / 'source.blend').write_bytes(b'changed')
            elif mode == 'image':
                doc['samplers'][0]['wrapS'] = 10497
                _, binary = glb.read_glb(self.candidate); glb.write_glb(self.candidate, doc, binary)
            else: (self.root / plan['sourceEvidence']['path']).write_text('{}')
            before = self.candidate.read_bytes()
            with self.assertRaises(ValueError): glb.repair_legacy_uv_bindings(self.root, self.candidate, item)
            self.assertEqual(before, self.candidate.read_bytes())

    def test_optional_pruning_skips_invalid_history_but_rejects_invalid_candidate(self):
        item, _, _, _, _ = self.legacy()
        with self.assertRaisesRegex(ValueError, 'coordinate'):
            glb.prune_unused_uvs(self.candidate, self.baseline, [])
        glb.repair_legacy_uv_bindings(self.root, self.candidate, item)
        before = self.candidate.read_bytes()
        result = glb.prune_unused_uvs(self.candidate, self.baseline, [])
        self.assertIn('historical', result['skipped'])
        self.assertEqual(before, self.candidate.read_bytes())


if __name__ == '__main__': unittest.main()
