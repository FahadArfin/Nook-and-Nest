"""Export the shaped-sofa study with native tiled PBR maps and a bound receipt.

Run build(root), inspect the exported GLB, then use model_pipeline_review.py.
No texture baking is claimed or performed here. Existing studies stay unchanged.
"""
import hashlib
import json
import runpy
from pathlib import Path
from types import SimpleNamespace

import bpy


def build(root_path):
    root = Path(root_path).resolve()
    spec_path = root / 'assets-source/model-pipeline/sofa-sectional-rebuilt.spec.json'
    spec = json.loads(spec_path.read_text(encoding='utf-8'))
    def record(path):
        path = Path(path).resolve()
        if not path.is_relative_to(root):
            raise ValueError('Asset path must stay in this repository')
        return {'path': path.relative_to(root).as_posix(),
                'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                'bytes': path.stat().st_size}
    paths = ['tools/blender/sectional_realism_study.py',
             'tools/blender/sectional_realism_materials.py',
             'tools/blender/sectional_realism_export.py',
             'tools/blender/sofa_realism_study.py',
             'tools/blender/sofa_realism_materials.py',
             'tools/blender/detail_pipeline/core.py']
    bound = [record(root / p) | {'role': 'builder'} for p in paths]
    spec_record = record(spec_path)
    baseline_record = record(root / spec['sourceBlend'])
    # The original source remains an explicit compatibility reference, not a
    # claim that these new hand-shaped meshes derive from its foam blocks.
    with bpy.data.libraries.load(str(root / spec['sourceBlend']), link=False) as (source, _):
        if not source.scenes:
            raise ValueError('Missing baseline Blender source scenes')
    core = runpy.run_path(str(root / paths[-1]))
    author = runpy.run_path(str(root / paths[0]))
    materials_module = runpy.run_path(str(root / paths[1]))
    for item in materials_module['source_manifest'](root):
        if not any(p['path'] == item['path'] for p in bound):
            bound.append(record(root / item['path']) | {'role': 'material'})
    materials = materials_module['create_materials'](root)
    previous = bpy.context.window.scene
    runtime = author['build'](root, materials=materials)
    owned = []
    ctx = SimpleNamespace(own=lambda data: owned.append(data) or data)
    export_scene = bpy.data.scenes.new('Sectional realism temporary export')
    def use(scene):
        bpy.context.window.scene = scene
        bpy.context.view_layer.update()
    def select(objects):
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
    try:
        use(runtime['masterScene'])
        master = core['evaluated_stats'](runtime['masterParts'])
        use(runtime['browserScene'])
        browser = core['evaluated_stats'](runtime['browserParts'])
        core['require_envelope'](master, spec['dimensionsM'])
        core['require_envelope'](browser, spec['dimensionsM'])
        if browser['triangles'] > spec['budgets']['maxTriangles']:
            raise ValueError('Browser triangle budget exceeded')
        maps = materials_module['material_map_receipts'](root, materials)
        for item in maps:
            if not any(p['path'] == item['path'] for p in bound):
                bound.append(record(root / item['path']) | {'role': 'material'})
        for material in materials.values():
            for node in material.node_tree.nodes:
                if node.type == 'TEX_IMAGE' and node.image and not node.image.packed_file:
                    node.image.pack()
        source = root / spec['outputs']['sourceBlend']
        source.parent.mkdir(parents=True, exist_ok=True)
        bpy.data.libraries.write(str(source), {runtime['masterScene'], runtime['browserScene']},
                                 fake_user=True, compress=True)
        use(runtime['browserScene'])
        graph = bpy.context.evaluated_depsgraph_get()
        copies = []
        for obj in runtime['browserParts']:
            evaluated = obj.evaluated_get(graph)
            data = evaluated.to_mesh()
            try:
                mesh = core['_triangulated_export_mesh'](ctx, data)
            finally:
                evaluated.to_mesh_clear()
            # Bake the full affine transform into export vertices. Assigning
            # it to an object would decompose away the small parent shear.
            mesh.transform(obj.matrix_world)
            copy = bpy.data.objects.new('Export ' + obj.name, mesh)
            export_scene.collection.objects.link(copy)
            copies.append(copy)
        use(export_scene)
        groups = {}
        for obj in copies:
            keys = {m['material_key'] for m in obj.data.materials}
            if len(keys) != 1:
                raise ValueError('Tangent-safe export requires one material per part')
            groups.setdefault(next(iter(keys)), []).append(obj)
        joined = []
        for key, objects in groups.items():
            select(objects)
            if len(objects) > 1:
                bpy.ops.object.join()
            obj = bpy.context.view_layer.objects.active
            obj.name = spec['variantId'] + ' ' + key
            obj['catalog_id'] = spec['catalogId']
            obj.data.uv_layers.active = obj.data.uv_layers['UVMap']
            obj.data.uv_layers.active.active_render = True
            obj.data.calc_tangents(uvmap='UVMap')
            joined.append(obj)
        select(joined)
        glb = root / spec['outputs']['glb']
        glb.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.export_scene.gltf(filepath=str(glb), export_format='GLB',
            use_selection=True, use_active_scene=True, export_extras=True,
            export_apply=True, export_cameras=False, export_lights=False,
            export_texcoords=True, export_normals=True, export_tangents=True,
            export_image_format='AUTO')
        doc = core['_sanitize_glb'](glb)
        stats = core['_glb_bounds'](glb)
        core['require_envelope'](stats, spec['dimensionsM'])
        keys = sorted(m['name'] for m in doc['materials'])
        if keys != sorted(spec['materialKeys']):
            raise ValueError('Export material keys changed')
        primitives = sum(len(m['primitives']) for m in doc['meshes'])
        if primitives > spec['budgets']['maxPrimitives'] or glb.stat().st_size > spec['budgets']['maxGlbBytes']:
            raise ValueError('GLB budget exceeded')
        for item in bound + [spec_record, baseline_record]:
            if record(root / item['path'])['sha256'] != item['sha256']:
                raise RuntimeError('Build input changed during export: ' + item['path'])
        receipt = {'version': 1, 'recipe': 'sofa', 'seed': spec['seed'],
            'spec': spec_record, 'sourceBlend': baseline_record,
            'outputBlend': record(source), 'glb': record(glb),
            'inputs': bound, 'maps': maps, 'renders': [],
            'master': master, 'browser': browser, **stats,
            'materialKeys': keys, 'primitiveCount': primitives,
            'surface': spec['surface'], 'masterScene': runtime['masterScene'].name,
            'browserScene': runtime['browserScene'].name,
            'notes': runtime['sourceNotes']}
        output = root / spec['outputs']['receipt']
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8', newline='\n')
        return {'receipt': str(output), 'glb': receipt['glb'], 'master': master,
                'browser': browser, 'maps': len(maps), 'primitives': primitives}
    finally:
        bpy.context.window.scene = previous
        # Only exact temporary identities from this exporter are removed.
        for obj in list(export_scene.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.scenes.remove(export_scene)
        for data in owned:
            if data.as_pointer() and data.users == 0:
                bpy.data.meshes.remove(data)
