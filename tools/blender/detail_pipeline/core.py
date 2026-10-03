"""Reusable bounded Blender authoring, selected-to-active baking and GLB export.

Recipe modules implement build(context) and return master_parts, browser_parts,
bake_sources and bake_target. They do not export or manipulate global preferences.
All paths in a spec are repository-relative and resolved independently of cwd.
"""
import hashlib
import importlib
import importlib.util
import json
import math
import struct
import time
import uuid
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector

ROOT = Path(__file__).resolve().parents[3]
SESSIONS = bpy.app.driver_namespace.setdefault('nook.detail_pipeline.sessions.v1', {})
BAKE_PASSES = ('normal', 'baseColor', 'roughness', 'ao')


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def path_in(root, relative):
    path = (root / relative).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError('Pipeline paths must stay inside the selected repository: ' + str(relative))
    return path


def asset_receipt(ctx, path):
    path = Path(path)
    return {'path': path.relative_to(ctx.root).as_posix(), 'sha256': sha256(path), 'bytes': path.stat().st_size}


def _live(data):
    try:
        return data is not None and data.as_pointer() != 0
    except ReferenceError:
        return False


class Context:
    """A recipe's isolated scenes and exact owned datablock references."""
    def __init__(self, root, spec_path, spec):
        self.root, self.spec_path, self.spec = root, spec_path, spec
        self.id = str(uuid.uuid4())
        self.owned = []; self.maps = {}; self.durations = {}; self.failures = []
        self.status = 'preparing'
        self.master = self.scene(spec['recipe'] + ' pipeline editable master')
        self.browser = self.scene(spec['recipe'] + ' pipeline browser mesh')
        self.bake_scene = self.scene(spec['recipe'] + ' pipeline bake stage')
        self.bake_scene.render.engine = 'CYCLES'
        self.bake_scene.cycles.device = 'CPU'
        # Use an already-enabled GPU without changing user backend/device flags.
        try:
            prefs = bpy.context.preferences.addons['cycles'].preferences
            if prefs.compute_device_type != 'NONE' and any(d.use and d.type != 'CPU' for d in prefs.devices):
                self.bake_scene.cycles.device = 'GPU'
        except (KeyError, AttributeError, RuntimeError):
            pass
        self.bake_scene.cycles.samples = spec['bake']['samples']
        self.bake_scene.cycles.seed = spec['seed']
        self.bake_scene.render.threads_mode = 'AUTO'
        self.bake_scene.render.bake.use_selected_to_active = True
        self.bake_scene.render.bake.cage_extrusion = spec['bake']['cageExtrusionM']
        self.bake_scene.render.bake.max_ray_distance = spec['bake']['maxRayDistanceM']
        self.bake_scene.render.bake.margin = spec['bake']['marginPixels']
        self.bake_scene.render.bake.use_clear = True
        self.bake_scene.render.bake.normal_space = 'TANGENT'
        self.recipe_result = None

    def own(self, value):
        self.owned.append(value)
        return value

    def scene(self, name):
        scene = self.own(bpy.data.scenes.new(name))
        scene.unit_settings.system = 'METRIC'
        scene.unit_settings.scale_length = 1
        return scene

    def use(self, scene):
        bpy.context.window.scene = scene
        bpy.context.view_layer.update()

    def select(self, objects, active=None):
        for obj in bpy.context.scene.objects:
            obj.select_set(False)
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = active or (objects[-1] if objects else None)

    def mesh_object(self, name, vertices, faces, material, scene):
        mesh = self.own(bpy.data.meshes.new(name + ' editable mesh'))
        mesh.from_pydata(vertices, [], faces); mesh.update()
        obj = self.own(bpy.data.objects.new(name, mesh)); scene.collection.objects.link(obj)
        if material:
            mesh.materials.append(material)
        return obj

    def evaluated_copy(self, obj, scene, name=None):
        self.use(self.master if obj.name in self.master.objects else bpy.context.scene)
        depsgraph = bpy.context.evaluated_depsgraph_get(); depsgraph.update()
        evaluated = obj.evaluated_get(depsgraph)
        mesh = self.own(bpy.data.meshes.new_from_object(evaluated, depsgraph=depsgraph))
        mesh.transform(evaluated.matrix_world); mesh.update()
        result = self.own(bpy.data.objects.new(name or obj.name + ' browser', mesh))
        scene.collection.objects.link(result)
        return result


def _load_spec(spec_path):
    path = Path(spec_path).resolve()
    spec = json.loads(path.read_text(encoding='utf-8'))
    root = next((p for p in path.parents if (p / 'assets-source/realism-materials.json').is_file()), None)
    if root is None:
        raise ValueError('Spec must belong to a repository containing assets-source/realism-materials.json')
    recipe=spec.get('recipe','')
    if (spec.get('version') != 1 or not isinstance(recipe,str) or not recipe.replace('_','').isalnum()
            or not Path(__file__).with_name(recipe+'.py').is_file() or recipe in ('core','__init__')):
        raise ValueError('Unsupported pipeline specification version or recipe')
    dimensions=spec.get('dimensionsM',[])
    if len(dimensions)!=3 or any(not isinstance(v,(int,float)) or not math.isfinite(v) or not .05<=v<=20 for v in dimensions):
        raise ValueError('Three finite positive measured dimensions in metres are required')
    if spec['bake']['resolution'] not in (1024, 2048):
        raise ValueError('Bake resolution is bounded to 1024 or 2048')
    if not 1 <= spec['bake']['samples'] <= 64:
        raise ValueError('Bake samples must be between 1 and 64')
    if not isinstance(spec['seed'], int):
        raise ValueError('Deterministic integer seed required')
    for key,low,high in [('cageExtrusionM',.0001,.05),('maxRayDistanceM',.001,.1)]:
        value=spec['bake'][key]
        if not isinstance(value,(int,float)) or not math.isfinite(value) or not low<=value<=high:
            raise ValueError('Invalid bounded bake parameter: '+key)
    if not 1<=spec['bake']['marginPixels']<=64:raise ValueError('Invalid bake margin')
    if not 0 < spec['budgets']['maxTriangles'] <= 80000:
        raise ValueError('Browser mesh exceeds authorized maximum budget')
    for relative in [spec['sourceBlend'], *spec['outputs'].values()]:
        path_in(root, relative)
    source=path_in(root,spec['sourceBlend'])
    outputs=[path_in(root,r) for r in spec['outputs'].values()]
    if len(set(outputs))!=len(outputs) or source in outputs or path in outputs:
        raise ValueError('Input source/spec and all output paths must be distinct')
    if not 1<=spec['budgets']['maxPrimitives']<=8 or not 1<=spec['budgets']['maxGlbBytes']<=12*1024*1024:
        raise ValueError('Primitive/GLB budgets exceed authorized limits')
    for key in ('sourceBlend','glb','receipt'):
        output=path_in(root,spec['outputs'][key])
        allowed=('assets-source/experiments/','public/experiments/','assets-source/model-pipeline/')
        if not output.relative_to(root).as_posix().startswith(allowed):
            raise ValueError('Output must remain in experiment/pipeline directories: '+key)
    if not path_in(root, spec['sourceBlend']).is_file():
        raise FileNotFoundError(spec['sourceBlend'])
    recipe_module=_recipe(recipe)
    if hasattr(recipe_module,'validate_spec'):recipe_module.validate_spec(root,spec)
    return root, path, spec


def evaluated_stats(objects):
    bpy.context.view_layer.update(); graph = bpy.context.evaluated_depsgraph_get(); graph.update()
    lo, hi = Vector((math.inf,) * 3), Vector((-math.inf,) * 3)
    triangles = 0
    for obj in objects:
        evaluated = obj.evaluated_get(graph); mesh = evaluated.to_mesh()
        try:
            if not mesh:
                continue
            mesh.calc_loop_triangles(); triangles += len(mesh.loop_triangles)
            for vertex in mesh.vertices:
                point = evaluated.matrix_world @ vertex.co
                for a in range(3):
                    lo[a] = min(lo[a], point[a]); hi[a] = max(hi[a], point[a])
        finally:
            evaluated.to_mesh_clear()
    return {'triangles': triangles, 'parts': len(objects), 'boundsM': {'min': list(lo), 'max': list(hi)},
            'dimensionsM': list(hi-lo)}


def require_envelope(stats, dimensions, tolerance=.0001):
    expected_low = (-dimensions[0]/2, -dimensions[1]/2, 0)
    expected_high = (dimensions[0]/2, dimensions[1]/2, dimensions[2])
    error = max(abs(stats['boundsM'][side][a]-target[a]) for side, target in
                [('min', expected_low), ('max', expected_high)] for a in range(3))
    if error > tolerance:
        raise ValueError(f'Measured envelope differs by {error:.6f} m: {stats["boundsM"]}')


def _recipe(name):
    # Recipe registration is filename-based, not hardcoded into bake/export.
    path = Path(__file__).with_name(name + '.py')
    spec = importlib.util.spec_from_file_location('nook_detail_recipe_' + name, path)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module


def _bind_inputs(ctx,recipe):
    entries=[('spec',ctx.spec_path),('sourceBlend',path_in(ctx.root,ctx.spec['sourceBlend'])),
             ('builder',Path(__file__)),('builder',Path(__file__).with_name('__init__.py')),
             ('builder',Path(__file__).with_name(ctx.spec['recipe']+'.py'))]
    entries+=getattr(recipe,'input_paths',lambda root,spec:[])(ctx.root,ctx.spec)
    ctx.bound_inputs=[{**asset_receipt(ctx,path),'role':role} for role,path in entries]


def _assert_bound_inputs(ctx):
    if not hasattr(ctx,'bound_inputs'):
        raise ValueError('This session predates input binding; run a fresh prepare before baking/export')
    for record in ctx.bound_inputs:
        path=path_in(ctx.root,record['path'])
        if not path.is_file() or sha256(path)!=record['sha256']:
            raise ValueError('Pipeline input changed after prepare; rebuild before continuing: '+record['path'])


def _state_fingerprint(ctx):
    """Bind actual evaluated geometry, UVs, authoring state and source shaders.

    The target's transient image node is intentionally excluded; it changes for
    each bake. Everything affecting dense/low correspondence remains bound.
    """
    import numpy as np
    digest=hashlib.sha256();materials=set();images=set()
    def add(value):
        digest.update(json.dumps(value,sort_keys=True,separators=(',',':')).encode())
    def array(collection,attribute,width=1,dtype=np.float32):
        data=np.empty(len(collection)*width,dtype=dtype)
        collection.foreach_get(attribute,data);digest.update(data.tobytes())
    def simple(value):
        if isinstance(value,(bool,int,float,str)) or value is None:return value
        try:return [simple(v) for v in value]
        except TypeError:return getattr(value,'name',str(type(value)))
    previous=bpy.context.window.scene
    try:
        seen=set()
        for scene,objects in [(ctx.master,ctx.recipe_result['master_parts']),
                              (ctx.browser,ctx.recipe_result['browser_parts']),
                              (ctx.bake_scene,ctx.recipe_result['bake_sources'])]:
            ctx.use(scene);graph=bpy.context.evaluated_depsgraph_get();graph.update()
            for obj in objects:
                if obj.as_pointer() in seen:continue
                seen.add(obj.as_pointer());add([obj.name,list(v for row in obj.matrix_world for v in row)])
                evaluated=obj.evaluated_get(graph);mesh=evaluated.to_mesh()
                try:
                    array(mesh.vertices,'co',3);array(mesh.vertices,'normal',3)
                    array(mesh.loops,'vertex_index',dtype=np.int32)
                    array(mesh.polygons,'loop_start',dtype=np.int32);array(mesh.polygons,'loop_total',dtype=np.int32)
                    array(mesh.polygons,'material_index',dtype=np.int32)
                    for uv in mesh.uv_layers:
                        add([uv.name,uv.active_render]);array(uv.data,'uv',2)
                finally:evaluated.to_mesh_clear()
                for modifier in obj.modifiers:
                    values={}
                    for prop in modifier.bl_rna.properties:
                        if prop.identifier=='rna_type' or prop.is_readonly:continue
                        if prop.type in ('BOOLEAN','INT','FLOAT','STRING','ENUM'):
                            values[prop.identifier]=simple(getattr(modifier,prop.identifier))
                    add([modifier.type,values])
                keys=getattr(obj.data,'shape_keys',None)
                if keys:
                    for key in keys.key_blocks:
                        add([key.name,key.value,key.mute]);array(key.data,'co',3)
                add([(g.name,g.index) for g in obj.vertex_groups])
                if obj==ctx.recipe_result['bake_target']:
                    add([[(g.group,g.weight) for g in v.groups] for v in obj.data.vertices])
                else:
                    materials.update(m for m in obj.data.materials if m)
        for material in sorted(materials,key=lambda m:m.name):
            add([material.name,list(material.diffuse_color)])
            if not material.use_nodes:continue
            nodes=material.node_tree.nodes
            for node in sorted(nodes,key=lambda n:n.name):
                fields={key:simple(getattr(node,key)) for key in ('type','blend_type','data_type','operation','uv_map','space','extension','interpolation','mute','is_active_output') if hasattr(node,key)}
                fields['name']=node.name
                fields['inputs']=[(s.identifier,simple(s.default_value)) for s in node.inputs if hasattr(s,'default_value')]
                fields['outputs']=[(s.identifier,simple(s.default_value)) for s in node.outputs if hasattr(s,'default_value')]
                add(fields)
                if node.type=='TEX_IMAGE' and node.image:
                    images.add(node.image);add([node.image.name,node.image.colorspace_settings.name])
                if node.type=='GROUP' and node.node_tree:
                    add([(s.name,s.in_out,getattr(s,'default_value',None)) for s in node.node_tree.interface.items_tree if s.item_type=='SOCKET'])
            add(sorted((link.from_node.name,link.from_socket.identifier,link.to_node.name,link.to_socket.identifier) for link in material.node_tree.links))
        for image in sorted(images,key=lambda im:im.name):
            add([image.name,list(image.size),image.source,image.colorspace_settings.name])
            pixels=np.empty(len(image.pixels),dtype=np.float32);image.pixels.foreach_get(pixels);digest.update(pixels.tobytes())
        return digest.hexdigest()
    finally:bpy.context.window.scene=previous


def _assert_stage(ctx,allowed):
    if getattr(ctx,'status',None) not in allowed:
        raise ValueError(f'Pipeline session is {getattr(ctx,"status","legacy")}; use fresh prepare() for changes or another export')
    _assert_bound_inputs(ctx)
    if _state_fingerprint(ctx)!=ctx.bound_state:
        ctx.status='failed'
        raise ValueError('Live master/browser geometry, UV, modifier, shape-key or material state changed after prepare; save edited input and run fresh prepare()')


def prepare(spec_path):
    root, path, spec = _load_spec(spec_path)
    started = time.monotonic(); previous = bpy.context.window.scene
    ctx = Context(root, path, spec); SESSIONS[ctx.id] = ctx
    try:
        recipe=_recipe(spec['recipe']);_bind_inputs(ctx,recipe)
        ctx.use(ctx.master)
        ctx.recipe_result = recipe.build(ctx)
        result = ctx.recipe_result
        ctx.use(ctx.master); ctx.master_stats = evaluated_stats(result['master_parts'])
        require_envelope(ctx.master_stats, spec['dimensionsM'])
        ctx.use(ctx.browser); ctx.browser_stats = evaluated_stats(result['browser_parts'])
        require_envelope(ctx.browser_stats, spec['dimensionsM'])
        if ctx.browser_stats['triangles'] > spec['budgets']['maxTriangles']:
            raise ValueError('Browser triangle budget exceeded before baking')
        target = result['bake_target']
        # Cycles' selected-to-active source path is mesh-based. Keep editable
        # master thread curves, but use evaluated mesh copies for the bake.
        for pair in result['bake_groups']:
            pair['sources']=[ctx.evaluated_copy(o,ctx.bake_scene,'Bake source '+o.name) if o.type!='MESH' else o
                             for o in pair['sources']]
        result['bake_sources']=[o for pair in result['bake_groups'] for o in pair['sources']]
        for obj in [*result['bake_sources'], target]:
            if obj.name not in ctx.bake_scene.objects:
                ctx.bake_scene.collection.objects.link(obj)
        ctx.use(ctx.bake_scene)
        ctx.bake_material = ctx.own(bpy.data.materials.new('Pipeline transient bake target'))
        ctx.bake_material.use_nodes = True
        target.data.materials.clear(); target.data.materials.append(ctx.bake_material)
        ctx.image_node = ctx.bake_material.node_tree.nodes.new('ShaderNodeTexImage')
        ctx.bake_material.node_tree.nodes.active = ctx.image_node
        ctx.bound_state=_state_fingerprint(ctx)
        ctx.status='prepared'
        ctx.durations['prepareSeconds'] = round(time.monotonic()-started, 4)
        _assert_bound_inputs(ctx)
        return {'sessionId': ctx.id, 'masterScene': ctx.master.name, 'browserScene': ctx.browser.name,
                'bakeScene': ctx.bake_scene.name, 'masterTriangles': ctx.master_stats['triangles'],
                'browserTriangles': ctx.browser_stats['triangles'], 'masterParts': ctx.master_stats['parts'],
                'bakeSources': [o.name for o in result['bake_sources']], 'bakeTarget': target.name}
    except Exception as error:
        ctx.status='failed'
        ctx.failures.append({'stage': 'prepare', 'error': str(error)})
        raise RuntimeError(f'Pipeline prepare failed (session {ctx.id} retained for inspection): {error}') from error
    finally:
        bpy.context.window.scene = previous


def _session(session_id):
    if session_id not in SESSIONS:
        raise ValueError('Unknown live pipeline session. Call prepare() in this Blender process.')
    return SESSIONS[session_id]


def _neutralize_tints(ctx):
    restore = []
    for material, strength in ctx.recipe_result.get('neutral_bake_materials', []):
        bs = next(n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        link = next(iter(bs.inputs['Base Color'].links), None)
        socket = bs.inputs['Base Color']
        if link and link.from_node.type == 'MIX':
            socket = next(s for s in link.from_node.inputs if s.identifier == 'B_Color')
        elif link:
            raise ValueError('Base-color tint neutralization needs a supported explicit multiply node')
        restore.append((socket, tuple(socket.default_value)))
        socket.default_value = (strength, strength, strength, 1)
    return restore


def _explode_bake_pairs(ctx):
    """Translate matching dense/low pairs apart, retaining the shared UV atlas.

    Unlike a whole-assembly bake, rays cannot hit a neighboring cushion at a
    contact seam. Translation does not change tangent-space orientation.
    """
    target=ctx.recipe_result['bake_target'];mesh=target.data
    vertices=[v.co.copy() for v in mesh.vertices];objects=[]
    pairs=ctx.recipe_result.get('bake_groups',[])
    if not pairs:raise ValueError('Recipe must define isolated high/low bake pairs')
    offsets={}
    for index,pair in enumerate(pairs):
        offset=Vector((index*5.0,0,0));group=target.vertex_groups.get(pair['vertexGroup'])
        if group is None:raise ValueError('Missing low-poly bake-pair vertex group')
        if any(obj.parent is not None for obj in pair['sources']):
            raise ValueError('Bake sources must be unparented before paired isolation')
        offsets[group.index]=offset
    vertex_offsets=[]
    for vertex in mesh.vertices:
        membership=[g for g in vertex.groups if g.group in offsets and g.weight>.5]
        if len(membership)!=1:raise ValueError('Each low-poly vertex must belong to exactly one bake pair')
        vertex_offsets.append(offsets[membership[0].group])
    for index,pair in enumerate(pairs):
        offset=Vector((index*5.0,0,0))
        for obj in pair['sources']:
            # Translation-only restoration leaves authored rotation/scale bit
            # exact, avoiding matrix-decomposition drift in state fingerprints.
            objects.append((obj,obj.location.copy()))
            obj.location+=offset
    for vertex,offset in zip(mesh.vertices,vertex_offsets):
        vertex.co+=offset
    mesh.update();bpy.context.view_layer.update()
    return objects,vertices


def _restore_bake_pairs(ctx,backup):
    if backup is None:return
    objects,vertices=backup
    for obj,location in objects:obj.location=location
    mesh=ctx.recipe_result['bake_target'].data
    for vertex,co in zip(mesh.vertices,vertices):vertex.co=co
    mesh.update();bpy.context.view_layer.update()


def bake(session_id, pass_name='normal'):
    ctx = _session(session_id)
    _assert_stage(ctx,('prepared',))
    if pass_name not in BAKE_PASSES:
        raise ValueError('Bake pass must be one of: ' + ', '.join(BAKE_PASSES))
    if pass_name in ctx.maps:
        raise ValueError('This pass already completed; use fresh prepare() to rebake changed inputs')
    started = time.monotonic(); previous = bpy.context.window.scene; restore = []; pair_backup=None
    try:
        ctx.use(ctx.bake_scene)
        resolution = ctx.spec['bake']['resolution']
        image = ctx.own(bpy.data.images.new('Sofa baked ' + pass_name, width=resolution, height=resolution, alpha=False))
        image.colorspace_settings.name = 'sRGB' if pass_name == 'baseColor' else 'Non-Color'
        image.generated_color = (.5,.5,1,1) if pass_name == 'normal' else (1,1,1,1)
        ctx.image_node.image = image; ctx.bake_material.node_tree.nodes.active = ctx.image_node
        target = ctx.recipe_result['bake_target']
        target.data.uv_layers.active = target.data.uv_layers['BakeAtlas']
        ctx.select([*ctx.recipe_result['bake_sources'], target], target)
        pair_backup=_explode_bake_pairs(ctx)
        if pass_name == 'baseColor':
            restore = _neutralize_tints(ctx)
        bake_type = {'normal':'NORMAL','baseColor':'DIFFUSE','roughness':'ROUGHNESS','ao':'AO'}[pass_name]
        ctx.bake_scene.render.bake.use_pass_direct = False
        ctx.bake_scene.render.bake.use_pass_indirect = False
        ctx.bake_scene.render.bake.use_pass_color = True
        try:
            status = bpy.ops.object.bake(type=bake_type)
        except RuntimeError:
            if ctx.bake_scene.cycles.device != 'GPU':
                raise
            ctx.bake_scene.cycles.device = 'CPU'
            status = bpy.ops.object.bake(type=bake_type)
        if 'FINISHED' not in status:
            raise RuntimeError('Blender bake did not report FINISHED: ' + str(status))
        directory = path_in(ctx.root, ctx.spec['outputs']['bakeDirectory']); directory.mkdir(parents=True, exist_ok=True)
        path = directory / (pass_name + '.png')
        image.filepath_raw = str(path); image.file_format = 'PNG'; image.save()
        # Reopen exact saved bytes as FILE images. This lets glTF reuse the
        # packed PNG instead of silently re-encoding a GENERATED image.
        packed = ctx.own(bpy.data.images.load(str(path), check_existing=False))
        packed.colorspace_settings.name = image.colorspace_settings.name; packed.pack()
        receipt = {**asset_receipt(ctx, path), 'kind': pass_name, 'materialKey': ctx.recipe_result['bake_material_key'],
                   'resolution': [resolution, resolution], 'method': 'Cycles selected-to-active',
                   'normalSpace': 'TANGENT' if pass_name == 'normal' else None,
                   'sourceObjects': len(ctx.recipe_result['bake_sources']),
                   'pairIsolation':'matching high/low pairs translated 5 m apart; restored after bake',
                   'seconds': round(time.monotonic()-started, 4)}
        ctx.maps[pass_name] = {'image': packed, 'receipt': receipt}
        ctx.durations[pass_name+'BakeSeconds'] = receipt['seconds']
        if all(p in ctx.maps for p in BAKE_PASSES):ctx.status='baked'
        return receipt
    except Exception as error:
        ctx.status='failed';ctx.maps.clear()
        ctx.failures.append({'stage':'bake-'+pass_name,'error':str(error)})
        raise RuntimeError(f'{pass_name} bake failed; session {session_id} retained: {error}') from error
    finally:
        for socket, value in restore:
            socket.default_value = value
        _restore_bake_pairs(ctx,pair_backup)
        bpy.context.window.scene = previous


def _pack_orm(ctx):
    import numpy as np
    resolution = ctx.spec['bake']['resolution']; count = resolution * resolution * 4
    ao = np.empty(count, dtype=np.float32); rough = np.empty(count, dtype=np.float32)
    ctx.maps['ao']['image'].pixels.foreach_get(ao); ctx.maps['roughness']['image'].pixels.foreach_get(rough)
    pixels = np.zeros((resolution*resolution,4), dtype=np.float32)
    pixels[:,0] = ao.reshape((-1,4))[:,0]; pixels[:,1] = rough.reshape((-1,4))[:,0]
    pixels[:,3] = 1
    image = ctx.own(bpy.data.images.new('Baked occlusion roughness metal', resolution, resolution, alpha=False))
    image.colorspace_settings.name = 'Non-Color'; image.pixels.foreach_set(pixels.ravel())
    path = path_in(ctx.root, ctx.spec['outputs']['bakeDirectory']) / 'orm.png'
    image.filepath_raw = str(path); image.file_format = 'PNG'; image.save()
    packed = ctx.own(bpy.data.images.load(str(path), check_existing=False))
    packed.colorspace_settings.name = 'Non-Color'; packed.pack()
    receipt = {**asset_receipt(ctx,path),'kind':'orm','materialKey':ctx.recipe_result['bake_material_key'],
               'resolution':[resolution,resolution], 'channels':{'r':'baked ao','g':'baked roughness','b':'metallic zero'}}
    ctx.maps['orm'] = {'image':packed,'receipt':receipt}


def connect_orm(material, image, uv_node=None, ctx=None):
    nodes, links = material.node_tree.nodes, material.node_tree.links
    bs = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    node = nodes.new('ShaderNodeTexImage'); node.image = image
    if uv_node:
        links.new(uv_node.outputs['UV'], node.inputs['Vector'])
    separate = nodes.new('ShaderNodeSeparateColor'); links.new(node.outputs['Color'],separate.inputs[0])
    links.new(separate.outputs['Green'],bs.inputs['Roughness']); links.new(separate.outputs['Blue'],bs.inputs['Metallic'])
    from io_scene_gltf2.blender.com.material_helpers import create_settings_group
    group = create_settings_group('glTF Material Output')
    if ctx:
        ctx.own(group)
    group_node = nodes.new('ShaderNodeGroup'); group_node.node_tree = group
    links.new(separate.outputs['Red'], group_node.inputs['Occlusion'])


def _baked_material(ctx):
    key = ctx.recipe_result['bake_material_key']; material = ctx.own(bpy.data.materials.new(key))
    material['material_key'] = key; material.use_nodes = True
    nodes, links = material.node_tree.nodes, material.node_tree.links
    bs = nodes.get('Principled BSDF'); bs.inputs['Sheen Weight'].default_value = 0
    uv = nodes.new('ShaderNodeUVMap'); uv.uv_map = 'BakeAtlas'
    base = nodes.new('ShaderNodeTexImage'); base.image = ctx.maps['baseColor']['image']
    links.new(uv.outputs['UV'],base.inputs['Vector'])
    mix = nodes.new('ShaderNodeMix'); mix.data_type='RGBA'; mix.blend_type='MULTIPLY'
    next(s for s in mix.inputs if s.identifier=='Factor_Float').default_value=1
    next(s for s in mix.inputs if s.identifier=='B_Color').default_value=ctx.recipe_result['fabric_tint']
    links.new(base.outputs['Color'],next(s for s in mix.inputs if s.identifier=='A_Color'))
    links.new(next(s for s in mix.outputs if s.identifier=='Result_Color'),bs.inputs['Base Color'])
    normal = nodes.new('ShaderNodeTexImage'); normal.image=ctx.maps['normal']['image']
    links.new(uv.outputs['UV'],normal.inputs['Vector'])
    nm = nodes.new('ShaderNodeNormalMap'); nm.uv_map='BakeAtlas'; nm.inputs['Strength'].default_value=1
    links.new(normal.outputs['Color'],nm.inputs['Color']); links.new(nm.outputs['Normal'],bs.inputs['Normal'])
    connect_orm(material,ctx.maps['orm']['image'],uv,ctx)
    material.diffuse_color=ctx.recipe_result['fabric_tint']
    return material


def _sanitize_glb(path):
    raw=path.read_bytes(); length=struct.unpack_from('<I',raw,12)[0]
    doc=json.loads(raw[20:20+length])
    for material in doc.get('materials',[]):
        extras=material.get('extras',{})
        material['name']=extras.get('material_key',extras.get('sofa_material_key',material['name']))
    allowed={'material_key','sofa_material_key','catalog_id','realism_family','texture_source','texture_license'}
    def strip(value):
        if isinstance(value,dict):
            if 'extras' in value:
                extras=value['extras']; value['extras']={k:v for k,v in extras.items() if k in allowed} if isinstance(extras,dict) else {}
                if not value['extras']: del value['extras']
            for item in value.values():strip(item)
        elif isinstance(value,list):
            for item in value:strip(item)
    strip(doc)
    encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*(-len(encoded)%4)
    remaining=raw[20+length:]
    path.write_bytes(struct.pack('<III',0x46546c67,2,20+len(encoded)+len(remaining))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+remaining)
    return doc


def _glb_bounds(path):
    raw=path.read_bytes();n=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+n]);binary=28+n
    lo,hi=Vector((math.inf,)*3),Vector((-math.inf,)*3)
    def visit(index,parent):
        node=doc['nodes'][index]
        if 'matrix' in node:
            a=node['matrix'];local=Matrix([[a[c*4+r] for c in range(4)] for r in range(4)])
        else:
            q=node.get('rotation',[0,0,0,1]);local=Matrix.Translation(Vector(node.get('translation',[0,0,0])))
            local=local@Quaternion((q[3],*q[:3])).to_matrix().to_4x4()@Matrix.Diagonal((*node.get('scale',[1,1,1]),1))
        world=parent@local
        if 'mesh' in node:
            for primitive in doc['meshes'][node['mesh']]['primitives']:
                accessor=doc['accessors'][primitive['attributes']['POSITION']];view=doc['bufferViews'][accessor['bufferView']]
                if accessor['componentType']!=5126:raise ValueError('Unexpected GLB position type')
                offset=binary+view.get('byteOffset',0)+accessor.get('byteOffset',0);stride=view.get('byteStride',12)
                for i in range(accessor['count']):
                    p=world@Vector(struct.unpack_from('<3f',raw,offset+i*stride));p=Vector((p.x,-p.z,p.y))
                    for a in range(3):lo[a]=min(lo[a],p[a]);hi[a]=max(hi[a],p[a])
        for child in node.get('children',[]):visit(child,world)
    for node in doc['scenes'][doc.get('scene',0)].get('nodes',[]):visit(node,Matrix.Identity(4))
    return {'boundsM':{'min':list(lo),'max':list(hi)},'dimensionsM':list(hi-lo)}


def _triangulated_export_mesh(ctx, source):
    """Use Blender's exact loop triangles, UVs and corner normals for export.

    The bake used this same tessellation. Reconstructing its triangles avoids
    exporter tangent failures on n-gon construction caps without selecting a
    different quad diagonal or discarding authored weighted normals.
    """
    source.calc_loop_triangles()
    triangles=[(tuple(t.vertices),tuple(t.loops),source.polygons[t.polygon_index].material_index,
                source.polygons[t.polygon_index].use_smooth) for t in source.loop_triangles]
    mesh=ctx.own(bpy.data.meshes.new(source.name+' exact export triangles'))
    mesh.from_pydata([tuple(v.co) for v in source.vertices],[],[t[0] for t in triangles]);mesh.update()
    for material in source.materials:mesh.materials.append(material)
    for polygon,triangle in zip(mesh.polygons,triangles):
        polygon.material_index=triangle[2];polygon.use_smooth=triangle[3]
    for original in source.uv_layers:
        layer=mesh.uv_layers.new(name=original.name)
        for polygon,triangle in zip(mesh.polygons,triangles):
            for new_loop,old_loop in zip(polygon.loop_indices,triangle[1]):
                layer.data[new_loop].uv=original.data[old_loop].uv
        layer.active_render=original.active_render
    if source.uv_layers.active:
        mesh.uv_layers.active=mesh.uv_layers[source.uv_layers.active.name]
    normals=[tuple(source.corner_normals[loop].vector) for triangle in triangles for loop in triangle[1]]
    mesh.normals_split_custom_set(normals);mesh.update()
    return mesh


def repair_owned_gltf_groups(session_id):
    """Upgrade only this session's exact owned settings-group references.

    Blender's importer may reuse the globally named group and expects its full
    official interface, even when only Occlusion is connected. This migration
    preserves links and saved bake results and never scans tags for ownership.
    """
    ctx=_session(session_id)
    from io_scene_gltf2.blender.com.material_helpers import create_settings_group
    template=create_settings_group('Pipeline temporary official settings interface')
    repaired=[]
    try:
        sockets=[s for s in template.interface.items_tree if s.item_type=='SOCKET' and s.in_out=='INPUT']
        for group in ctx.owned:
            if not _live(group) or not isinstance(group,bpy.types.ShaderNodeTree) or not group.name.startswith('glTF Material Output'):
                continue
            existing={s.name for s in group.interface.items_tree if s.item_type=='SOCKET' and s.in_out=='INPUT'}
            added=[]
            for socket in sockets:
                if socket.name not in existing:
                    created=group.interface.new_socket(name=socket.name,in_out='INPUT',socket_type=socket.socket_type)
                    if hasattr(socket,'default_value'):created.default_value=socket.default_value
                    added.append(socket.name)
            if not any(n.type=='GROUP_INPUT' for n in group.nodes):group.nodes.new('NodeGroupInput')
            if not any(n.type=='GROUP_OUTPUT' for n in group.nodes):group.nodes.new('NodeGroupOutput')
            if added:repaired.append({'group':group.name,'added':added})
        return repaired
    finally:
        bpy.data.node_groups.remove(template)


def finish(session_id):
    ctx=_session(session_id);_assert_stage(ctx,('baked',));missing=[p for p in BAKE_PASSES if p not in ctx.maps]
    if missing:raise ValueError('Actual completed bake passes required: '+', '.join(missing))
    for item in ctx.maps.values():
        if sha256(path_in(ctx.root,item['receipt']['path']))!=item['receipt']['sha256']:
            ctx.status='failed'
            raise ValueError('Completed bake file changed on disk; run fresh prepare()')
    started=time.monotonic();previous=bpy.context.window.scene;copies=[];joined_objects=[]
    try:
        repair_owned_gltf_groups(session_id)
        _pack_orm(ctx);mat=_baked_material(ctx)
        target=ctx.recipe_result['bake_target'];target.data.materials.clear();target.data.materials.append(mat)
        ctx.use(ctx.browser)
        ctx.browser_stats=evaluated_stats(ctx.recipe_result['browser_parts'])
        require_envelope(ctx.browser_stats,ctx.spec['dimensionsM'])
        source=path_in(ctx.root,ctx.spec['outputs']['sourceBlend']);source.parent.mkdir(parents=True,exist_ok=True)
        # Two self-contained editable scenes: dense master and final browser
        # mesh with baked maps. Bake stage is process-local and excluded.
        bpy.data.libraries.write(str(source),{ctx.master,ctx.browser},fake_user=True,compress=True)
        for obj in ctx.recipe_result['browser_parts']:
            mesh=_triangulated_export_mesh(ctx,obj.data);copy=ctx.own(bpy.data.objects.new('Export '+obj.name,mesh))
            ctx.browser.collection.objects.link(copy);copy.matrix_world=obj.matrix_world.copy();copies.append(copy)
        # Blender's exporter calculates one tangent basis per mesh, using its
        # active render UV. A single mesh mixing tiled wood UV0 and cloth atlas
        # UV1 would therefore export the wrong cloth tangent frame. Join only
        # within a material/normal-UV group, retaining four meshes/primitives.
        groups={}
        for obj in copies:
            keys={m.get('material_key',m.get('sofa_material_key',m.name)) for m in obj.data.materials}
            if len(keys)!=1:raise ValueError('Each browser part must have one canonical material for tangent-safe grouping')
            key=next(iter(keys));groups.setdefault(key,[]).append(obj)
        for key,objects in groups.items():
            ctx.select(objects,objects[0]);bpy.context.view_layer.update()
            if len(objects)>1:bpy.ops.object.join()
            joined=bpy.context.view_layer.objects.active
            basis='BakeAtlas' if key==ctx.recipe_result['bake_material_key'] else 'UVMap'
            if joined.data.uv_layers:
                if basis not in joined.data.uv_layers:raise ValueError('Missing intended normal UV basis for '+key)
                joined.data.uv_layers.active=joined.data.uv_layers[basis]
                joined.data.uv_layers[basis].active_render=True
                joined.data.calc_tangents(uvmap=basis)
            joined.name=ctx.spec.get('variantId',ctx.spec['recipe']+'-pipeline')+' '+key
            joined['catalog_id']=ctx.spec.get('catalogId',ctx.spec['recipe'])
            joined_objects.append(joined)
        ctx.select(joined_objects,joined_objects[0]);bpy.context.view_layer.update()
        path=path_in(ctx.root,ctx.spec['outputs']['glb']);path.parent.mkdir(parents=True,exist_ok=True)
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,use_active_scene=True,
                                  export_extras=True,export_apply=True,export_cameras=False,export_lights=False,
                                  export_texcoords=True,export_normals=True,export_tangents=True,export_image_format='AUTO')
        doc=_sanitize_glb(path);stats=_glb_bounds(path);require_envelope(stats,ctx.spec['dimensionsM'])
        material_keys=sorted(m['name'] for m in doc['materials'])
        if material_keys!=sorted(ctx.spec['materialKeys']):raise ValueError('Export material keys changed: '+str(material_keys))
        primitives=sum(len(m['primitives']) for m in doc['meshes'])
        if primitives>ctx.spec['budgets']['maxPrimitives']:raise ValueError('Export primitive budget exceeded')
        if path.stat().st_size>ctx.spec['budgets']['maxGlbBytes']:raise ValueError('GLB byte budget exceeded')
        maps=[v['receipt'] for v in ctx.maps.values()]+ctx.recipe_result.get('retained_map_receipts',[])
        ctx.durations['finishSeconds']=round(time.monotonic()-started,4)
        bound_by_role={record['role']:record for record in ctx.bound_inputs}
        receipt={'version':1,'recipe':ctx.spec['recipe'],'seed':ctx.spec['seed'],
                 'spec':{k:v for k,v in bound_by_role['spec'].items() if k!='role'},
                 'sourceBlend':{k:v for k,v in bound_by_role['sourceBlend'].items() if k!='role'},
                 'outputBlend':asset_receipt(ctx,source),'glb':asset_receipt(ctx,path),'maps':maps,'renders':[],
                 'master':ctx.master_stats,'browser':ctx.browser_stats,'dimensionsM':stats['dimensionsM'],'boundsM':stats['boundsM'],
                 'materialKeys':material_keys,'primitiveCount':primitives,'stageDurations':ctx.durations,
                 'bake':{'resolution':ctx.spec['bake']['resolution'],'passes':list(BAKE_PASSES),'device':ctx.bake_scene.cycles.device,
                         'normalMethod':'Cycles selected-to-active tangent-space from dense master'},
                 'masterScene':ctx.master.name,'browserScene':ctx.browser.name,'failures':ctx.failures}
        receipt['authoringStateSha256']=ctx.bound_state
        receipt['inputs']=[dict(record) for record in ctx.bound_inputs if record['role'] in ('builder','material')]
        _assert_bound_inputs(ctx)
        output=path_in(ctx.root,ctx.spec['outputs']['receipt']);output.parent.mkdir(parents=True,exist_ok=True)
        output.write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8',newline='\n')
        ctx.receipt=receipt
        ctx.status='finalized'
        return receipt
    except Exception:
        ctx.status='failed';ctx.maps.clear()
        raise
    finally:
        for obj in copies+joined_objects:
            if _live(obj):bpy.data.objects.remove(obj,do_unlink=True)
        bpy.context.window.scene=previous


def run(spec_path):
    session=prepare(spec_path)
    for name in BAKE_PASSES:bake(session['sessionId'],name)
    return finish(session['sessionId'])


def cleanup(session_id):
    """Explicitly dispose only this live session's unshared created resources.

    Never called automatically on import/build, and never discovers ownership
    from names or serialized tags. Shared/user-linked resources are preserved.
    """
    ctx=_session(session_id);scenes=[s for s in (ctx.master,ctx.browser,ctx.bake_scene) if _live(s)]
    if bpy.context.window.scene in scenes:
        alternative=next((s for s in bpy.data.scenes if s not in scenes),None)
        if alternative is None:alternative=bpy.data.scenes.new('Preserved workspace')
        bpy.context.window.scene=alternative
    for obj in [d for d in ctx.owned if _live(d) and isinstance(d,bpy.types.Object)]:
        if all(s in scenes for s in obj.users_scene):bpy.data.objects.remove(obj,do_unlink=True)
    for scene in scenes:
        if _live(scene) and not scene.objects:bpy.data.scenes.remove(scene)
    groups=('meshes','curves','materials','images','node_groups','collections','worlds','lights','cameras')
    for _ in range(3):
        for d in ctx.owned:
            if not _live(d) or d.users:continue
            for kind in groups:
                data=getattr(bpy.data,kind)
                if data.get(d.name)==d:data.remove(d);break
    del SESSIONS[session_id]
