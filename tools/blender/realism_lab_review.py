"""Repeatable review of exported experimental GLBs via the official Blender MCP.

This deliberately reimports browser exports rather than rendering source-only
procedural shaders. Cleanup uses process-local datablock identities, never tags
restored by an import or a loaded file. Global render preferences are preserved.
"""
import bpy, json, time
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OWNER = 'Nook realism lab exported review'
FILES = ROOT / 'public/experiments/realism-lab'
OUT = ROOT / 'assets-source/experiments/realism-lab/renders'
_RUNTIME = bpy.app.driver_namespace.setdefault('nook.realism.review.runtime', {})
_RESOURCE_TYPES = ('meshes', 'curves', 'materials', 'images', 'lights', 'cameras', 'worlds', 'collections')


def _live(data):
    try:
        return data is not None and data.as_pointer() != 0
    except ReferenceError:
        return False


def _snapshot():
    return {kind: {data.as_pointer() for data in getattr(bpy.data, kind)} for kind in _RESOURCE_TYPES}


def _remember_resources(before):
    resources = _RUNTIME.setdefault('resources', [])
    for kind in _RESOURCE_TYPES:
        resources.extend((kind, data) for data in getattr(bpy.data, kind)
                         if data.as_pointer() not in before[kind])


def _fresh_scene():
    previous = _RUNTIME.get('scene')
    objects = [o for o in _RUNTIME.get('objects', []) if _live(o)]
    # A user-added object or a link into another scene makes the old scene
    # ineligible for destructive cleanup. Preserve it and start a fresh review.
    safe = (_live(previous) and set(previous.objects) == set(objects)
            and all(len(o.users_scene) == 1 for o in objects))
    scene = bpy.data.scenes.new('Realism lab exported review')
    bpy.context.window.scene = scene
    if safe:
        for obj in objects:
            bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.scenes.remove(previous)
    # Only orphan resources created by this helper are eligible. Multiple passes
    # release meshes -> materials -> images without touching unrelated orphans.
    leftovers = list(_RUNTIME.get('resources', []))
    for _ in range(3):
        for kind, data in leftovers:
            if _live(data) and data.users == 0:
                getattr(bpy.data, kind).remove(data)
    _RUNTIME.update(scene=scene, objects=[], resources=[pair for pair in leftovers if _live(pair[1])], clay=None)
    scene['lab_review_owner'] = OWNER  # descriptive only; never read for cleanup
    return scene

def setup(stem, glb_path=None, output_dir=None):
    if glb_path is None and stem not in ('sofa-current','sofa-material','sofa-refined','sofa-pipeline','table-current','table-material','table-refined'):
        raise ValueError(stem)
    scene = _fresh_scene()
    resources_before = _snapshot()
    try:
        bpy.ops.import_scene.gltf(filepath=str(glb_path or FILES / (stem + '.glb')))
    except Exception:
        # A failed importer can leave temporary objects behind in this new
        # owned scene. Track their exact identities for the next safe cleanup.
        _RUNTIME['objects'] = list(scene.objects)
        _remember_resources(resources_before)
        raise
    # Importer restores authored scene extras, including authoring_owner.
    # Keep review ownership in a distinct field so exported extras cannot replace it.
    scene['lab_review_owner'] = OWNER
    parts = [o for o in scene.objects if o.type == 'MESH']
    # The catalog applies its chosen upholstery color after loading. Match that
    # same moss default on both comparisons rather than comparing a raw white
    # export against a tinted source render.
    if stem.startswith('sofa-'):
        srgb = [int('405e42'[i:i+2],16)/255 for i in (0,2,4)]
        tint = [c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4 for c in srgb]
        for material in {m for o in parts for m in o.data.materials if m}:
            name = material.name.split('.')[0]
            if name not in ('upholstery-textured','tailored-tone-on-tone-stitch'): continue
            factor = .72 if name=='tailored-tone-on-tone-stitch' else 1
            bs = next(n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
            color = tuple(c*factor for c in tint)+(1,)
            # Importer's graph uses a texture-multiply node when a factor exists.
            link = next(iter(bs.inputs['Base Color'].links),None)
            if link and link.from_node.type=='MIX':
                node = link.from_node
                constant = next((s for s in node.inputs if s.identifier=='B_Color'),None)
                if constant is not None: constant.default_value=color
            elif link and link.from_node.type=='TEX_IMAGE':
                mix=material.node_tree.nodes.new('ShaderNodeMix');mix.data_type='RGBA';mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1
                a=next(s for s in mix.inputs if s.identifier=='A_Color');b=next(s for s in mix.inputs if s.identifier=='B_Color');b.default_value=color
                material.node_tree.links.new(link.from_socket,a)
                material.node_tree.links.new(next(s for s in mix.outputs if s.identifier=='Result_Color'),bs.inputs['Base Color'])
            else: bs.inputs['Base Color'].default_value=color
    bpy.context.view_layer.update()
    points = [o.matrix_world @ v.co for o in parts for v in o.data.vertices]
    low = Vector([min(p[a] for p in points) for a in range(3)])
    high = Vector([max(p[a] for p in points) for a in range(3)])
    scene['lab_stem'] = stem
    scene['lab_output_dir'] = str(output_dir or OUT)
    scene['lab_dimensions'] = list(high - low)
    scene['lab_original_materials'] = json.dumps({o.name:[m.name if m else None for m in o.data.materials] for o in parts})
    size = max(high-low)
    world = bpy.data.worlds.new('Lab neutral world')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (.25,.25,.25,1)
    world.node_tree.nodes['Background'].inputs[1].default_value = .45
    scene.world = world
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    # Respect the user's existing backend and device flags. If no already
    # enabled GPU is available, this review scene alone uses CPU rendering.
    scene.cycles.device = 'CPU'
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        if prefs.compute_device_type != 'NONE' and any(d.use and d.type != 'CPU' for d in prefs.devices):
            scene.cycles.device = 'GPU'
    except (KeyError, AttributeError, RuntimeError):
        pass
    scene.render.resolution_x = 900
    scene.render.resolution_y = 700
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.exposure = 0
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.render.film_transparent = False
    material = bpy.data.materials.new('Lab neutral ground')
    material.use_nodes = True
    material.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.19,.20,.20,1)
    material.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .9
    bpy.ops.mesh.primitive_plane_add(size=size*200, location=(0,0,-.002))
    ground = bpy.context.object
    ground.name = 'Lab review ground'
    ground.data.materials.append(material)
    for name,position,power,area in [('Key',(-2,-3,4),500,3),('Fill',(3,-1,2),220,3),('Rim',(0,3,3),400,2)]:
        light = bpy.data.lights.new('Lab '+name, 'AREA')
        light.energy = power
        light.shape = 'DISK'
        light.size = area
        obj = bpy.data.objects.new(light.name, light)
        scene.collection.objects.link(obj)
        obj.location = position
        obj.rotation_euler = (Vector((0,0,(high-low).z/2))-obj.location).to_track_quat('-Z','Y').to_euler()
    data = bpy.data.cameras.new('Lab review camera')
    camera = bpy.data.objects.new(data.name, data)
    scene.collection.objects.link(camera)
    data.type = 'ORTHO'
    data.clip_start = .001
    data.clip_end = 1000
    scene.camera = camera
    _RUNTIME['objects'] = list(scene.objects)
    _remember_resources(resources_before)
    return {'stem':stem,'boundsM':{'low':list(low),'high':list(high)},'parts':len(parts),'device':scene.cycles.device}

def render(view='front'):
    scene = _RUNTIME.get('scene')
    if not _live(scene):
        raise RuntimeError('Call setup() in this Blender process before rendering')
    bpy.context.window.scene = scene
    w,d,h = scene['lab_dimensions']
    size = max(w,d,h)
    if view not in ('front','rear','detail','clay','underside'):
        raise ValueError(view)
    target = Vector((0,0,h*.47))
    direction = Vector((1.3,-1.8,1.05) if view!='rear' else (-1.5,1.8,1.15))
    scene.camera.data.ortho_scale = size*1.35
    if view == 'detail':
        target = Vector((w*.18,-d*.16,h*.53))
        direction = Vector((1.2,-1.8,1.2))
        scene.camera.data.ortho_scale = size*.76
    if view == 'underside':
        target = Vector((0, 0, h*.27))
        direction = Vector((.8, -1.2, -1.0))
    ground = scene.objects.get('Lab review ground')
    # Blender may suffix names when another reviewed scene was preserved.
    if ground is None:
        ground = next((o for o in scene.objects if o.name.startswith('Lab review ground')), None)
    if ground is not None:
        ground.hide_render = view == 'underside'
    scene.camera.location = target + direction*size*2
    scene.camera.rotation_euler = (target-scene.camera.location).to_track_quat('-Z','Y').to_euler()
    originals = json.loads(scene['lab_original_materials'])
    clay = _RUNTIME.get('clay')
    if view == 'clay' and not _live(clay):
        clay = bpy.data.materials.new('Lab neutral clay')
        clay.use_nodes = True
        clay.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.38,.38,.38,1)
        clay.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .8
        _RUNTIME['clay'] = clay
        _RUNTIME['resources'].append(('materials', clay))
    for name,materials in originals.items():
        obj = bpy.data.objects[name]
        for i,material_name in enumerate(materials):
            obj.data.materials[i] = clay if view=='clay' else bpy.data.materials.get(material_name)
    output_dir = Path(scene['lab_output_dir'])
    output_dir.mkdir(parents=True,exist_ok=True)
    path = output_dir / (scene['lab_stem']+'-'+view+'.png')
    scene.render.filepath = str(path)
    bpy.context.view_layer.update()
    started = time.monotonic()
    try:
        bpy.ops.render.render(write_still=True)
    except RuntimeError:
        if scene.cycles.device != 'GPU':
            raise
        scene.cycles.device = 'CPU'
        bpy.ops.render.render(write_still=True)
    return {'path':str(path),'view':view,'seconds':round(time.monotonic()-started,2),'resolution':[900,700]}
