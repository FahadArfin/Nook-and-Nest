"""Render five evidence views of actual candidate GLBs, without granting approval.

Only render_model imports Blender. Framing helpers remain pure Python so their
offset-origin, thin-object and aspect-ratio behavior can be tested independently.
The synchronous render owns one temporary scene and never changes global render
preferences or any preexisting datablock. Receipt updates are hash-bound and
atomic; a failed or interrupted render cannot become reviewed work.
"""
from contextlib import contextmanager
import copy
import hashlib
import itertools
import json
import math
from pathlib import Path
import re
import runpy
import struct
import time
import uuid

VIEWS = ('front', 'rear', 'detail', 'underside', 'clay')
DIRECTIONS = {'front': (1.2, -2, 1.1), 'rear': (-1.2, 2, 1.1),
              'detail': (1.2, -2, 1.1), 'underside': (1.2, -2, -1.2),
              'clay': (1.2, -2, 1.1)}
# Same identity-based ownership categories as source.py; no imported extras are
# used as authority to delete a user's objects or data.
DATA_KINDS = ('scenes', 'objects', 'collections', 'meshes', 'curves', 'metaballs',
              'armatures', 'materials', 'images', 'textures', 'node_groups',
              'cameras', 'lights', 'worlds', 'actions')
COLOR_INPUTS = ('src/furnitureDefaultVariants.json', 'src/furnitureVariants.json',
                'src/sofaRealismIds.json', 'src/personalSurfaceSlots.json',
                'src/modernCollection.ts', 'src/scene/FurnitureModelLibrary.ts',
                'src/catalogRealism.ts', 'src/catalogRealismBeds.json')


def _require(condition, message):
    if not condition:
        raise ValueError(message)


def config_hash(value):
    encoded = json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False).encode('utf8')
    return hashlib.sha256(encoded).hexdigest()


def _configuration_semantics(value):
    """JSON numbers use the same finite IEEE-754 semantics as receipt readers."""
    if value is None or isinstance(value, (str, bool)):
        return (type(value).__name__, value)
    if isinstance(value, (int, float)):
        try:
            number = float(value)
        except (ValueError, OverflowError):
            raise ValueError('Render configuration contains an invalid number') from None
        _require(math.isfinite(number), 'Render configuration contains a nonfinite number')
        return ('number', number)
    if isinstance(value, (list, tuple)):
        return ('array', tuple(_configuration_semantics(entry) for entry in value))
    _require(isinstance(value, dict) and all(isinstance(key, str) for key in value), 'Render configuration contains a non-JSON value')
    return ('object', tuple((key, _configuration_semantics(value[key])) for key in sorted(value)))


def verify_configuration_binding(binding):
    """Hash retained text, never a language-specific reserialization of numbers."""
    text = binding.get('configurationJson')
    _require(isinstance(text, str) and 0 < len(text.encode('utf8')) <= 256*1024, 'Bound render configurationJson text is required')
    _require(hashlib.sha256(text.encode('utf8')).hexdigest() == binding.get('configurationSha256'), 'Render configuration hash changed')
    try:
        parsed = json.loads(text)
    except (ValueError, TypeError):
        raise ValueError('Render configurationJson is invalid JSON') from None
    configuration = binding.get('configuration')
    _require(isinstance(parsed, dict) and isinstance(configuration, dict), 'Render configuration must be a JSON object')
    _require(_configuration_semantics(parsed) == _configuration_semantics(configuration), 'Render configuration text differs from configuration values')
    return binding['configurationSha256']


def configuration_binding(configuration):
    """Preserve canonical render-time bytes across Python/JavaScript round trips."""
    text = json.dumps(configuration, sort_keys=True, separators=(',', ':'), allow_nan=False)
    binding = {'configuration': json.loads(text), 'configurationJson': text,
               'configurationSha256': hashlib.sha256(text.encode('utf8')).hexdigest()}
    verify_configuration_binding(binding)
    return binding


def default_material_colors(catalog_id, materials, settings, catalog_mode=False):
    """Mirror FurnitureModelLibrary's default albedo factors, not source edits.

    Babylon's default Color3.toLinearSpace uses gamma 2.2. The older non-sofa
    rule deliberately uses its numeric white/color Lerp without linearizing.
    Surface texture replacements and private user colors remain outside this
    color-only review mode and are explicitly recorded as such.
    """
    variant = settings['defaults'].get(catalog_id, 'white')
    color = settings['variants'].get(variant, settings['variants']['sage'])
    rgb = [int(color[i:i+2], 16)/255 for i in (1, 3, 5)]
    is_sofa = catalog_id in settings['sofaIds']
    seams = is_sofa and any('upholstery-textured' in key for key in settings['slots'].get(catalog_id, []))
    overrides = []
    for index, material in enumerate(materials):
        name = material['name']
        button = catalog_id == 'chester-sofa' and name == 'warm-brass'
        seam = ((seams or (catalog_mode and catalog_id in settings.get('bedIds', []))) and re.search(r'stitch|seam|welt|piping|thread', name, re.I)) or (seams and button)
        tintable = seam or any(key in name for key in ('upholstery-textured', 'variant-surface', 'door-surface')) or name == 'ceramic-tiles'
        countertop = 'countertop-surface' in name or (catalog_id == 'kitchen-microwave-drawer-cabinet' and name == 'surface-stone')
        if not tintable and not countertop:
            continue
        original = list(material.get('pbrMetallicRoughness', {}).get('baseColorFactor', [1, 1, 1, 1]))
        tint = [channel**2.2 for channel in rgb] if is_sofa or catalog_mode else [.1+.9*channel for channel in rgb]
        rule = 'catalog-realism-linear-gamma-2.2' if catalog_mode else 'sofa-linear-gamma-2.2' if is_sofa else 'legacy-white-color-lerp-0.9'
        if seam:
            factor = .70 if button else .72
            tint = [channel*factor for channel in tint]
            rule = 'sofa-tuft-button-0.70' if button else 'bedding-seam-0.72' if catalog_mode and catalog_id in settings.get('bedIds', []) else 'sofa-seam-0.72'
        if countertop:
            tint, rule = [1, 1, 1], 'countertop-white-factor'
        overrides.append({'materialIndex': index, 'materialKey': name, 'variant': variant, 'variantHex': color,
                          'rawGlbBaseColorFactor': original, 'renderBaseColorFactor': [*tint, original[3]], 'rule': rule})
    return overrides


def validate_lossless_webp(raw, resolution):
    """Require a bounded lossless VP8L payload, not quality-100 lossy VP8."""
    _require(25 <= len(raw) <= 32*1024*1024 and raw[:4] == b'RIFF' and raw[8:12] == b'WEBP', 'Review render must be WebP')
    _require(struct.unpack_from('<I', raw, 4)[0]+8 == len(raw), 'Review WebP length differs')
    offset, dimensions = 12, None
    while offset+8 <= len(raw):
        kind, size = raw[offset:offset+4], struct.unpack_from('<I', raw, offset+4)[0]
        offset += 8
        _require(offset+size <= len(raw) and kind not in (b'VP8 ', b'ANIM', b'ANMF'), 'Review WebP must use still lossless VP8L')
        if kind == b'VP8L':
            _require(dimensions is None and size >= 5 and raw[offset] == 0x2f, 'Invalid VP8L header')
            packed = struct.unpack_from('<I', raw, offset+1)[0]
            _require(packed >> 29 == 0, 'Unsupported VP8L version')
            dimensions = ((packed & 0x3fff)+1, ((packed >> 14) & 0x3fff)+1)
        offset += size+(size & 1)
    _require(offset == len(raw) and dimensions == tuple(resolution), 'Review VP8L dimensions differ from requested render')
    return {'width': dimensions[0], 'height': dimensions[1], 'encoding': 'VP8L'}


def _color_settings(root):
    load = lambda name: json.loads((root/name).read_text(encoding='utf8'))
    slots = load('src/personalSurfaceSlots.json')
    return {'defaults': load(COLOR_INPUTS[0]), 'variants': load(COLOR_INPUTS[1]),
            'sofaIds': load(COLOR_INPUTS[2]), 'bedIds': load('src/catalogRealismBeds.json'),
            'slots': {key: [slots['roles'][index] for index in indices] for key, indices in slots['models'].items()}}


def _dot(a, b):
    return sum(x*y for x, y in zip(a, b))


def _cross(a, b):
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]


def _unit(vector):
    size = math.sqrt(_dot(vector, vector))
    _require(size > 1e-12, 'Cannot normalize a zero camera vector')
    return [value/size for value in vector]


def validate_render_options(views, resolution, samples):
    _require(isinstance(views, (tuple, list)) and 0 < len(views) <= 5 and len(set(views)) == len(views) and all(view in VIEWS for view in views), 'Use distinct front/rear/detail/underside/clay views')
    _require(isinstance(resolution, (tuple, list)) and len(resolution) == 2 and all(isinstance(n, int) and not isinstance(n, bool) and 128 <= n <= 2048 for n in resolution), 'Render resolution must be 128..2048 pixels per axis')
    _require(isinstance(samples, int) and not isinstance(samples, bool) and 1 <= samples <= 128, 'Render samples must be 1..128')


def bounds_corners(low, high):
    _require(len(low) == len(high) == 3 and all(isinstance(value, (int, float)) and math.isfinite(value) for value in [*low, *high]), 'Finite XYZ bounds required')
    _require(all(high[i] >= low[i] for i in range(3)) and max(high[i]-low[i] for i in range(3)) > 1e-7, 'Bounds must contain a nonzero model')
    return [list(point) for point in itertools.product(*[(low[i], high[i]) for i in range(3)])]


def camera_frame(low, high, view, resolution=(640, 480), padding=1.15):
    """Orthographic vertical-scale frame, fitted to projected bbox corners.

    Blender's camera sensor-fit/aspect behavior is verified again against its
    real projection before rendering. Detail intentionally crops to the central
    55% region; all other views include every full-model bounding-box corner.
    """
    validate_render_options([view], resolution, 1)
    corners = bounds_corners(low, high)
    _require(isinstance(padding, (int, float)) and math.isfinite(padding) and 1.02 <= padding <= 2, 'Invalid framing margin')
    center = [(low[i]+high[i])/2 for i in range(3)]
    span = max(high[i]-low[i] for i in range(3))
    outward = _unit(DIRECTIONS[view])
    forward = [-value for value in outward]
    right = _unit(_cross(forward, [0, 0, 1]))
    up = _unit(_cross(right, forward))
    if view == 'detail':
        corners = [[center[i]+(corner[i]-center[i])*.55 for i in range(3)] for corner in corners]
    offsets = [[point[i]-center[i] for i in range(3)] for point in corners]
    horizontal = max(abs(_dot(point, right)) for point in offsets)*2
    vertical = max(abs(_dot(point, up)) for point in offsets)*2
    aspect = resolution[0]/resolution[1]
    scale = max(vertical, horizontal/aspect, span*.002)*padding
    distance = span*4
    return {'position': [center[i]+outward[i]*distance for i in range(3)],
            'target': center, 'right': right, 'up': up, 'outward': outward,
            'orthoScale': scale, 'aspect': aspect, 'clipStart': max(1e-5, span*.001),
            'clipEnd': span*12, 'coverage': 'central-region' if view == 'detail' else 'whole-model',
            'fitCorners': corners, 'padding': padding}


def project_to_frame(point, frame):
    offset = [point[i]-frame['target'][i] for i in range(3)]
    camera_offset = [point[i]-frame['position'][i] for i in range(3)]
    return (.5+_dot(offset, frame['right'])/(frame['orthoScale']*frame['aspect']),
            .5+_dot(offset, frame['up'])/frame['orthoScale'],
            -_dot(camera_offset, frame['outward']))


def _inside(root, relative):
    _require(isinstance(relative, str) and relative and not Path(relative).is_absolute() and '..' not in Path(relative).parts, 'Repository-relative review paths required')
    path = (root/relative).resolve()
    _require(path.is_relative_to(root), 'Review path escapes selected repository')
    return path


def _record(root, path):
    path = Path(path).resolve()
    _require(path.is_relative_to(root), 'Review file escapes selected repository')
    data = path.read_bytes()
    _require(data, 'Review input/output is empty: ' + str(path))
    return {'path': path.relative_to(root).as_posix(), 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}


def _verify(root, records):
    for record in records:
        actual = _record(root, _inside(root, record['path']))
        _require(actual['sha256'] == record['sha256'] and actual['bytes'] == record.get('bytes', actual['bytes']), 'Review input changed: ' + record['path'])


def _live(data):
    try:
        return data is not None and data.as_pointer() != 0
    except ReferenceError:
        return False


@contextmanager
def _owned_scene(bpy, catalog_id, cleanup):
    previous = bpy.context.window.scene
    before = {kind: {data.as_pointer() for data in getattr(bpy.data, kind)} for kind in DATA_KINDS}
    scene = bpy.data.scenes.new('Catalog GLB review ' + catalog_id)
    bpy.context.window.scene = scene
    owned, sealed = {}, False

    def seal():
        nonlocal owned, sealed
        owned = {kind: [data for data in getattr(bpy.data, kind) if data.as_pointer() not in before[kind]] for kind in DATA_KINDS}
        sealed = True

    try:
        yield scene, seal
    finally:
        # Capture a failed immediate import too, but never expand ownership after
        # rendering starts: user additions during a long render are not ours.
        if not sealed:
            seal()
        if bpy.context.window.scene == scene and _live(previous):
            bpy.context.window.scene = previous
        objects = [obj for obj in owned.get('objects', []) if _live(obj)]
        safe = _live(scene) and set(scene.objects) <= set(objects) and all(len(obj.users_scene) <= 1 for obj in objects)
        if safe:
            for obj in objects:
                bpy.data.objects.remove(obj, do_unlink=True)
            bpy.data.scenes.remove(scene)
            # Only exact, still-orphaned data created by this call can disappear.
            for _ in range(4):
                for kind in DATA_KINDS:
                    if kind in ('objects', 'scenes'):
                        continue
                    for data in owned.get(kind, []):
                        if _live(data) and data.users == 0:
                            getattr(bpy.data, kind).remove(data)
            cleanup.update({'temporarySceneRemoved': True})
        else:
            cleanup.update({'temporarySceneRemoved': False, 'reason': 'Scene contents or external links changed; preserve the scene for inspection.'})


def _configure_engine(bpy, scene, requested, samples):
    requested = requested.upper()
    _require(requested in ('CYCLES', 'EEVEE', 'BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'), 'Choose CYCLES or EEVEE for review')
    if requested == 'CYCLES':
        scene.render.engine = 'CYCLES'
        scene.cycles.samples = samples
        scene.cycles.use_denoising = True
        scene.cycles.seed = 73023
        scene.cycles.device = 'CPU'
        try:
            prefs = bpy.context.preferences.addons['cycles'].preferences
            if prefs.compute_device_type != 'NONE' and any(device.use and device.type != 'CPU' for device in prefs.devices):
                scene.cycles.device = 'GPU'
        except (KeyError, AttributeError, RuntimeError):
            pass
        return {'engine': scene.render.engine, 'samples': samples, 'sampleControl': 'cycles.samples', 'device': scene.cycles.device}
    error = None
    for identifier in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
        try:
            scene.render.engine = identifier
            break
        except (TypeError, ValueError) as failure:
            error = failure
    else:
        raise ValueError('No supported EEVEE engine is enabled') from error
    control = 'engine-default'
    eevee = getattr(scene, 'eevee', None)
    for attribute in ('taa_render_samples', 'taa_samples'):
        if eevee is not None and hasattr(eevee, attribute):
            setattr(eevee, attribute, samples)
            control = 'eevee.' + attribute
            break
    return {'engine': scene.render.engine, 'samples': samples if control != 'engine-default' else None, 'requestedSamples': samples, 'sampleControl': control, 'device': 'engine-default'}


def _material(bpy, name, color, roughness):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    shader = material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = 0
    return material


def _rig(bpy, scene, low, high):
    from mathutils import Vector
    center = Vector([(low[i]+high[i])/2 for i in range(3)])
    size = max(high[i]-low[i] for i in range(3))
    world = bpy.data.worlds.new('Catalog review neutral world')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (.35, .35, .35, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = .35
    scene.world = world
    lights = [((-2.5, -3.5, 4), 500, 2.5), ((3, -1, 2), 220, 3), ((1, 3.5, 3), 400, 2)]
    for index, (position, power, extent) in enumerate(lights):
        data = bpy.data.lights.new('Catalog review area ' + str(index), 'AREA')
        data.energy = power*size*size
        data.shape = 'DISK'
        data.size = extent*size
        data.color = (1, 1, 1)
        obj = bpy.data.objects.new(data.name, data)
        scene.collection.objects.link(obj)
        obj.location = center + Vector(position)*size
        obj.rotation_euler = (center-obj.location).to_track_quat('-Z', 'Y').to_euler()
    mesh = bpy.data.meshes.new('Catalog review ground mesh')
    extent = size*20
    x, y, z = center.x, center.y, low[2]-max(.0001, size*.002)
    mesh.from_pydata([(x-extent, y-extent, z), (x+extent, y-extent, z), (x+extent, y+extent, z), (x-extent, y+extent, z)], [], [(0, 1, 2, 3)])
    mesh.materials.append(_material(bpy, 'Catalog review ground', (.19, .20, .20), .92))
    ground = bpy.data.objects.new('Catalog review ground', mesh)
    scene.collection.objects.link(ground)
    camera_data = bpy.data.cameras.new('Catalog review camera')
    camera_data.type = 'ORTHO'
    camera = bpy.data.objects.new(camera_data.name, camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    clay = _material(bpy, 'Catalog review geometry clay', (.42, .44, .47), .75)
    return camera, ground, clay


def _frame_camera(bpy, scene, camera, frame):
    from mathutils import Matrix, Vector
    from bpy_extras.object_utils import world_to_camera_view
    camera.location = frame['position']
    camera.rotation_mode = 'QUATERNION'
    camera.rotation_quaternion = Matrix((frame['right'], frame['up'], frame['outward'])).transposed().to_quaternion()
    camera.data.ortho_scale = frame['orthoScale']
    camera.data.clip_start, camera.data.clip_end = frame['clipStart'], frame['clipEnd']
    bpy.context.view_layer.update()
    # Sensor-fit differs across Blender versions. Verify all requested corners
    # through Blender's actual camera projection instead of trusting a formula.
    for _ in range(3):
        projected = [world_to_camera_view(scene, camera, Vector(point)) for point in frame['fitCorners']]
        extent = max(max(abs(point.x-.5)*2, abs(point.y-.5)*2) for point in projected)
        if extent <= 1/frame['padding'] + 1e-6:
            break
        camera.data.ortho_scale *= extent*frame['padding']
        bpy.context.view_layer.update()
    projected = [world_to_camera_view(scene, camera, Vector(point)) for point in frame['fitCorners']]
    _require(all(0 <= point.x <= 1 and 0 <= point.y <= 1 and point.z > camera.data.clip_start for point in projected), 'Review camera failed projected-corner containment')
    return {'orthoScale': camera.data.ortho_scale, 'position': list(camera.location),
            'target': frame['target'], 'clipStart': camera.data.clip_start, 'clipEnd': camera.data.clip_end,
            'coverage': frame['coverage'], 'projectedBounds': {'min': [min(p[i] for p in projected) for i in range(2)], 'max': [max(p[i] for p in projected) for i in range(2)]}}


def render_model(root, catalog_id, views=VIEWS, resolution=(640, 480), samples=32, engine='CYCLES', color_mode='catalog-realism-colors'):
    """Render candidate evidence and update its receipt, leaving approval pending.

    For a pilot use resolution=(900,700), samples=32, engine='CYCLES'. A batch can
    explicitly request (512,384),24,'EEVEE'; the actual engine and sample control
    are recorded. Partial calls can resume matching views from the same hashes.
    """
    import bpy
    from mathutils import Vector
    validate_render_options(views, resolution, samples)
    _require(color_mode in ('catalog-realism-colors', 'app-default-colors', 'raw-glb'), 'Choose catalog-realism-colors, app-default-colors or raw-glb')
    _require(re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', catalog_id) is not None, 'Invalid catalog ID')
    root = Path(root).resolve()
    glb_helpers = runpy.run_path(str(root/'tools/blender/catalog_realism/glb.py'))
    read_glb, write_glb = glb_helpers['read_glb'], glb_helpers['write_glb']
    manifest_path = _inside(root, 'assets-source/catalog-realism/catalog.json')
    manifest = json.loads(manifest_path.read_text(encoding='utf8'))
    item = next((item for item in manifest['items'] if item['id'] == catalog_id), None)
    _require(item is not None, 'Model is absent from the frozen catalog')
    receipt_path = _inside(root, item['outputs']['receipt'])
    receipt_bytes = receipt_path.read_bytes()
    receipt = json.loads(receipt_bytes)
    _require(receipt.get('catalogId') == catalog_id and receipt.get('inputContractSha256') == item['contractSha256'] and receipt.get('state') in ('processed', 'reviewed'), 'A completed matching candidate receipt is required')
    glb_path = _inside(root, item['outputs']['glb'])
    _require(receipt['outputs']['glb']['path'] == item['outputs']['glb'] and receipt['outputs']['sourceBlend']['path'] == item['outputs']['sourceBlend'], 'Candidate output paths differ from the frozen contract')
    helpers = [_record(root, Path(__file__)), _record(root, root/'tools/blender/catalog_realism/source.py'), _record(root, root/'tools/blender/catalog_realism/glb.py')]
    color_records = [_record(root, root/name) for name in COLOR_INPUTS] if color_mode != 'raw-glb' else []
    # A renderer revision invalidates rendered evidence, not the authored model.
    # Its fresh hash replaces only this helper's earlier render-input record;
    # every authoring/loader/material input still has to match its build hash.
    prior_color_paths = {record['path'] for record in receipt.get('renderBinding', {}).get('colorInputs', [])}
    prior_inputs = [record for record in receipt['inputs'] if record['path'] != helpers[0]['path'] and record['path'] not in prior_color_paths]
    bound = {}
    for record in [*prior_inputs, *helpers, *color_records, receipt['outputs']['glb'], receipt['outputs']['sourceBlend'], _record(root, manifest_path)]:
        prior = bound.get(record['path'])
        _require(prior is None or prior['sha256'] == record['sha256'], 'Conflicting review input hashes')
        bound[record['path']] = record
    inputs = sorted(bound.values(), key=lambda record: record['path'])
    _verify(root, inputs)
    input_hash = config_hash(inputs)
    output_dir = _inside(root, 'assets-source/catalog-realism/renders/' + catalog_id)
    output_dir.mkdir(parents=True, exist_ok=True)
    started, records, cleanup = time.monotonic(), [], {}
    with _owned_scene(bpy, catalog_id, cleanup) as (scene, seal):
        document, binary = read_glb(glb_path)
        material_overrides = default_material_colors(catalog_id, document.get('materials', []), _color_settings(root), catalog_mode=color_mode == 'catalog-realism-colors') if color_mode != 'raw-glb' else []
        imported = copy.deepcopy(document)
        # A disposable render copy replaces only explicitly recorded albedo
        # factors. This preserves native importer texture/vertex-color math,
        # including zero source factors, without editing the candidate GLB.
        for override in material_overrides:
            imported['materials'][override['materialIndex']].setdefault('pbrMetallicRoughness', {})['baseColorFactor'] = override['renderBaseColorFactor']
        temporary_import = output_dir/('.render-input-'+uuid.uuid4().hex+'.glb')
        try:
            write_glb(temporary_import, imported, binary)
            import_hash = _record(root, temporary_import)['sha256']
            bpy.ops.import_scene.gltf(filepath=str(temporary_import))
        finally:
            if temporary_import.exists():
                temporary_import.unlink()
        bpy.context.view_layer.update()
        models = [obj for obj in scene.objects if obj.type == 'MESH' and len(obj.data.vertices)]
        _require(models, 'Candidate import contains no model geometry')
        for obj in scene.objects:
            if obj.type == 'LIGHT':
                obj.hide_render = True
        graph = bpy.context.evaluated_depsgraph_get()
        points = [obj.matrix_world @ Vector(point) for obj in (model.evaluated_get(graph) for model in models) for point in obj.bound_box]
        low = [min(point[i] for point in points) for i in range(3)]
        high = [max(point[i] for point in points) for i in range(3)]
        bounds_corners(low, high)
        engine_configuration = _configure_engine(bpy, scene, engine, samples)
        scene.render.resolution_x, scene.render.resolution_y = resolution
        scene.render.resolution_percentage = 100
        scene.render.pixel_aspect_x = scene.render.pixel_aspect_y = 1
        scene.render.image_settings.file_format = 'WEBP'
        scene.render.image_settings.color_mode = 'RGBA'
        scene.render.image_settings.color_depth = '8'
        scene.render.image_settings.quality = 100
        scene.render.image_settings.compression = 100
        scene.render.dither_intensity = 0
        scene.render.film_transparent = False
        scene.render.use_file_extension = True
        scene.render.use_sequencer = False
        scene.render.use_compositing = False
        scene.view_settings.view_transform = 'AgX'
        scene.view_settings.look = 'AgX - Medium High Contrast'
        scene.view_settings.exposure = 0
        scene.view_settings.gamma = 1
        camera, ground, clay = _rig(bpy, scene, low, high)
        configuration = {'version': 1, 'renderer': engine_configuration, 'blenderVersion': bpy.app.version_string,
                         'resolution': list(resolution), 'colorManagement': {'viewTransform': scene.view_settings.view_transform, 'look': scene.view_settings.look, 'exposure': 0, 'gamma': 1},
                         'camera': {'type': 'orthographic', 'directions': DIRECTIONS, 'padding': 1.15, 'detailRegion': .55},
                         'lighting': 'neutral-three-area-v2-500-220-400', 'ground': 'neutral-0.19-below-world-minimum-hidden-for-underside',
                         'boundsM': {'min': low, 'max': high}, 'materialPolicy': color_mode,
                         'materialOverrides': material_overrides, 'colorConfigSha256': config_hash(color_records),
                         'rawGlbSha256': receipt['outputs']['glb']['sha256'], 'renderImportSha256': import_hash,
                         'appEnvironment': {'catalogRealismEnabled': color_mode == 'catalog-realism-colors', 'featureFlag': 'VITE_CATALOG_REALISM_VERSION'},
                         'imageEncoding': {'format': 'WEBP', 'codec': 'VP8L', 'quality': 100, 'compression': 100, 'dither': 0, 'filmTransparent': False},
                         'limitations': ['Default variant albedo factors are mirrored; selectable door/worktop finish textures stay as authored in the GLB.', 'Clay overrides materials only in its review view.']}
        configuration_evidence = configuration_binding(configuration)
        configuration_hash = configuration_evidence['configurationSha256']
        seal()
        for view in views:
            _verify(root, inputs)
            _require(receipt_path.read_bytes() == receipt_bytes, 'Build receipt changed during review rendering')
            scene.view_layers[0].material_override = clay if view == 'clay' else None
            ground.hide_render = view == 'underside'
            camera_receipt = _frame_camera(bpy, scene, camera, camera_frame(low, high, view, resolution))
            temporary = output_dir/('.'+view+'-'+uuid.uuid4().hex+'.webp')
            scene.render.filepath = str(temporary)
            view_started = time.monotonic()
            try:
                bpy.ops.render.render(write_still=True, scene=scene.name)
                _require(temporary.is_file(), 'Renderer produced no WebP')
                validate_lossless_webp(temporary.read_bytes(), resolution)
                image_record = _record(root, temporary)
                final_path = output_dir/(view+'-'+image_record['sha256'][:20]+'.webp')
                if final_path.exists():
                    _require(final_path.read_bytes() == temporary.read_bytes(), 'Hashed render output differs')
                    temporary.unlink()
                else:
                    temporary.replace(final_path)
                image_record['path'] = final_path.relative_to(root).as_posix()
                records.append({'view': view, **image_record, 'resolution': list(resolution),
                                'seconds': round(time.monotonic()-view_started, 3), 'camera': camera_receipt,
                                'glbSha256': receipt['outputs']['glb']['sha256'], 'renderConfigSha256': configuration_hash,
                                'inputSetSha256': input_hash})
            finally:
                if temporary.exists():
                    temporary.unlink()
        _verify(root, inputs)
        _require(receipt_path.read_bytes() == receipt_bytes, 'Build receipt changed during review rendering')
    # Retain partial work only when both its inputs/configuration and image bytes
    # match this invocation. Old images are never silently called current.
    by_view = {}
    for old in receipt.get('renders', []):
        if old.get('renderConfigSha256') == configuration_hash and old.get('inputSetSha256') == input_hash and old.get('glbSha256') == receipt['outputs']['glb']['sha256']:
            try:
                _verify(root, [old])
                by_view[old['view']] = old
            except (ValueError, OSError):
                pass
    by_view.update({record['view']: record for record in records})
    receipt['renders'] = [by_view[view] for view in VIEWS if view in by_view]
    recipe_inputs = {record['path']: record for record in prior_inputs}
    recipe_inputs.update({record['path']: record for record in [*helpers, *color_records]})
    receipt['inputs'] = sorted(recipe_inputs.values(), key=lambda record: record['path'])
    receipt['renderBinding'] = {**configuration_evidence,
                              'inputs': inputs, 'colorInputs': color_records, 'beforeSha256': input_hash, 'afterSha256': config_hash(inputs)}
    receipt['state'] = 'processed'
    receipt.pop('review', None)
    receipt.pop('artifactSetSha256', None)
    _verify(root, inputs)
    _require(receipt_path.read_bytes() == receipt_bytes, 'Build receipt changed before render record commit')
    temporary_receipt = receipt_path.with_name('.'+receipt_path.name+'.render-'+uuid.uuid4().hex+'.tmp')
    try:
        temporary_receipt.write_text(json.dumps(receipt, indent=2)+'\n', encoding='utf8', newline='\n')
        temporary_receipt.replace(receipt_path)
    finally:
        if temporary_receipt.exists():
            temporary_receipt.unlink()
    return {'catalogId': catalog_id, 'renders': receipt['renders'], 'renderedThisCall': len(records),
            'seconds': round(time.monotonic()-started, 3), 'renderConfigSha256': configuration_hash,
            'receipt': receipt_path.relative_to(root).as_posix(), 'cleanup': cleanup,
            'visualApproval': 'pending explicit inspection'}
