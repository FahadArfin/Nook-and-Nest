"""Small standalone regression tests; no Blender or project assets are mutated."""
import copy
import json
from pathlib import Path
import struct
import tempfile
import unittest

from household_materials import canonical_key, canonicalize_glb_bytes, canonicalize_glbs, tag_used_materials, CANONICAL_PROPERTY, MAPPING_PATH


def fixture(names):
    doc = {'asset': {'version': '2.0'}, 'materials': [
        {'name': name, 'pbrMetallicRoughness': {'baseColorFactor': [0.125, 0.25, 0.5, 1]}}
        for name in names], 'meshes': [{'primitives': [{'material': 0}]}]}
    encoded = json.dumps(doc).encode()
    encoded += b' ' * (-len(encoded) % 4)
    tail = struct.pack('<II', 8, 0x004E4942) + b'\0\x01\x02\x03\x04\x05\x06\xff'
    tail += struct.pack('<II', 4, 0x12345678) + b'KEEP'
    body = struct.pack('<II', len(encoded), 0x4E4F534A) + encoded + tail
    return struct.pack('<III', 0x46546C67, 2, len(body) + 12) + body, doc, tail


class MaterialTests(unittest.TestCase):
    def test_suffix_is_narrow_and_exact_keys_remain(self):
        self.assertEqual(canonical_key('brushed-steel.079'), 'brushed-steel')
        self.assertEqual(canonical_key('surface-stone'), 'surface-stone')
        self.assertEqual(canonical_key('panel-42'), 'panel-42')
        self.assertEqual(canonical_key('alpha.12.detail'), 'alpha.12.detail')
        with self.assertRaises(ValueError):
            canonical_key('')

    def test_only_material_names_change_and_chunks_are_identical(self):
        original, document, tail = fixture(['brushed-steel.079', 'surface-stone'])
        result, report = canonicalize_glb_bytes(original)
        length = struct.unpack_from('<I', result, 12)[0]
        revised = json.loads(result[20:20 + length])
        expected = copy.deepcopy(document)
        expected['materials'][0]['name'] = 'brushed-steel'
        self.assertEqual(revised, expected)
        self.assertEqual(result[20 + length:], tail)
        self.assertEqual(struct.unpack_from('<I', result, 8)[0], len(result))
        self.assertEqual(report['renamed'], {'brushed-steel.079': 'brushed-steel'})
        second, second_report = canonicalize_glb_bytes(result)
        self.assertEqual(second, result)
        self.assertFalse(second_report['changed'])

    def test_collision_rejected_before_any_file_write(self):
        data, _, _ = fixture(['steel.001', 'steel.002'])
        with self.assertRaisesRegex(ValueError, 'Duplicate canonical'):
            canonicalize_glb_bytes(data)

    def test_collection_scope_and_source_mapping_survive_noop(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / 'src').mkdir()
            (root / 'src/householdTestExpansion.json').write_text(json.dumps([['new-model']]))
            models = root / 'public/models/furniture'
            models.mkdir(parents=True)
            original, _, _ = fixture(['brushed-steel.079', 'surface-stone'])
            (models / 'new-model.glb').write_bytes(original)
            (models / 'released-model.glb').write_bytes(original)
            dry = canonicalize_glbs(root, ['new-model'])
            self.assertEqual(dry['changedModels'], 1)
            self.assertEqual((models / 'new-model.glb').read_bytes(), original)
            self.assertFalse((root / MAPPING_PATH).exists())
            canonicalize_glbs(root, ['new-model'], write=True)
            first_map = (root / MAPPING_PATH).read_bytes()
            mapping = json.loads(first_map)['models']['new-model']['sourceToExport']
            self.assertEqual(mapping, {'brushed-steel.079': 'brushed-steel', 'surface-stone': 'surface-stone'})
            second = canonicalize_glbs(root, ['new-model'], write=True)
            self.assertEqual(second['changedModels'], 0)
            self.assertFalse(second['mappingUpdated'])
            self.assertEqual((root / MAPPING_PATH).read_bytes(), first_map)
            rebuilt, _, _ = fixture(['brushed-steel.080', 'surface-stone', 'new-detail'])
            (models / 'new-model.glb').write_bytes(rebuilt)
            canonicalize_glbs(root, ['new-model'], write=True)
            aliases = json.loads((root / MAPPING_PATH).read_bytes())['models']['new-model']['sourceToExport']
            self.assertEqual(aliases['brushed-steel.079'], 'brushed-steel')
            self.assertEqual(aliases['brushed-steel.080'], 'brushed-steel')
            self.assertEqual(aliases['new-detail'], 'new-detail')
            with self.assertRaisesRegex(ValueError, 'only new IDs'):
                canonicalize_glbs(root, ['released-model'], write=True)
            self.assertEqual((models / 'released-model.glb').read_bytes(), original)

    def test_source_tagging_preserves_names(self):
        class Material(dict):
            name = 'brushed-steel.079'
        class Data:
            materials = [Material()]
        class Object(dict):
            data = Data()
        obj = Object()
        mapping = tag_used_materials([obj])
        self.assertEqual(obj.data.materials[0].name, 'brushed-steel.079')
        self.assertEqual(obj.data.materials[0][CANONICAL_PROPERTY], 'brushed-steel')
        self.assertEqual(obj['canonical_material_keys'], ['brushed-steel'])
        self.assertEqual(mapping, {'brushed-steel.079': 'brushed-steel'})


if __name__ == '__main__':
    unittest.main()
