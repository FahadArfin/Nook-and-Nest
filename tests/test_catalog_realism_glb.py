"""Pure Python GLB preservation tests; no Blender or network is involved."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import tempfile
import unittest
import zlib
from io import BytesIO
from PIL import Image

MODULE = Path(__file__).resolve().parents[1] / 'tools/blender/catalog_realism/glb.py'
spec = importlib.util.spec_from_file_location('catalog_realism_glb', MODULE)
glb = importlib.util.module_from_spec(spec)
spec.loader.exec_module(glb)


def png(rgb):
    def chunk(kind, body):
        return struct.pack('>I', len(body)) + kind + body + struct.pack('>I', zlib.crc32(kind + body) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 1, 1, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(bytes([0, *rgb]))) + chunk(b'IEND', b'')


def fixture(material=None, nodes=None, image=None):
    vertices = struct.pack('<9f', -1, 0, 0, 1, 0, 0, 0, 1, 0)
    doc = {'asset': {'version': '2.0'}, 'scene': 0, 'scenes': [{'nodes': [0]}],
           'nodes': nodes or [{'name': 'model', 'mesh': 0, 'translation': [0, 2, 0]}],
           'meshes': [{'primitives': [{'attributes': {'POSITION': 0, 'TEXCOORD_0': 1, 'TEXCOORD_1': 1}, 'material': 0}]}],
           'accessors': [{'bufferView': 0, 'componentType': 5126, 'count': 3, 'type': 'VEC3'},
                         {'bufferView': 1, 'componentType': 5126, 'count': 3, 'type': 'VEC2'}],
           'bufferViews': [{'buffer': 0, 'byteOffset': 0, 'byteLength': len(vertices)}, {'buffer': 0, 'byteOffset': len(vertices), 'byteLength': 24}],
           'buffers': [{'byteLength': len(vertices) + 24}],
           'materials': [material or {'name': 'linen.001', 'pbrMetallicRoughness': {'baseColorFactor': [.2, .4, .6, 1], 'metallicFactor': .6, 'roughnessFactor': .8}}]}
    binary = vertices + bytes(24)
    if image:
        doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(image)})
        doc['images'] = [{'bufferView': 2, 'mimeType': 'image/png', 'name': 'authored'}]
        doc['samplers'] = [{'wrapS': 33071, 'wrapT': 33648}]
        doc['textures'] = [{'source': 0, 'sampler': 0}]
        binary += image
        doc['buffers'][0]['byteLength'] = len(binary)
    return doc, binary


class PreservationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.baseline = self.root / 'baseline.glb'
        self.candidate = self.root / 'candidate.glb'
        self.maps = self.root / 'maps'

    def save(self, baseline, candidate):
        glb.write_glb(self.baseline, *baseline)
        glb.write_glb(self.candidate, *candidate)

    def reconcile(self, records=(), mapping=None):
        return glb.reconcile_materials(self.candidate, self.baseline, mapping or {'loaded-material': 'linen.001'}, records, self.maps, root=self.root)

    def test_round_trip_and_malformed_chunks(self):
        doc, binary = fixture()
        glb.write_glb(self.baseline, doc, binary)
        actual, blob = glb.read_glb(self.baseline)
        self.assertEqual(actual, doc)
        self.assertEqual(blob, binary)
        raw = bytearray(self.baseline.read_bytes())
        struct.pack_into('<I', raw, 8, len(raw) + 4)
        with self.assertRaisesRegex(ValueError, 'length'):
            glb.read_glb(raw)

    def test_exact_baseline_materials_images_and_extension_indices_survive(self):
        old, data = fixture(image=png((10, 20, 30)))
        old['materials'][0].update({'alphaMode': 'BLEND', 'emissiveFactor': [.1, .2, .3], 'doubleSided': True,
                                   'extensions': {'KHR_materials_clearcoat': {'clearcoatTexture': {'index': 0, 'texCoord': 0}, 'clearcoatFactor': .25}}})
        old['extensionsUsed'] = ['KHR_materials_clearcoat']
        old['materials'][0]['pbrMetallicRoughness']['baseColorTexture'] = {'index': 0, 'texCoord': 0, 'extensions': {'KHR_texture_transform': {'scale': [2, 3]}}}
        old['materials'].append({'name': 'original-unused', 'alphaMode': 'MASK', 'alphaCutoff': .3})
        new, fresh = fixture({'name': 'loaded-material', 'pbrMetallicRoughness': {'baseColorFactor': [1, 0, 0, 1]}}, image=png((200, 0, 0)))
        self.save((old, data), (new, fresh))
        baseline_bytes = self.baseline.read_bytes()
        result = self.reconcile()
        actual, binary = glb.read_glb(self.candidate)
        self.assertEqual(actual['materials'], old['materials'])
        self.assertEqual(actual['textures'], old['textures'])
        self.assertEqual(actual['samplers'], old['samplers'])
        self.assertEqual(glb.image_bytes(actual, binary, 0), png((10, 20, 30)))
        self.assertEqual(result['newMaps'], [])
        self.assertEqual(self.baseline.read_bytes(), baseline_bytes)

    def test_declared_normal_keeps_realism_uv_and_native_mapping(self):
        old = fixture()
        new, data = fixture({'name': 'loaded-material', 'normalTexture': {'index': 0, 'texCoord': 1, 'scale': .14, 'extensions': {'KHR_texture_transform': {'scale': [3, 4]}}}}, image=png((128, 128, 255)))
        new['extensionsUsed'] = ['KHR_texture_transform']
        self.save(old, (new, data))
        result = self.reconcile([{'materialKey': 'linen.001', 'profile': 'fabric', 'maps': [{'kind': 'normal', 'uvLayer': 'RealismUV'}]}])
        actual, binary = glb.read_glb(self.candidate)
        reference = actual['materials'][0]['normalTexture']
        self.assertEqual(reference['texCoord'], 1)
        self.assertEqual(reference['extensions'], new['materials'][0]['normalTexture']['extensions'])
        self.assertEqual(reference['scale'], .14)
        self.assertEqual(result['newMaps'][0]['texCoord'], 1)
        self.assertEqual((self.root / result['newMaps'][0]['path']).read_bytes(), png((128, 128, 255)))
        self.assertEqual(actual['materials'][0]['pbrMetallicRoughness'], old[0]['materials'][0]['pbrMetallicRoughness'])

    def test_existing_normal_cannot_be_replaced_and_unknown_names_fail_without_writing(self):
        old, data = fixture(image=png((127, 128, 255)))
        old['materials'][0]['normalTexture'] = {'index': 0, 'texCoord': 0}
        new, fresh = fixture({'name': 'loaded-material', 'normalTexture': {'index': 0, 'texCoord': 1}}, image=png((255, 0, 0)))
        self.save((old, data), (new, fresh))
        result = self.reconcile([{'materialKey': 'linen.001', 'profile': 'fabric', 'maps': [{'kind': 'normal'}]}])
        actual, binary = glb.read_glb(self.candidate)
        self.assertEqual(result['newMaps'], [])
        self.assertEqual(glb.image_bytes(actual, binary, 0), png((127, 128, 255)))
        self.save((old, data), (new, fresh))
        before = self.candidate.read_bytes()
        with self.assertRaisesRegex(ValueError, 'material'):
            self.reconcile(mapping={'loaded-material': 'invented'})
        self.assertEqual(self.candidate.read_bytes(), before)

    def scan_fixture(self, protected=False):
        old, data = fixture(image=png((180, 120, 70)))
        old['materials'][0]['pbrMetallicRoughness']['baseColorTexture'] = {'index':0,'texCoord':0}
        if protected:
            old['nodes'][0]['extras']={'motion_role':'sliding_leaf'}
        new, fresh = fixture({'name':'loaded-material','pbrMetallicRoughness':{'baseColorTexture':{'index':0,'texCoord':1}}},image=png((12, 13, 14)))
        self.save((old,data),(new,fresh))
        def record(name, raw):
            (self.root/name).write_bytes(raw)
            return {'path':name,'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw)}
        source=record('oak.png',png((150, 105, 65)))
        provenance=record('provenance.json',json.dumps({'materials':{'oak':{'baseColor':'oak.png','repeatM':1.83,'license':'CC0-1.0'}}}).encode())
        replacement={'materialKey':'linen.001','kind':'baseColor','oldSha256':hashlib.sha256(png((180,120,70))).hexdigest(),'profile':'wood','family':'oak','repeatM':[1.83,1.83],'reason':'Replace the legacy timber pixels with the licensed physical scan.','source':source,'provenance':provenance,'texCoord':1}
        records=[{'materialKey':'linen.001','profile':'wood','maps':[{'kind':'baseColor','uvLayer':'RealismUV'}],'textureReplacements':[replacement]}]
        return old, source, records

    def test_explicit_scan_replacement_preserves_factors_and_full_quality_source_bytes(self):
        old, source, records=self.scan_fixture()
        result=self.reconcile(records)
        actual,binary=glb.read_glb(self.candidate)
        material=actual['materials'][0]
        reference=material['pbrMetallicRoughness']['baseColorTexture']
        self.assertEqual(reference['texCoord'],1)
        self.assertEqual(material['pbrMetallicRoughness']['baseColorFactor'],old['materials'][0]['pbrMetallicRoughness']['baseColorFactor'])
        self.assertEqual(glb.image_bytes(actual,binary,actual['textures'][reference['index']]['source']),(self.root/source['path']).read_bytes())
        self.assertEqual(result['textureReplacements'][0]['newSha256'],source['sha256'])
        self.assertEqual(result['newMaps'][0]['kind'],'baseColor')

    def test_scan_replacement_rejects_changed_source_wrong_old_hash_and_motion_material(self):
        for mode in ('source','old','motion'):
            old,source,records=self.scan_fixture(protected=mode=='motion')
            if mode=='source': (self.root/source['path']).write_bytes(b'changed scan')
            if mode=='old': records[0]['textureReplacements'][0]['oldSha256']='0'*64
            before=self.candidate.read_bytes()
            with self.assertRaisesRegex(ValueError,'hash|protected|motion'):
                self.reconcile(records)
            self.assertEqual(self.candidate.read_bytes(),before)

    def test_coherent_new_scan_normal_and_orm_keep_source_bytes_and_original_roughness(self):
        old,source,records=self.scan_fixture()
        old['materials'][0]['pbrMetallicRoughness'].update(metallicFactor=0,roughnessFactor=.82)
        native,native_bin=glb.read_glb(self.candidate)
        native['materials'][0]['normalTexture']={'index':0,'texCoord':1,'scale':.14}
        native['materials'][0]['pbrMetallicRoughness'].update(metallicRoughnessTexture={'index':0,'texCoord':1},roughnessFactor=1)
        glb.write_glb(self.baseline,old,fixture(image=png((180,120,70)))[1]);glb.write_glb(self.candidate,native,native_bin)
        payload=BytesIO();Image.new('RGB',(4,4),(255,170,0)).save(payload,format='JPEG',quality=95)
        (self.root/'scan-orm.jpg').write_bytes(payload.getvalue())
        orm={'path':'scan-orm.jpg','sha256':hashlib.sha256(payload.getvalue()).hexdigest(),'bytes':len(payload.getvalue())}
        provenance=json.loads((self.root/'provenance.json').read_text());provenance['materials']['oak'].update(normal='oak.png',orm='scan-orm.jpg')
        (self.root/'provenance.json').write_text(json.dumps(provenance))
        provenance_record={'path':'provenance.json','sha256':hashlib.sha256((self.root/'provenance.json').read_bytes()).hexdigest(),'bytes':(self.root/'provenance.json').stat().st_size}
        records[0]['textureReplacements'][0]['provenance']=provenance_record
        for kind,asset in [('normal',source),('orm',orm)]:
            scan={**records[0]['textureReplacements'][0],'kind':kind,'source':asset};scan.pop('oldSha256')
            records[0]['maps'].append({'kind':kind,'uvLayer':'RealismUV','scanSource':scan})
        result=self.reconcile(records)
        actual,binary=glb.read_glb(self.candidate);pbr=actual['materials'][0]['pbrMetallicRoughness']
        self.assertEqual(pbr['roughnessFactor'],.82)
        self.assertEqual(pbr['metallicFactor'],0)
        self.assertEqual(glb.image_bytes(actual,binary,actual['textures'][pbr['metallicRoughnessTexture']['index']]['source']),payload.getvalue())
        self.assertEqual(len(result['textureReplacements']),1)
        self.assertEqual(next(m for m in result['newMaps'] if m['kind']=='orm')['scanSource']['source'],orm)

    def test_orm_retains_metallic_factor_and_neutralizes_baked_blue_channel_only(self):
        old = fixture()
        new, data = fixture({'name': 'loaded-material', 'pbrMetallicRoughness': {'metallicRoughnessTexture': {'index': 0, 'texCoord': 1}, 'metallicFactor': 1, 'roughnessFactor': 1}}, image=png((230, 180, 153)))
        self.save(old, (new, data))
        result = self.reconcile([{'materialKey': 'linen.001', 'profile': 'fabric', 'maps': [{'kind': 'orm'}]}])
        actual, binary = glb.read_glb(self.candidate)
        pbr = actual['materials'][0]['pbrMetallicRoughness']
        self.assertEqual(pbr['metallicFactor'], .6)
        self.assertEqual(pbr['roughnessFactor'], 1)
        rgb = glb.decode_png_rgb(glb.image_bytes(actual, binary, actual['textures'][pbr['metallicRoughnessTexture']['index']]['source']))
        self.assertEqual(rgb[2], bytes((230, 180, 255)))
        self.assertEqual(result['newMaps'][0]['kind'], 'orm')

    def test_unexported_uv_and_undeclared_maps_fail_before_candidate_write(self):
        old = fixture()
        new, data = fixture({'name': 'loaded-material', 'normalTexture': {'index': 0, 'texCoord': 1}}, image=png((128, 128, 255)))
        del new['meshes'][0]['primitives'][0]['attributes']['TEXCOORD_1']
        self.save(old, (new, data))
        before = self.candidate.read_bytes()
        with self.assertRaisesRegex(ValueError, 'TEXCOORD'):
            self.reconcile([{'materialKey': 'linen.001', 'profile': 'fabric', 'maps': [{'kind': 'normal'}]}])
        self.assertEqual(self.candidate.read_bytes(), before)
        # Undeclared native graph changes are discarded, not accepted as improvements.
        self.reconcile()
        actual, _ = glb.read_glb(self.candidate)
        self.assertNotIn('normalTexture', actual['materials'][0])

    def test_dynamic_subtrees_keep_exact_mesh_sharing_hierarchy_and_nonfloor_transform(self):
        old, data = fixture(nodes=[{'name': 'static', 'mesh': 0, 'translation': [0, 2, 0]},
                                   {'name': 'assembly', 'translation': [0, 5, 0], 'children': [2, 3]},
                                   {'name': 'branch-a', 'mesh': 0, 'extras': {'shared_geometry': True}},
                                   {'name': 'branch-b', 'mesh': 0, 'translation': [1, 0, 0], 'extras': {'shared_geometry': True}}])
        old['scenes'][0]['nodes'] = [0, 1]
        new = copy.deepcopy(old)
        new['nodes'][1]['translation'] = [0, 99, 0]
        new['nodes'][3]['extras']['shared_geometry'] = 'damaged'
        self.save((old, data), (new, data))
        result = glb.preserve_protected_subtrees(self.candidate, self.baseline)
        actual, binary = glb.read_glb(self.candidate)
        nodes = {node['name']: node for node in actual['nodes']}
        self.assertEqual(nodes['assembly']['translation'], [0, 5, 0])
        self.assertEqual(nodes['branch-a']['mesh'], nodes['branch-b']['mesh'])
        self.assertEqual(nodes['branch-b']['extras'], {'shared_geometry': True})
        self.assertEqual(nodes['static']['translation'], [0, 2, 0])
        self.assertEqual(result['protectedRoots'], ['assembly'])
        self.assertEqual(len(actual['nodes']), 4)

    def test_aquarium_additions_keep_every_original_node_and_material(self):
        old, data = fixture(nodes=[{'name': 'aquascape', 'mesh': 0, 'translation': [0, .6, 0]}], image=png((10, 20, 30)))
        new, fresh = fixture(nodes=[{'name': 'aquascape', 'mesh': 0}, {'name': 'detail_fastener_01', 'mesh': 1, 'translation': [0, .1, 0]}])
        new['meshes'].append(copy.deepcopy(new['meshes'][0]))
        new['scenes'][0]['nodes'] = [0, 1]
        self.save((old, data), (new, fresh))
        result = glb.preserve_protected_subtrees(self.candidate, self.baseline, preserve_all_original=True)
        actual, binary = glb.read_glb(self.candidate)
        self.assertEqual(actual['nodes'][0], old['nodes'][0])
        self.assertEqual(actual['materials'], old['materials'])
        self.assertEqual(actual['images'], old['images'])
        self.assertNotEqual(actual['nodes'][1]['mesh'], actual['nodes'][0]['mesh'])
        self.assertEqual(result['additions'], [{'node': 'detail_fastener_01', 'kind': 'fastener'}])
        self.assertEqual(binary[:len(data)], data)

    def test_explicit_cloth_sheen_adjustment_changes_only_the_declared_factor(self):
        old, data = fixture()
        old['materials'][0]['extensions'] = {'KHR_materials_sheen': {'sheenColorFactor': [1, 1, 1], 'sheenRoughnessFactor': .55}}
        new, fresh = fixture({'name': 'loaded-material'})
        self.save((old, data), (new, fresh))
        adjustment = {'property': 'extensions.KHR_materials_sheen.sheenColorFactor', 'value': [.032, .064, .096], 'reason': 'Tint-scaled cloth sheen prevents whitening of the selected fabric.'}
        result = self.reconcile([{'materialKey': 'linen.001', 'profile': 'fabric', 'maps': [], 'surfaceAdjustments': [adjustment]}])
        actual, _ = glb.read_glb(self.candidate)
        expected = copy.deepcopy(old['materials'])
        expected[0]['extensions']['KHR_materials_sheen']['sheenColorFactor'] = adjustment['value']
        self.assertEqual(actual['materials'], expected)
        self.assertEqual(result['surfaceAdjustments'], [{'materialKey': 'linen.001', **adjustment}])
        self.save((old, data), (new, fresh))
        with self.assertRaisesRegex(ValueError, 'sheen|profile'):
            self.reconcile([{'materialKey': 'linen.001', 'profile': 'metal', 'maps': [], 'surfaceAdjustments': [adjustment]}])

    def test_static_root_rename_is_explicit_or_unambiguous_without_changing_transform(self):
        old, data = fixture(nodes=[{'name': 'catalog-root', 'mesh': 0, 'translation': [0, 2, 0]}])
        new, fresh = fixture(nodes=[{'name': 'temporary-static-export', 'mesh': 0, 'translation': [0, 2, 0]}])
        self.save((old, data), (new, fresh))
        result = glb.preserve_protected_subtrees(self.candidate, self.baseline)
        actual, _ = glb.read_glb(self.candidate)
        self.assertEqual(actual['nodes'][0]['name'], 'catalog-root')
        self.assertEqual(actual['nodes'][0]['translation'], [0, 2, 0])
        self.assertEqual(result['renamedRoots'], [{'from': 'temporary-static-export', 'to': 'catalog-root'}])

    def test_compaction_removes_orphans_and_shares_identical_payload_without_changing_texture_indices(self):
        doc, data = fixture(image=png((128, 128, 255)))
        doc['materials'][0]['extensions']={'KHR_materials_clearcoat':{'clearcoatTexture':{'index':0}}}
        original_image=glb.image_bytes(doc,data,0)
        # One unused native image, one duplicate retained image, and one unused
        # mesh/accessor graph represent normal reconciliation/restoration waste.
        unused=b'unused native data'*100
        doc['bufferViews'].append({'buffer':0,'byteOffset':len(data),'byteLength':len(unused)})
        data+=unused
        doc['bufferViews'].append({'buffer':0,'byteOffset':len(data),'byteLength':len(original_image)})
        data+=original_image
        doc['images'].append({'bufferView':4,'mimeType':'image/png'})
        doc['textures'].append({'source':1,'sampler':0})
        doc['accessors'].append({'bufferView':3,'componentType':5121,'count':3,'type':'SCALAR'})
        doc['meshes'].append({'primitives':[{'attributes':{'POSITION':2},'material':0}]})
        glb.write_glb(self.candidate,doc,data)
        result=glb.compact_glb(self.candidate)
        actual,binary=glb.read_glb(self.candidate)
        self.assertLess(result['afterBytes'],result['beforeBytes'])
        self.assertEqual(len(actual['meshes']),1)
        self.assertEqual(len(actual['accessors']),2)
        self.assertEqual(actual['materials'],doc['materials'])
        self.assertEqual(actual['textures'],doc['textures'])
        self.assertEqual([glb.image_bytes(actual,binary,i) for i in (0,1)],[original_image,original_image])
        self.assertEqual(actual['bufferViews'][actual['images'][0]['bufferView']]['byteOffset'],actual['bufferViews'][actual['images'][1]['bufferView']]['byteOffset'])
        self.assertGreater(result['deduplicatedPayloads'],0)

    def uv_fixture(self, count=2):
        old, old_bin = fixture()
        old['meshes'][0]['primitives'][0]['attributes'] = {'POSITION': 0}
        candidate, binary = fixture({'name': 'linen.001', 'normalTexture': {'index': 0, 'texCoord': count - 1}}, image=png((128, 128, 255)))
        attrs = candidate['meshes'][0]['primitives'][0]['attributes']
        for index in range(count):
            payload = struct.pack('<6f', index + .125, 0, 1, 0, 0, 1)
            view = len(candidate['bufferViews'])
            candidate['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(payload)})
            binary += payload
            attrs['TEXCOORD_' + str(index)] = len(candidate['accessors'])
            candidate['accessors'].append({'bufferView': view, 'componentType': 5126, 'count': 3, 'type': 'VEC2'})
        tangent = struct.pack('<12f', *([1, 0, 0, 1] * 3))
        candidate['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(tangent)})
        binary += tangent
        attrs['TANGENT'] = len(candidate['accessors'])
        candidate['accessors'].append({'bufferView': len(candidate['bufferViews']) - 1, 'componentType': 5126, 'count': 3, 'type': 'VEC4'})
        self.save((old, old_bin), (candidate, binary))
        return old, candidate

    def attribute_payload(self, document, binary, semantic):
        accessor = document['accessors'][document['meshes'][0]['primitives'][0]['attributes'][semantic]]
        return glb._view_bytes(document, binary, accessor['bufferView'])

    def test_unused_uv_cleanup_keeps_exact_used_coordinates_tangents_and_receipt_binding(self):
        old, native = self.uv_fixture()
        before_baseline = self.baseline.read_bytes()
        maps = [{'materialKey': 'linen.001', 'kind': 'normal', 'texCoord': 1, 'sha256': 'retained-image-hash'}]
        result = glb.prune_unused_uvs(self.candidate, self.baseline, maps)
        actual, binary = glb.read_glb(self.candidate)
        self.assertEqual(set(actual['meshes'][0]['primitives'][0]['attributes']), {'POSITION', 'TANGENT', 'TEXCOORD_0'})
        self.assertEqual(self.attribute_payload(actual, binary, 'TEXCOORD_0'), struct.pack('<6f', 1.125, 0, 1, 0, 0, 1))
        self.assertEqual(self.attribute_payload(actual, binary, 'TANGENT'), struct.pack('<12f', *([1, 0, 0, 1] * 3)))
        self.assertEqual(actual['materials'][0]['normalTexture'], {'index': 0, 'texCoord': 0})
        self.assertEqual(glb.image_bytes(actual, binary, 0), png((128, 128, 255)))
        self.assertEqual(result['newMaps'][0], {**maps[0], 'texCoord': 0})
        self.assertEqual(maps[0]['texCoord'], 1)
        self.assertLess(result['afterBytes'], result['beforeBytes'])
        self.assertEqual(self.baseline.read_bytes(), before_baseline)

    def test_uv_cleanup_remaps_core_extension_and_transform_fallback_bindings(self):
        self.uv_fixture(4)
        doc, binary = glb.read_glb(self.candidate)
        material = doc['materials'][0]
        material.update(normalTexture={'index': 0, 'texCoord': 2, 'extensions': {'KHR_texture_transform': {'texCoord': 3, 'scale': [2, 4]}}},
                        emissiveTexture={'index': 0, 'texCoord': 3}, occlusionTexture={'index': 0, 'texCoord': 2})
        material['pbrMetallicRoughness'] = {'baseColorTexture': {'index': 0, 'texCoord': 2}, 'metallicRoughnessTexture': {'index': 0, 'texCoord': 3}}
        material['extensions'] = {'KHR_materials_clearcoat': {'clearcoatTexture': {'index': 0, 'texCoord': 2}, 'clearcoatNormalTexture': {'index': 0, 'texCoord': 3}},
                                  'KHR_materials_sheen': {'sheenColorTexture': {'index': 0, 'texCoord': 3}},
                                  'KHR_materials_specular': {'specularTexture': {'index': 0, 'texCoord': 2}}}
        glb.write_glb(self.candidate, doc, binary)
        result = glb.prune_unused_uvs(self.candidate, self.baseline, [{'materialKey': 'linen.001', 'kind': 'normal', 'texCoord': 3}])
        actual, binary = glb.read_glb(self.candidate)
        material = actual['materials'][0]
        self.assertEqual(material['normalTexture'], {'index': 0, 'texCoord': 0, 'extensions': {'KHR_texture_transform': {'texCoord': 1, 'scale': [2, 4]}}})
        self.assertEqual(material['emissiveTexture']['texCoord'], 1)
        self.assertEqual(material['occlusionTexture']['texCoord'], 0)
        self.assertEqual(material['pbrMetallicRoughness']['baseColorTexture']['texCoord'], 0)
        self.assertEqual(material['pbrMetallicRoughness']['metallicRoughnessTexture']['texCoord'], 1)
        self.assertEqual(material['extensions']['KHR_materials_clearcoat']['clearcoatNormalTexture']['texCoord'], 1)
        self.assertEqual(material['extensions']['KHR_materials_clearcoat']['clearcoatTexture']['texCoord'], 0)
        self.assertEqual(material['extensions']['KHR_materials_sheen']['sheenColorTexture']['texCoord'], 1)
        self.assertEqual(material['extensions']['KHR_materials_specular']['specularTexture']['texCoord'], 0)
        self.assertEqual(result['newMaps'][0]['texCoord'], 1)
        self.assertEqual(self.attribute_payload(actual, binary, 'TEXCOORD_0'), struct.pack('<6f', 2.125, 0, 1, 0, 0, 1))
        self.assertEqual(self.attribute_payload(actual, binary, 'TEXCOORD_1'), struct.pack('<6f', 3.125, 0, 1, 0, 0, 1))

    def test_uv_cleanup_preserves_baseline_streams_and_implicit_texture_zero(self):
        self.uv_fixture(3)
        old, old_bin = fixture()
        glb.write_glb(self.baseline, old, old_bin)
        doc, binary = glb.read_glb(self.candidate)
        doc['materials'][0]['normalTexture'] = {'index': 0}
        glb.write_glb(self.candidate, doc, binary)
        glb.prune_unused_uvs(self.candidate, self.baseline, [])
        actual, binary = glb.read_glb(self.candidate)
        self.assertEqual(set(actual['meshes'][0]['primitives'][0]['attributes']), {'POSITION', 'TANGENT', 'TEXCOORD_0', 'TEXCOORD_1'})
        self.assertEqual(actual['materials'][0]['normalTexture'], {'index': 0})
        self.assertEqual(self.attribute_payload(actual, binary, 'TEXCOORD_1'), struct.pack('<6f', 1.125, 0, 1, 0, 0, 1))

    def test_uv_cleanup_leaves_protected_aquarium_and_unknown_extension_documents_exact(self):
        for mode in ('motion', 'shared', 'aquarium', 'unknown'):
            self.uv_fixture()
            doc, binary = glb.read_glb(self.candidate)
            if mode == 'motion': doc['nodes'][0]['extras'] = {'motion_role': 'hinge'}
            if mode == 'shared': doc['nodes'].append({'name': 'also-shared', 'mesh': 0}); doc['scenes'][0]['nodes'].append(1)
            if mode == 'unknown': doc['materials'][0]['extensions'] = {'VENDOR_future_uv': {'index': 0, 'texCoord': 0}}
            glb.write_glb(self.candidate, doc, binary)
            before = self.candidate.read_bytes()
            result = glb.prune_unused_uvs(self.candidate, self.baseline, [], preserve_all_original=mode == 'aquarium')
            self.assertEqual(self.candidate.read_bytes(), before, mode)
            self.assertEqual(result['beforeBytes'], result['afterBytes'])
            self.assertTrue(result['skipped'])

    def test_uv_cleanup_keeps_scan_plan_coordinates_and_rejects_stale_map_records(self):
        self.uv_fixture()
        maps = [{'materialKey': 'linen.001', 'kind': 'normal', 'texCoord': 1, 'scanSource': {'texCoord': 1}}]
        result = glb.prune_unused_uvs(self.candidate, self.baseline, maps)
        self.assertEqual(result['newMaps'], maps)
        actual, _ = glb.read_glb(self.candidate)
        self.assertIn('TEXCOORD_1', actual['meshes'][0]['primitives'][0]['attributes'])
        before = self.candidate.read_bytes()
        with self.assertRaisesRegex(ValueError, 'receipt|map'):
            glb.prune_unused_uvs(self.candidate, self.baseline, [{**maps[0], 'texCoord': 0}])
        self.assertEqual(self.candidate.read_bytes(), before)


if __name__ == '__main__':
    unittest.main()
