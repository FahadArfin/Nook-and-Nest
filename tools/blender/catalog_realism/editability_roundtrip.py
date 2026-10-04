"""Owned temporary edit/save/reopen proof for two representative candidates.

Never overwrites candidates or the preceding inspection evidence. The edited
copies stay under .generated; source.py owns every native append and cleanup.
"""
from pathlib import Path
import hashlib
import json
import runpy
import struct

IDS = ('sofa', 'vessel-sink')
OUTPUT = 'assets-source/catalog-realism/candidate-editability-roundtrip-evidence.json'
TEMP = '.generated/catalog-realism-editability-roundtrip'


def digest_rows(rows, code):
    digest = hashlib.sha256()
    for row in rows:
        digest.update(struct.pack('<I', len(row)))
        digest.update(struct.pack('<' + code * len(row), *row))
    return digest.hexdigest()


def run(root):
    import bpy
    root = Path(root).resolve()
    target, directory = root / OUTPUT, root / TEMP
    if target.exists() or directory.exists():
        raise ValueError('Round-trip outputs must be fresh')
    probe = runpy.run_path(str(root / 'tools/blender/catalog_realism/editability_probe.py'))
    api = runpy.run_path(str(root / 'tools/blender/catalog_realism/source.py'))
    record, check = probe['file_record'], probe['check_record']
    catalog = json.loads((root / 'assets-source/catalog-realism/catalog.json').read_text())
    items = {item['id']: item for item in catalog['items']}

    def snapshot():
        return {kind: sorted((data.as_pointer(), data.name) for data in getattr(bpy.data, kind))
                for kind in api['DATA_KINDS']}

    def fingerprint(scene, material_names=None, object_names=None):
        material_names, object_names = material_names or {}, object_names or {}
        meshes = []
        materials = {mat for obj in scene.objects if obj.type == 'MESH' for mat in obj.data.materials if mat}
        for obj in scene.objects:
            if obj.type != 'MESH':
                continue
            mesh = obj.data
            meshes.append({'name': object_names.get(obj.name, obj.name), 'vertices': len(mesh.vertices),
                           'vertexSha256': digest_rows((tuple(v.co) for v in mesh.vertices), 'f'),
                           'faceSha256': digest_rows((tuple(p.vertices) for p in mesh.polygons), 'I'),
                           'materialIndicesSha256': digest_rows(((p.material_index,) for p in mesh.polygons), 'I'),
                           'materials': [material_names.get(m.name, m.name) if m else None for m in mesh.materials],
                           'uv': [{'name': layer.name, 'loops': len(layer.data),
                                   'sha256': digest_rows((tuple(loop.uv) for loop in layer.data), 'f')} for layer in mesh.uv_layers],
                           'modifiers': [(mod.name, mod.type, mod.show_viewport, mod.show_render) for mod in obj.modifiers]})
        shader_records = []
        for mat in materials:
            tree = mat.node_tree if mat.use_nodes else None
            shader_records.append({'name': material_names.get(mat.name, mat.name),
                                   'roughness': mat.roughness,
                                   'nodes': [(n.name, n.type) for n in tree.nodes] if tree else [],
                                   'links': sorted((l.from_node.name, l.from_socket.identifier, l.to_node.name, l.to_socket.identifier) for l in tree.links) if tree else [],
                                   'principledRoughness': [(n.name, n.inputs['Roughness'].default_value) for n in tree.nodes if n.type == 'BSDF_PRINCIPLED'] if tree else []})
        return {'meshes': sorted(meshes, key=lambda x: x['name']), 'materials': sorted(shader_records, key=lambda x: x['name'])}

    before = snapshot()
    active = bpy.context.window.scene.as_pointer()
    results = []
    error = None
    directory.mkdir(parents=True)
    try:
        for ident in IDS:
            item = items[ident]
            receipt = json.loads((root / item['outputs']['receipt']).read_text())
            original = check(root, receipt['outputs']['sourceBlend'])
            candidate = root / original['path']
            temporary = directory / (ident + '-edited.blend')
            with api['load_source'](candidate) as (scene, keys, names):
                eligible = [obj for obj in scene.objects if obj.type == 'MESH' and len(obj.data.vertices)
                            and not obj.hide_render and obj.data.library is None and obj.data.users == 1
                            and not obj.data.shape_keys and not obj.get('motion_role') and not obj.get('shared_geometry')]
                if not eligible:
                    raise ValueError('No independent editable static mesh: ' + ident)
                obj = max(eligible, key=lambda o: len(o.data.vertices))
                options = [(mat, node) for mat in obj.data.materials if mat and mat.use_nodes and mat.library is None
                           for node in mat.node_tree.nodes if node.type == 'BSDF_PRINCIPLED']
                if not options:
                    raise ValueError('No editable Principled shader: ' + ident)
                mat, node = sorted(options, key=lambda pair: pair[1].inputs['Roughness'].is_linked)[0]
                prior = fingerprint(scene)
                position = tuple(obj.data.vertices[0].co)
                obj.data.vertices[0].co.x += .0005
                socket = node.inputs['Roughness']
                old_roughness = socket.default_value
                socket.default_value = old_roughness + (.03125 if old_roughness <= .96875 else -.03125)
                expected = fingerprint(scene)
                if expected == prior:
                    raise ValueError('The requested temporary edits did not change editable data')
                changes = {'mesh': names.get(obj.name, obj.name), 'savedMeshObjectName': obj.name, 'vertexIndex': 0,
                           'beforeVertex': position, 'afterVertex': tuple(obj.data.vertices[0].co),
                           'material': keys.get(mat.name, mat.name), 'savedMaterialName': mat.name,
                           'node': node.name, 'property': 'inputs.Roughness.default_value',
                           'beforeRoughness': old_roughness, 'afterRoughness': socket.default_value,
                           'socketLinked': socket.is_linked}
                owner = scene.pop(api['OWNER_KEY'], None)
                try:
                    bpy.data.libraries.write(str(temporary), {scene}, fake_user=True, compress=True)
                finally:
                    if owner is not None:
                        scene[api['OWNER_KEY']] = owner
            if snapshot() != before or bpy.context.window.scene.as_pointer() != active:
                raise ValueError('Ownership differed after temporary edit/save: ' + ident)
            with api['load_source'](temporary) as (scene, keys, names):
                actual = fingerprint(scene, keys, names)
                if actual != expected:
                    raise ValueError('Edited mesh, UV, topology, material, or modifiers changed during save/reopen: ' + ident)
            if snapshot() != before or bpy.context.window.scene.as_pointer() != active:
                raise ValueError('Ownership differed after temporary reopen: ' + ident)
            check(root, original)
            results.append({'id': ident, 'original': original, 'temporaryCopy': record(root, temporary.relative_to(root).as_posix()),
                            'edits': changes, 'before': prior, 'afterSaveReopen': actual,
                            'exactRoundTrip': True, 'originalUnchanged': True, 'ownershipIdentical': True})
    except Exception as exc:
        error = type(exc).__name__ + ': ' + str(exc)
    after = snapshot()
    restored = active == bpy.context.window.scene.as_pointer()
    if after != before or not restored:
        error = error or 'Final ownership or active scene differs'
    evidence = {'version': 1, 'scope': 'representative-native-edit-save-reopen',
                'status': 'passed' if error is None else 'failed', 'error': error,
                'catalogSha256': catalog['catalogSha256'],
                'probe': record(root, Path(__file__).resolve().relative_to(root).as_posix()),
                'dependencies': [record(root, 'tools/blender/catalog_realism/' + name) for name in ('source.py', 'editability_probe.py')],
                'ownership': {'before': {k: len(v) for k, v in before.items()}, 'after': {k: len(v) for k, v in after.items()},
                              'identical': before == after, 'activeSceneRestored': restored},
                'models': results, 'limits': ['Two representative .blend round trips; not a 902-model mutation test.',
                                            'Socket persistence proves editability; linked sockets may not change visible shading.']}
    with target.open('x', encoding='utf-8', newline='\n') as stream:
        stream.write(json.dumps(evidence, indent=2) + '\n')
    return {'status': evidence['status'], 'error': error, 'path': OUTPUT, 'ownership': evidence['ownership'],
            'models': [{'id': model['id'], 'exactRoundTrip': model['exactRoundTrip'],
                        'originalUnchanged': model['originalUnchanged'], 'mesh': model['edits']['mesh'],
                        'material': model['edits']['material'], 'socketLinked': model['edits']['socketLinked']} for model in results]}
