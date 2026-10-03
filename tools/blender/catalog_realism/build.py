"""Resumable catalog authoring, executed in the connected Blender MCP instance.

Each run loads one original source into an owned scene, saves an editable
candidate, exports evaluated copies, and binds every input in a receipt.
Processing does not grant visual approval or overwrite a production asset.
"""
from pathlib import Path
import hashlib
import json
import re
import runpy
import time
import traceback

import bpy
from mathutils import Matrix

DIRECTORY = 'tools/blender/catalog_realism'
AQUARIUMS = {'desktop-aquarium', 'planted-aquarium', 'reef-aquarium'}
_LOADED_BUILD_SHA256 = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()


def record(root, path):
    path = (Path(root) / path).resolve()
    if not path.is_relative_to(Path(root).resolve()):
        raise ValueError('Catalog artifact must remain in its worktree')
    return {'path': path.relative_to(root).as_posix(),
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'bytes': path.stat().st_size}


def write_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8', newline='\n')
    temporary.replace(path)


def canonical_materials(scene, names, item):
    keys = set(item['materialKeys'])
    result = {}
    for material in {m for obj in scene.objects if obj.type == 'MESH' for m in obj.data.materials if m}:
        source = names[material.name]
        candidates = [material.get('material_key'), material.get('sofa_material_key'), source,
                      re.sub(r'\.\d+$', '', source)]
        # An exact source key always wins over a numeric-suffix inference.
        key = source if source in keys else next((c for c in candidates if c in keys), None)
        if key is None:
            raise ValueError(f'{item["id"]}: source material has no exact catalog slot: {source}')
        result[material.name] = key
        material['material_key'] = key
    if set(result.values()) != keys:
        raise ValueError('Source material slots differ from the frozen catalog: ' + item['id'])
    return result


def is_protected(obj):
    while obj:
        if obj.get('motion_role') or obj.get('shared_geometry'):
            return True
        obj = obj.parent
    return False


def select(objects):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]


def repair_metric_triangle_uv(points, coordinates, scale, profile, longest_axis, project_metres, density=1.0):
    """Repair only a collapsed metric chart using this triangle's own plane."""
    def area(values):
        a, b, c = values
        return abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])) / 2
    if area(coordinates) >= 1e-14:
        return None
    a, b, c = points
    u, v = [b[i]-a[i] for i in range(3)], [c[i]-a[i] for i in range(3)]
    normal = (u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0])
    if max(abs(value) for value in normal) == 0:
        raise ValueError('Collapsed geometry cannot define a metric UV chart')
    repaired = [tuple(value*density for value in project_metres(
        point, normal, scale, profile in {'wood', 'bark', 'metal'}, longest_axis)) for point in points]
    if area(repaired) < 1e-14:
        raise ValueError('Triangle cannot define a nondegenerate metric UV chart')
    return repaired


def subset_mesh(source, polygons, name, scale=(1, 1, 1), longest_axis=2, material_helpers=None, uv_repairs=None):
    """Retain polygon smoothing, source UV0 and all authored split normals."""
    used = sorted({i for p in polygons for i in p.vertices})
    mapping = {index: i for i, index in enumerate(used)}
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([source.vertices[i].co for i in used], [],
                     [[mapping[i] for i in p.vertices] for p in polygons])
    # Some authored sources retain empty, unused slots. Copy only the slots
    # referenced by this subset, retaining their actual material identities.
    material_indices = sorted({p.material_index for p in polygons})
    material_mapping = {old: new for new, old in enumerate(material_indices)}
    for index in material_indices:
        mat = source.materials[index]
        if mat is None:
            raise ValueError(f'Exported faces reference an empty material slot: {name}')
        mesh.materials.append(mat.original)
    original_loops = []
    for old, new in zip(polygons, mesh.polygons):
        new.material_index = material_mapping[old.material_index]
        new.use_smooth = source.polygons[old.polygon_index].use_smooth
        original_loops.extend(old.loops)
    for layer in source.uv_layers:
        target = mesh.uv_layers.new(name=layer.name)
        for i, source_loop in enumerate(original_loops):
            target.data[i].uv = layer.data[source_loop].uv
        if layer.name == 'RealismUV' and material_helpers is not None:
            for old, new in zip(polygons, mesh.polygons):
                material = source.materials[old.material_index].original
                profile = material.get('catalog_realism_profile')
                if not profile:
                    continue  # Unused channels on protected materials stay exact.
                repaired = repair_metric_triangle_uv(
                    [source.vertices[index].co for index in old.vertices],
                    [layer.data[index].uv for index in old.loops], scale, profile,
                    longest_axis, material_helpers['project_metres'],
                    material_helpers['face_uv_density'](source, old.polygon_index))
                if repaired is None:
                    continue
                for index, uv in zip(new.loop_indices, repaired):
                    target.data[index].uv = uv
                if uv_repairs is not None:
                    uv_repairs.append({'triangle': old.index, 'materialKey': material['material_key']})
    if source.has_custom_normals:
        mesh.normals_split_custom_set([source.corner_normals[i].vector for i in original_loops])
    mesh.update()
    return mesh


def export_copies(root, scene, item, material_records, temporary, changes, object_names, capture_owned):
    """Join only static copies, separating meshes by tangent UV basis."""
    maps = {r['materialKey']: r for r in material_records}
    baseline = {m['name']: m for m in item['baselineGltf']['materials']}
    material_helpers = runpy.run_path(str(Path(root) / DIRECTORY / 'materials.py'))
    uv_repair_components = []
    export_scene = bpy.data.scenes.new('Catalog candidate export ' + item['id'])
    export_scene['catalog_realism_owner'] = scene.get('catalog_realism_owner', '')
    graph = bpy.context.evaluated_depsgraph_get()
    graph.update()
    refined = {c['component'] for c in changes if c['kind'].startswith('tailored-')}
    pad_triangles = sum(c['after']['triangles'] for c in changes if c['kind'].startswith('tailored-'))
    # Count the actual final non-cover construction, including new trim and
    # supports. Estimating this from the old GLB misses added seam topology.
    other_triangles = 0
    for obj in scene.objects:
        if obj.type not in {'MESH', 'CURVE', 'SURFACE', 'FONT'} or obj.hide_render or object_names.get(obj.name, obj.name) in refined:
            continue
        evaluated = obj.evaluated_get(graph)
        mesh = evaluated.to_mesh()
        if mesh:
            mesh.calc_loop_triangles()
            other_triangles += len(mesh.loop_triangles)
        evaluated.to_mesh_clear()
    limit = max(item['baselineCost']['triangles'] + 20000, item['baselineCost']['triangles'] * 2)
    pad_ratio = min(1, max(.15, (limit * .94 - other_triangles) / max(1, pad_triangles)))
    groups = {}
    for obj in list(scene.objects):
        if obj.type not in {'MESH', 'CURVE', 'SURFACE', 'FONT'} or is_protected(obj) or obj.hide_render:
            continue
        if item['id'] in AQUARIUMS and not obj.name.startswith(('detail_casework_', 'detail_fastener_')):
            continue
        evaluated = obj.evaluated_get(graph)
        source = evaluated.to_mesh(preserve_all_data_layers=True, depsgraph=graph)
        try:
            if source is None or not source.polygons:
                continue
            source.calc_loop_triangles()
            scale = tuple(obj.matrix_world.to_scale())
            original_vertices = getattr(obj.data, 'vertices', source.vertices)
            if not original_vertices:
                original_vertices = source.vertices
            spans = [max(v.co[axis] for v in original_vertices)-min(v.co[axis] for v in original_vertices) for axis in range(3)]
            longest_axis = max(range(3), key=lambda axis: spans[axis]*abs(scale[axis]))
            by_basis = {}
            for polygon in source.loop_triangles:
                # Original tapered parts can contain duplicate apex vertices.
                # Those zero-area slivers cannot define a tangent basis.
                a, b, c = [obj.matrix_world @ source.vertices[i].co for i in polygon.vertices]
                # Bevel evaluation can also leave nanometre-wide duplicate
                # apex edges. They collapse in float32 UVs and have no visible
                # surface area; exclude those export-only numeric slivers.
                edge_lengths_squared = [(b-a).length_squared, (c-b).length_squared, (a-c).length_squared]
                area_squared = (b-a).cross(c-a).length_squared
                # Long bevel slivers can have ordinary-length edges but only
                # a few nanometres of altitude, below float32 chart precision.
                if area_squared < max(1e-24, max(edge_lengths_squared) * 1e-14) or min(edge_lengths_squared) < 1e-16:
                    continue
                mat = source.materials[polygon.material_index].original
                key = mat['material_key']
                native = baseline[key].get('normalTexture')
                replacement_normal = any(m['kind'] == 'normal' for m in maps.get(key, {}).get('textureReplacements', []))
                if native and not replacement_normal:
                    index = native.get('extensions', {}).get('KHR_texture_transform', {}).get('texCoord', native.get('texCoord', 0))
                    basis = source.uv_layers[index].name if len(source.uv_layers) > index else 'UVMap'
                else:
                    basis = 'RealismUV' if any(m['kind'] == 'normal' for m in maps.get(key, {}).get('maps', [])) else 'UVMap'
                by_basis.setdefault(basis, []).append(polygon)
            for basis, polygons in by_basis.items():
                repairs = []
                mesh = subset_mesh(source, polygons, obj.name + ' exported', scale, longest_axis, material_helpers, repairs)
                if repairs:
                    for key in sorted({record['materialKey'] for record in repairs}):
                        indices = [record['triangle'] for record in repairs if record['materialKey'] == key]
                        uv_repair_components.append({'component': object_names.get(obj.name, obj.name),
                            'materialKey': key, 'triangleCount': len(indices), 'sourceTriangles': indices})
                mesh.transform(obj.matrix_world)
                copy = bpy.data.objects.new('Export ' + obj.name, mesh)
                export_scene.collection.objects.link(copy)
                if object_names.get(obj.name, obj.name) in refined and pad_ratio < 1:
                    modifier = copy.modifiers.new('Browser cover reduction; editable source retains full detail', 'DECIMATE')
                    modifier.decimate_type = 'COLLAPSE'
                    modifier.ratio = pad_ratio
                    modifier.use_collapse_triangulate = True
                    # Apply on this export copy before joining unrelated parts.
                    bpy.context.window.scene = export_scene
                    select([copy])
                    bpy.ops.object.modifier_apply(modifier=modifier.name)
                    bpy.context.window.scene = scene
                group = (basis, obj.name if item['id'] in AQUARIUMS else '')
                groups.setdefault(group, []).append(copy)
        finally:
            evaluated.to_mesh_clear()
    if not groups:
        raise ValueError('No upgraded static geometry to export: ' + item['id'])
    if uv_repair_components:
        changes.append({'kind': 'export-only-realism-uv-repair', 'catalogId': item['id'], 'layer': 'RealismUV',
            'triangleCount': sum(record['triangleCount'] for record in uv_repair_components),
            'components': uv_repair_components,
            'details': 'Only collapsed evaluated RealismUV triangles reprojected in part-local metres; original UV0, healthy UVs and editable modifiers retained.'})
    bpy.context.window.scene = export_scene
    bpy.context.view_layer.update()
    capture_owned(export_scene)
    joined = []
    for (basis, detail_name), copies in groups.items():
        select(copies)
        if len(copies) > 1:
            bpy.ops.object.join()
        obj = bpy.context.object
        obj.name = detail_name or ('catalog_surface_' + basis)
        obj['catalog_id'] = item['id']
        # active_render drives tangent generation, while UV collection order
        # preserves TEXCOORD_0 artwork and TEXCOORD_1 calibrated new surfaces.
        layer = obj.data.uv_layers.get(basis)
        if layer:
            obj.data.uv_layers.active = layer
            layer.active_render = True
        triangulate = obj.modifiers.new('Triangulate evaluated browser copy', 'TRIANGULATE')
        triangulate.keep_custom_normals = True
        joined.append(obj)
    select(joined)
    temporary.parent.mkdir(parents=True, exist_ok=True)
    owner_token = export_scene.pop('catalog_realism_owner', None)
    try:
        bpy.ops.export_scene.gltf(filepath=str(temporary), export_format='GLB', use_selection=True,
            use_active_scene=True, export_extras=True, export_apply=True, export_cameras=False,
            export_lights=False, export_texcoords=True, export_normals=True, export_tangents=True,
            export_animations=False, export_image_format='AUTO')
    finally:
        if owner_token is not None:
            export_scene['catalog_realism_owner'] = owner_token
    bpy.context.window.scene = scene
    return len(joined)


def static_root(glb, baseline_path, helpers):
    """Preserve the original placement root without refitting any geometry."""
    g, binary = helpers['read_glb'](glb)
    baseline, _ = helpers['read_glb'](baseline_path)
    roots = baseline['scenes'][baseline.get('scene', 0)]['nodes']
    statics = [baseline['nodes'][i] for i in roots
               if not baseline['nodes'][i].get('extras', {}).get('motion_role')
               and not baseline['nodes'][i].get('extras', {}).get('shared_geometry')]
    if len(statics) != 1:
        raise ValueError('Expected the audited single static catalog root')
    original = statics[0]
    root = {key: value for key, value in original.items() if key not in {'mesh', 'children', 'skin', 'weights'}}
    children = g['scenes'][g.get('scene', 0)]['nodes']
    if 'matrix' in root:
        transform = Matrix([root['matrix'][i:i+4] for i in range(0, 16, 4)]).transposed()
    else:
        from mathutils import Quaternion, Vector
        rotation = root.get('rotation', [0, 0, 0, 1])
        transform = Matrix.LocRotScale(Vector(root.get('translation', [0, 0, 0])),
            Quaternion((rotation[3], *rotation[:3])), Vector(root.get('scale', [1, 1, 1])))
    inverse = transform.inverted()
    for index in children:
        node = g['nodes'][index]
        if any(key in node for key in ('matrix', 'translation', 'rotation', 'scale')):
            raise ValueError('Static export copies must have identity world transforms')
        if transform != Matrix.Identity(4):
            node['matrix'] = [value for column in inverse.transposed() for value in column]
    root['children'] = list(children)
    g['nodes'].append(root)
    g['scenes'][0] = {**baseline['scenes'][baseline.get('scene', 0)], 'nodes': [len(g['nodes']) - 1]}
    helpers['write_glb'](glb, g, binary)


def build(root_path, catalog_id):
    root = Path(root_path).resolve()
    started = time.monotonic()
    build_input = record(root, DIRECTORY + '/build.py')
    if build_input['sha256'] != _LOADED_BUILD_SHA256:
        raise ValueError('Build module changed since it was loaded; reload it before continuing')
    manifest = json.loads((root / 'assets-source/catalog-realism/catalog.json').read_text(encoding='utf-8'))
    item = next(i for i in manifest['items'] if i['id'] == catalog_id)
    for field in ('sourceBlend', 'baselineGlb', 'preview'):
        if record(root, item[field]['path']) != item[field]:
            raise ValueError('Frozen baseline changed: ' + item[field]['path'])
    modules = {name: runpy.run_path(str(root / DIRECTORY / (name + '.py')))
               for name in ('source', 'geometry', 'forms', 'books', 'lighting', 'special', 'materials', 'glb', 'tangents')}
    inputs = [record(root, DIRECTORY + '/' + name + '.py') for name in ('source', 'geometry', 'forms', 'books', 'lighting', 'special', 'materials', 'scans', 'glb', 'tangents')]
    # Retain the entry-checked bytes so the final verification also rejects an
    # edit after entry, before the remaining helper inputs have been captured.
    inputs.append(build_input)
    inputs += [record(root, p) for p in ('tools/blender/sectional_realism_study.py',
        'assets-source/catalog-realism/baseline-inputs/tools/blender/build_quality_models.py',
        'tools/blender/sofa_realism_study.py', 'assets-source/catalog-realism/material-plan.json',
        'assets-source/catalog-realism/material-provenance.json', 'assets-source/catalog-realism/scan-plan.json',
        'assets-source/realism-materials.json', 'assets-source/realism-scans.json',
        'assets-source/realism-texture-provenance.json', item['sourceBlend']['path'], item['baselineGlb']['path'])]
    output = root / item['outputs']['glb']
    temporary = output.with_name('.' + catalog_id + '-candidate.glb')
    with modules['source']['load_source'](root / item['sourceBlend']['path']) as (scene, names, object_names):
        keys = canonical_materials(scene, names, item)
        changes = modules['geometry']['apply'](root, scene, item, keys, object_names)
        changes += modules['forms']['apply'](root, scene, item, keys, object_names)
        changes += modules['books']['apply'](root, scene, item, keys, object_names)
        changes += modules['lighting']['apply'](root, scene, item, keys, object_names)
        changes += modules['special']['apply'](root, scene, item, keys, object_names)
        materials = modules['materials']['apply_materials'](root, scene, item, keys)
        for mat in {m for obj in scene.objects if obj.type == 'MESH' for m in obj.data.materials if m}:
            mat.update_tag()
        bpy.context.view_layer.update()
        for material in materials:
            if material.get('maps') or material.get('surfaceAdjustments'):
                changes.append({'kind': 'calibrated-surface', 'materialKey': material['materialKey'],
                    'profile': material['profile'], 'maps': [m['kind'] for m in material['maps']],
                    'surfaceAdjustments': material.get('surfaceAdjustments', {})})
            for image in material['maps']:
                if not any(i['path'] == image['path'] for i in inputs):
                    inputs.append(record(root, image['path']))
        if not changes:
            raise ValueError('No substantiated improvement; model needs an individual geometry recipe')
        scene['catalog_realism_recipe'] = 'construction-refinement-v1'
        scene['catalog_realism_contract'] = item['contractSha256']
        source = root / item['outputs']['sourceBlend']
        source.parent.mkdir(parents=True, exist_ok=True)
        temporary_source = source.with_name('.' + catalog_id + '-candidate.blend')
        for mat in {m for obj in scene.objects if obj.type == 'MESH' for m in obj.data.materials if m}:
            if mat.use_nodes:
                for node in mat.node_tree.nodes:
                    if node.type == 'TEX_IMAGE' and node.image and not node.image.packed_file:
                        node.image.pack()
        owner_token = scene.pop('catalog_realism_owner', None)
        try:
            bpy.data.libraries.write(str(temporary_source), {scene}, fake_user=True, compress=True)
        finally:
            if owner_token is not None:
                scene['catalog_realism_owner'] = owner_token
        count = export_copies(root, scene, item, materials, temporary, changes, object_names, modules['source']['capture_owned'])
        tangent_repairs = modules['tangents']['repair'](temporary, modules['glb'])
        if catalog_id not in AQUARIUMS:
            static_root(temporary, root / item['baselineGlb']['path'], modules['glb'])
        merged = modules['glb']['reconcile_materials'](temporary, root / item['baselineGlb']['path'], keys,
            materials, root / 'assets-source/catalog-realism/maps' / catalog_id, root=root)
        preservation = modules['glb']['preserve_protected_subtrees'](temporary, root / item['baselineGlb']['path'],
            preserve_all_original=catalog_id in AQUARIUMS)
        for mapped in merged['newMaps']:
            if not any(i['path'] == mapped['path'] for i in inputs):
                inputs.append(record(root, mapped['path']))
        for old in inputs:
            if record(root, old['path']) != old:
                raise ValueError('Build input changed while exporting: ' + old['path'])
        # A receipt is the commit marker. Until it exists with both hashes, a
        # interrupted pair is rejected by status and cannot enter a beta build.
        temporary_source.replace(source)
        temporary.replace(output)
        receipt = {'version': 1, 'catalogId': catalog_id, 'inputContractSha256': item['contractSha256'],
            'state': 'processed', 'recipe': {'id': 'catalog-construction-refinement', 'version': 1,
                **record(root, DIRECTORY + '/build.py')},
            'inputs': inputs, 'buildInputs': inputs,
            'materialPlan': record(root, 'assets-source/catalog-realism/material-plan.json'),
            'changes': changes, 'materialRecords': materials, 'newMaps': merged['newMaps'],
            'surfaceAdjustments': merged.get('surfaceAdjustments', []),
            'scanPlan': record(root, 'assets-source/catalog-realism/scan-plan.json'),
            'textureReplacements': merged.get('textureReplacements', []),
            'tangentRepairs': tangent_repairs,
            'outputs': {'sourceBlend': record(root, source), 'glb': record(root, output)},
            'renders': [], 'timingSeconds': round(time.monotonic() - started, 2), 'exportMeshes': count}
        if catalog_id in AQUARIUMS:
            receipt['recipe']['capabilities'] = ['aquarium-additive-casework']
            receipt['aquariumPreservation'] = {'mode': 'additive-casework-only',
                'additions': preservation['additions']}
        write_json(root / item['outputs']['receipt'], receipt)
        failure = root / ('assets-source/catalog-realism/failures/' + catalog_id + '.json')
        if failure.exists():
            failure.unlink()
    return {'id': catalog_id, 'changes': len(changes), 'glbBytes': output.stat().st_size,
            'seconds': round(time.monotonic() - started, 2), 'review': 'pending'}


def build_batch(root_path, ids):
    root = Path(root_path).resolve()
    results = []
    for catalog_id in ids:
        try:
            results.append(build(root, catalog_id))
        except Exception as error:
            result = {'id': catalog_id, 'error': str(error), 'traceback': traceback.format_exc()}
            write_json(root / ('assets-source/catalog-realism/failures/' + catalog_id + '.json'), result)
            results.append(result)
    return results
