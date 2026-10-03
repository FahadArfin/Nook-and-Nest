"""Read-only native candidate inspection. Run only in the owner's Blender session.

Appends one candidate at a time through source.py's ownership context, inspects
its editable data, and writes evidence after cleanup. Never saves a .blend,
evaluates/applies modifiers, packs images, changes source geometry, or exports.
"""
from pathlib import Path
import hashlib
import json
import runpy

REPRESENTATIVES = (
    'wingback-chair', 'sofa', 'queen-bed', 'spruce-tree', 'small-plant',
    'vessel-sink', 'waffle-iron', 'reef-aquarium', 'sculpture-glass-table',
    'landscape-painting', 'sonos-sub-mini', 'window-tilt-turn',
)
OUTPUT = 'assets-source/catalog-realism/candidate-editability-evidence.json'


def file_record(root, name):
    root = Path(root).resolve()
    file = (root / name).resolve()
    file.relative_to(root)
    data = file.read_bytes()
    return {'path': file.relative_to(root).as_posix(),
            'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}


def check_record(root, record):
    measured = file_record(root, record['path'])
    if measured['sha256'] != record['sha256']:
        raise ValueError('Candidate dependency changed: ' + record['path'])
    if 'bytes' in record and measured['bytes'] != record['bytes']:
        raise ValueError('Candidate dependency size changed: ' + record['path'])
    return measured


def run(root, output=OUTPUT):
    import bpy
    root = Path(root).resolve()
    target = root / output
    target.resolve().relative_to(root)
    if target.exists():
        raise ValueError('Use a fresh evidence output; prior evidence is immutable')
    loader_path = root / 'tools/blender/catalog_realism/source.py'
    api = runpy.run_path(str(loader_path))
    catalog = json.loads((root / 'assets-source/catalog-realism/catalog.json').read_text())
    items = {item['id']: item for item in catalog['items']}
    if not set(REPRESENTATIVES) <= items.keys():
        raise ValueError('Representative candidate missing from frozen catalog')

    def snapshot():
        return {kind: sorted((data.as_pointer(), data.name) for data in getattr(bpy.data, kind))
                for kind in api['DATA_KINDS']}

    def counts(snapshot):
        return {kind: len(values) for kind, values in snapshot.items()}

    def reachable_from(scene):
        users = bpy.data.user_map()
        reachable = {scene}
        while True:
            additions = {data for data, refs in users.items()
                         if data not in reachable and reachable.intersection(refs)}
            if not additions:
                return reachable
            reachable.update(additions)

    def image_record(image):
        packed = list(getattr(image, 'packed_files', ()))
        packed_file = getattr(image, 'packed_file', None)
        packed_sizes = [entry.packed_file.size for entry in packed]
        if not packed_sizes and packed_file:
            packed_sizes = [packed_file.size]
        raw = image.filepath
        resolved = Path(bpy.path.abspath(raw, library=image.library)) if raw else None
        accessible = bool(resolved and resolved.is_file())
        status = ('packed' if packed_sizes and all(size > 0 for size in packed_sizes)
                  else 'accessible' if accessible
                  else 'generated' if image.source in ('GENERATED', 'VIEWER')
                  else 'missing')
        return {'name': image.name, 'source': image.source, 'filepath': raw,
                'size': list(image.size), 'colorspace': image.colorspace_settings.name,
                'packedBytes': packed_sizes, 'accessible': accessible, 'status': status}

    before = snapshot()
    previous_scene = bpy.context.window.scene.as_pointer()
    models = []
    error = None
    try:
        for ident in REPRESENTATIVES:
            item = items[ident]
            receipt_record = file_record(root, item['outputs']['receipt'])
            receipt = json.loads((root / receipt_record['path']).read_text())
            candidate = check_record(root, receipt['outputs']['sourceBlend'])
            if candidate['path'] != item['outputs']['sourceBlend']:
                raise ValueError('Candidate editable-source path differs: ' + ident)
            dependencies = [check_record(root, record) for record in receipt['inputs']]
            model = {'id': ident, 'category': item.get('category'), 'family': item.get('family'),
                     'candidate': candidate, 'receipt': receipt_record, 'sourceDependencies': dependencies}
            local_before = snapshot()
            with api['load_source'](root / candidate['path']) as (scene, keys, names):
                reachable = reachable_from(scene)
                meshes = []
                for obj in scene.objects:
                    if obj.type != 'MESH':
                        continue
                    modifiers = []
                    for modifier in obj.modifiers:
                        record = {'name': modifier.name, 'type': modifier.type,
                                  'viewport': modifier.show_viewport, 'render': modifier.show_render}
                        for field in ('width', 'segments', 'levels', 'render_levels', 'operation', 'solver'):
                            if hasattr(modifier, field):
                                record[field] = getattr(modifier, field)
                        operand = getattr(modifier, 'object', None)
                        if operand is not None:
                            record['object'] = names.get(operand.name, operand.name)
                            record['operandInOwnedScene'] = operand.name in scene.objects
                        modifiers.append(record)
                    meshes.append({'name': names.get(obj.name, obj.name), 'mesh': obj.data.name,
                        'editable': obj.data.library is None, 'vertices': len(obj.data.vertices),
                        'polygons': len(obj.data.polygons), 'edges': len(obj.data.edges),
                        'materials': [keys.get(m.name, m.name) if m else None for m in obj.data.materials],
                        'uvLayers': [{'name': uv.name, 'loops': len(uv.data), 'activeRender': uv.active_render}
                                     for uv in obj.data.uv_layers],
                        'modifiers': modifiers, 'shapeKeys': list(obj.data.shape_keys.key_blocks.keys()) if obj.data.shape_keys else [],
                        'motionRole': obj.get('motion_role'), 'sharedGeometry': obj.get('shared_geometry'),
                        'hiddenForRender': obj.hide_render, 'meshUsers': obj.data.users,
                        'boundsM': api['mesh_bounds'](obj)})
                materials = []
                for material in sorted((m for m in bpy.data.materials if m in reachable), key=lambda m: m.name):
                    tree = material.node_tree
                    materials.append({'name': keys.get(material.name, material.name), 'editable': material.library is None,
                                      'nodes': [{'name': node.name, 'type': node.type} for node in tree.nodes] if tree else [],
                                      'links': len(tree.links) if tree else 0})
                images = [image_record(image) for image in bpy.data.images if image in reachable]
                libraries = [{'name': data.name, 'path': data.filepath,
                              'accessible': Path(bpy.path.abspath(data.filepath)).is_file()}
                             for data in bpy.data.libraries if data in reachable]
                model.update({'scene': scene.name, 'recipe': scene.get('catalog_realism_recipe'),
                              'contractSha256': scene.get('catalog_realism_contract'),
                              'meshes': meshes, 'materials': materials, 'images': images,
                              'libraries': libraries,
                              'nonMeshObjects': [{'name': names.get(o.name, o.name), 'type': o.type} for o in scene.objects if o.type != 'MESH']})
                if not meshes or any(not mesh['editable'] for mesh in meshes):
                    raise ValueError('Candidate has missing or linked-only mesh data: ' + ident)
                if model['contractSha256'] != item['contractSha256']:
                    raise ValueError('Candidate contract differs: ' + ident)
                if any(image['status'] == 'missing' for image in images) or any(not lib['accessible'] for lib in libraries):
                    raise ValueError('Candidate has inaccessible image/library dependencies: ' + ident)
            local_after = snapshot()
            model['ownership'] = {'before': counts(local_before), 'after': counts(local_after), 'identical': local_before == local_after}
            models.append(model)
            if local_before != local_after:
                raise ValueError('Candidate ownership cleanup differs: ' + ident)
            check_record(root, candidate)
            check_record(root, receipt_record)
    except Exception as exc:
        error = type(exc).__name__ + ': ' + str(exc)
    after = snapshot()
    restored = previous_scene == bpy.context.window.scene.as_pointer()
    if before != after or not restored:
        error = error or 'Blender data ownership or active scene changed'
    evidence = {'version': 1, 'scope': 'representative-candidate-editability',
                'status': 'passed' if error is None else 'failed', 'error': error,
                'catalogSha256': catalog['catalogSha256'],
                'probe': file_record(root, Path(__file__).resolve().relative_to(root).as_posix()),
                'loader': file_record(root, loader_path.relative_to(root).as_posix()),
                'ownership': {'before': counts(before), 'after': counts(after), 'identical': before == after,
                              'activeSceneRestored': restored}, 'models': models,
                'limits': ['Representative inspection, not an edit/export round trip or full 902-source proof.',
                           'Editable mesh topology and retained modifiers are inspected without applying them.']}
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open('x', encoding='utf-8', newline='\n') as stream:
        stream.write(json.dumps(evidence, indent=2) + '\n')
    summary = {'status': evidence['status'], 'path': output, 'ownership': evidence['ownership'],
               'models': [{'id': model['id'], 'meshes': len(model['meshes']),
                           'vertices': sum(m['vertices'] for m in model['meshes']),
                           'modifiers': sum(len(m['modifiers']) for m in model['meshes']),
                           'materials': len(model['materials']), 'packedImages': sum(i['status'] == 'packed' for i in model['images']),
                           'accessibleImages': sum(i['status'] == 'accessible' for i in model['images'])} for model in models]}
    if error:
        summary['error'] = error
    return summary
