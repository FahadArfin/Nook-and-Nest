"""Isolated Blender comparison for the existing oak storage coffee table.

Through the root-owned Blender session:
    lab = runpy.run_path('/absolute/repo/tools/blender/realism_lab_table.py')
    receipt = lab['build']('current')  # material / refined

Importing this file performs no scene edits. The current model is appended from
the tracked source; original models, catalog records and previews are untouched.
"""
import hashlib
import json
import math
import struct
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
OWNER = 'Nook realism lab table'
_RUNTIME = bpy.app.driver_namespace.setdefault('nook.realism.table.runtime', {})
CATALOG_ID = 'designed-coffee-storage'
DIMENSIONS = Vector((1.0, .55, .4))
MATERIAL_KEYS = {'walnut', 'matte-rubber', 'honey-oak', 'champagne-brass'}
SOURCE = ROOT / 'assets-source/blender/designed-coffee-storage.blend'
BLEND_DIR = ROOT / 'assets-source/experiments/realism-lab'
GLB_DIR = ROOT / 'public/experiments/realism-lab'


def _own_scene(variant):
    # Imported/saved custom properties never authorize cleanup. Only exact
    # runtime references established by this process may be reused.
    previous = _RUNTIME.get(variant, {})
    scene = previous.get('scene')
    try:
        reusable = (scene is not None and scene.as_pointer() != 0
                    and set(scene.objects) == set(previous.get('parts', []))
                    and all(len(o.users_scene) == 1 for o in scene.objects))
    except ReferenceError:
        reusable = False
    if not reusable:
        scene = None
    if scene is None:
        scene = bpy.data.scenes.new('Realism lab table ' + variant)
    else:
        for obj in previous['parts']:
            bpy.data.objects.remove(obj, do_unlink=True)
    _RUNTIME[variant] = {'scene': scene, 'parts': []}
    scene['authoring_owner'] = OWNER
    scene['lab_variant'] = variant
    scene['catalog_id'] = CATALOG_ID
    scene['nominal_dimensions_m'] = list(DIMENSIONS)
    scene.unit_settings.system = 'METRIC'
    bpy.context.window.scene = scene
    return scene


def _safe_export_extras(value):
    allowed = {'catalog_id', 'sofa_material_key', 'lab_material_key',
               'realism_family', 'texture_source', 'texture_license', 'repeat_m',
               'nominal_dimensions_m', 'nominal_width_m', 'nominal_depth_m', 'nominal_height_m'}
    if isinstance(value, dict):
        if 'extras' in value:
            extras = value['extras']
            safe = {k: v for k, v in extras.items() if k in allowed} if isinstance(extras, dict) else {}
            if safe:
                value['extras'] = safe
            else:
                del value['extras']
        for item in value.values():
            _safe_export_extras(item)
    elif isinstance(value, list):
        for item in value:
            _safe_export_extras(item)


def _canonical(name):
    while name not in MATERIAL_KEYS and len(name) > 4 and name[-4] == '.' and name[-3:].isdigit():
        name = name[:-4]
    if name not in MATERIAL_KEYS:
        raise ValueError('Unexpected source material: ' + name)
    return name


def _bounds(parts):
    points = [o.matrix_world @ v.co for o in parts for v in o.data.vertices]
    if not points:
        raise ValueError('Empty experiment geometry')
    return (Vector([min(v[i] for v in points) for i in range(3)]),
            Vector([max(v[i] for v in points) for i in range(3)]))


def _append_source(scene):
    with bpy.data.libraries.load(str(SOURCE), link=False) as (source, target):
        # Blender resolves target.objects in place on leaving this context.
        # Keep the original names separate so collisions in other open scenes
        # cannot change the identity used by the geometry comparison receipt.
        names = tuple(source.objects)
        target.objects = list(names)
    parts = []
    materials = {}
    for name, obj in zip(names, target.objects):
        if obj is None:
            continue
        if obj.type != 'MESH' or any(word in name.lower() for word in
                ('review ground', 'studio floor', 'presentation_floor', 'backdrop', 'ground_plane')):
            if obj.users == 0:
                bpy.data.objects.remove(obj)
            continue
        scene.collection.objects.link(obj)
        obj['authoring_owner'] = OWNER
        obj['lab_source_part'] = name
        obj['catalog_id'] = CATALOG_ID
        obj.data = obj.data.copy()
        for slot, old in enumerate(obj.data.materials):
            if old is None:
                raise ValueError('Empty source material slot: ' + name)
            key = _canonical(old.name)
            if key not in materials:
                material = old.copy()
                material.name = 'table-lab-' + scene['lab_variant'] + '-' + key
                material['authoring_owner'] = OWNER
                material['lab_material_key'] = key
                materials[key] = material
            obj.data.materials[slot] = materials[key]
        parts.append(obj)
    if set(materials) != MATERIAL_KEYS:
        raise ValueError('Source material keys changed')
    bpy.context.view_layer.update()
    lo, hi = _bounds(parts)
    center = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    factors = Vector([DIMENSIONS[i] / (hi[i] - lo[i]) for i in range(3)])
    for obj in parts:
        transform = obj.matrix_world.copy()
        for vertex in obj.data.vertices:
            point = transform @ vertex.co - center
            vertex.co = Vector([point[i] * factors[i] for i in range(3)])
        obj.matrix_world = Matrix.Identity(4)
        obj.data.update()
    bpy.context.view_layer.update()
    return parts, materials


def _geometry_hash(parts):
    """Position/topology receipt: UV and material edits do not affect this."""
    digest = hashlib.sha256()
    for obj in sorted(parts, key=lambda o: o.get('lab_source_part', o.name)):
        digest.update(obj.get('lab_source_part', obj.name).encode())
        for vertex in obj.data.vertices:
            digest.update(struct.pack('<fff', *(obj.matrix_world @ vertex.co)))
        for polygon in obj.data.polygons:
            digest.update(struct.pack('<I', len(polygon.vertices)))
            digest.update(struct.pack('<' + 'I' * len(polygon.vertices), *polygon.vertices))
    return digest.hexdigest()


def _image_node(material, path, linear):
    # Separate image datablocks avoid changing colorspace/packing on an image
    # used in an unrelated open scene.
    image = bpy.data.images.load(str(ROOT / path), check_existing=False)
    image.colorspace_settings.name = 'Non-Color' if linear else 'sRGB'
    image.pack()
    image['authoring_owner'] = OWNER
    node = material.node_tree.nodes.new('ShaderNodeTexImage')
    node.image = image
    node.extension = 'REPEAT'
    return node


def _timber_material(material, family, record):
    material.use_nodes = True
    nodes, links = material.node_tree.nodes, material.node_tree.links
    bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    for input_name in ('Base Color', 'Normal', 'Roughness', 'Metallic'):
        for link in list(bsdf.inputs[input_name].links):
            links.remove(link)
    # Real scanned species color carries the timber hue; the retained material
    # factor remains available to the app's independent material recoloring.
    factor = (.84, .84, .84, 1)
    material.diffuse_color = factor
    bsdf.inputs['Base Color'].default_value = factor
    bsdf.inputs['Metallic'].default_value = 0
    bsdf.inputs['IOR'].default_value = 1.45
    base = _image_node(material, record['baseColor'], False)
    multiply = nodes.new('ShaderNodeMix')
    multiply.data_type = 'RGBA'
    multiply.blend_type = 'MULTIPLY'
    next(i for i in multiply.inputs if i.identifier == 'Factor_Float').default_value = 1
    color_a = next(i for i in multiply.inputs if i.identifier == 'A_Color')
    color_b = next(i for i in multiply.inputs if i.identifier == 'B_Color')
    color_b.default_value = factor
    links.new(base.outputs['Color'], color_a)
    links.new(next(o for o in multiply.outputs if o.identifier == 'Result_Color'), bsdf.inputs['Base Color'])
    normal = _image_node(material, record['normal'], True)
    normal_map = nodes.new('ShaderNodeNormalMap')
    normal_map.inputs['Strength'].default_value = record['normalStrength']
    links.new(normal.outputs['Color'], normal_map.inputs['Color'])
    links.new(normal_map.outputs['Normal'], bsdf.inputs['Normal'])
    orm = _image_node(material, record['orm'], True)
    channels = nodes.new('ShaderNodeSeparateColor')
    links.new(orm.outputs['Color'], channels.inputs[0])
    links.new(channels.outputs['Green'], bsdf.inputs['Roughness'])
    links.new(channels.outputs['Blue'], bsdf.inputs['Metallic'])
    material['lab_texture_family'] = family
    material['lab_texture_source'] = record['source']
    material['lab_texture_license'] = record['license']


def _timber_uv(parts, records):
    for obj in parts:
        mesh = obj.data
        mesh.update()
        if not mesh.uv_layers:
            mesh.uv_layers.new(name='UVMap')
        uv = mesh.uv_layers.active.data
        lo, hi = _bounds([obj])
        longest = max(range(3), key=lambda i: hi[i] - lo[i])
        name = obj.get('lab_source_part', obj.name)
        phase = int(hashlib.sha256(name.encode()).hexdigest()[:8], 16) / 0xffffffff
        for face in mesh.polygons:
            material = mesh.materials[face.material_index]
            family = material.get('lab_texture_family')
            if family not in ('oak', 'walnut'):
                continue
            record = records[family]
            normal_axis = max(range(3), key=lambda i: abs(face.normal[i]))
            axes = [i for i in range(3) if i != normal_axis]
            along = longest if longest in axes else axes[1]
            across = next(i for i in axes if i != along)
            # Each separate board follows its longitudinal dimension, with a
            # deterministic offset so rails/posts do not repeat the same grain.
            for li in face.loop_indices:
                point = mesh.vertices[mesh.loops[li].vertex_index].co
                pair = ((point[across] - lo[across]) / .34 + phase,
                        (point[along] - lo[along]) / record['repeatM'] + phase * .61)
                uv[li].uv = pair if record['grainAxis'] == 'v' else pair[::-1]


def _select_only(parts):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]


def _bevel(obj, amount=.0015):
    _select_only([obj])
    bevel = obj.modifiers.new('Restrained furniture edge easing', 'BEVEL')
    bevel.width = amount
    bevel.segments = 3
    bevel.limit_method = 'ANGLE'
    bevel.angle_limit = math.radians(35)
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    normals = obj.modifiers.new('Board weighted normals', 'WEIGHTED_NORMAL')
    normals.keep_sharp = True
    bpy.ops.object.modifier_apply(modifier=normals.name)


def _box(name, center, dimensions, material, bevel=.001):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    obj['authoring_owner'] = OWNER
    obj['lab_source_part'] = name
    obj['catalog_id'] = CATALOG_ID
    if bevel:
        _bevel(obj, bevel)
    # UV projection operates on baked world-space coordinates consistently.
    transform = obj.matrix_world.copy()
    for vertex in obj.data.vertices:
        vertex.co = transform @ vertex.co
    obj.matrix_world = Matrix.Identity(4)
    obj.data.update()
    return obj


def _cylinder(name, center, radius, depth, material, axis='Z'):
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=radius, depth=depth, location=center)
    obj = bpy.context.object
    obj.name = name
    if axis == 'Y':
        obj.rotation_euler.x = math.pi / 2
    if axis == 'X':
        obj.rotation_euler.y = math.pi / 2
    obj.data.materials.append(material)
    obj['authoring_owner'] = OWNER
    obj['lab_source_part'] = name
    obj['catalog_id'] = CATALOG_ID
    transform = obj.matrix_world.copy()
    for vertex in obj.data.vertices:
        vertex.co = transform @ vertex.co
    obj.matrix_world = Matrix.Identity(4)
    for face in obj.data.polygons:
        face.use_smooth = len(face.vertices) == 4
    obj.data.update()
    return obj


def _refine(parts, materials):
    additions = []
    drawer = next(o for o in parts if o.get('lab_source_part', '').startswith('drawer box'))
    lo, hi = _bounds([drawer])
    center = (lo + hi) / 2
    size = hi - lo
    parts.remove(drawer)
    bpy.data.objects.remove(drawer, do_unlink=True)
    # A real five-piece drawer carcass replaces the former solid cube. Keeping
    # the existing closed facade retains the original usable tabletop and pose.
    wall = .012
    additions.append(_box('drawer plywood bottom', (center.x, center.y, lo.z + .004),
                          (size.x - wall * 2, size.y - wall * 2, .008), materials['walnut']))
    for sign in (-1, 1):
        x = center.x + sign * (size.x - wall) / 2
        additions.append(_box('drawer solid side ' + str(sign), (x, center.y, center.z),
                              (wall, size.y, size.z), materials['walnut']))
        additions.append(_box('fitted oak drawer runner ' + str(sign),
                              (x + sign * .009, center.y, lo.z + .021),
                              (.006, size.y - .025, .012), materials['honey-oak'], .0006))
        # Genuine mechanical fixing under the cabinet, inside the existing
        # envelope; modest metal detail without decorative bolt scattering.
        for y in (lo.y + .035, hi.y - .035):
            additions.append(_cylinder('runner fixing ' + str(sign),
                                       (x + sign * .008, y, lo.z + .029),
                                       .0022, .0015, materials['champagne-brass']))
    for sign in (-1, 1):
        additions.append(_box('drawer end board ' + str(sign),
                              (center.x, center.y + sign * (size.y - wall) / 2, center.z),
                              (size.x - wall * 2, wall, size.z), materials['walnut']))
    for obj in parts:
        name = obj.get('lab_source_part', '')
        if name.startswith('rounded oak worktop'):
            _bevel(obj, .0018)
        elif name.startswith('fitted drawer fascia'):
            # Consistent millimetre reveals above/below the drawer front.
            f_lo, f_hi = _bounds([obj])
            f_center = (f_lo + f_hi) / 2
            for vertex in obj.data.vertices:
                for axis in (0, 2):
                    factor = ((f_hi[axis] - f_lo[axis]) - .004) / (f_hi[axis] - f_lo[axis])
                    vertex.co[axis] = f_center[axis] + (vertex.co[axis] - f_center[axis]) * factor
            obj.data.update()
        elif name.startswith('lower display shelf'):
            # A slim shadow break at the side/post connection clarifies the
            # board construction without moving the shelf or its upper plane.
            for vertex in obj.data.vertices:
                vertex.co.x *= .996
            obj.data.update()
    # Existing brass bar already has two physical standoffs. Add restrained
    # fixing roses on the actual fascia-facing ends, keeping the pull envelope.
    supports = [o for o in parts if o.get('lab_source_part', '').startswith('pull standoff')]
    for index, support in enumerate(supports):
        p_lo, p_hi = _bounds([support])
        p = (p_lo + p_hi) / 2
        additions.append(_cylinder('brass pull fixing rose ' + str(index),
                                   (p.x, p_hi.y - .001, p.z), .006, .002,
                                   materials['champagne-brass'], 'Y'))
    parts += additions
    bpy.context.view_layer.update()
    return parts


def _export(parts, materials, path):
    # Join disposable copies only; the active scene and saved blend retain all
    # separately editable construction pieces for review and further edits.
    copies = []
    for obj in parts:
        duplicate = obj.copy()
        duplicate.data = obj.data.copy()
        bpy.context.scene.collection.objects.link(duplicate)
        copies.append(duplicate)
    joined = None
    try:
        _select_only(copies)
        bpy.ops.object.join()
        joined = bpy.context.view_layer.objects.active
        joined.name = 'table-' + bpy.context.scene['lab_variant']
        joined['nominal_width_m'], joined['nominal_depth_m'], joined['nominal_height_m'] = DIMENSIONS
        bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
                                  use_active_scene=True, export_extras=True, export_yup=True,
                                  export_apply=True, export_cameras=False, export_lights=False)
        data = path.read_bytes()
        offset, chunks = 12, []
        while offset < len(data):
            length, kind = struct.unpack_from('<II', data, offset)
            chunks.append((kind, data[offset + 8:offset + 8 + length]))
            offset += length + 8
        document = json.loads(chunks[0][1])
        mapping = {m.name: key for key, m in materials.items()}
        for material in document['materials']:
            material['name'] = mapping.get(material['name'], material.get('extras', {}).get('lab_material_key', material['name']))
        if {m['name'] for m in document['materials']} != MATERIAL_KEYS:
            raise ValueError('Export material key drift')
        _safe_export_extras(document)
        payload = json.dumps(document, separators=(',', ':')).encode()
        payload += b' ' * (-len(payload) % 4)
        chunks[0] = (chunks[0][0], payload)
        body = b''.join(struct.pack('<II', len(payload), kind) + payload for kind, payload in chunks)
        path.write_bytes(struct.pack('<III', 0x46546c67, 2, len(body) + 12) + body)
        return document
    finally:
        # Delete only references created by this export, never other meshes
        # that happen to reside in the active scene.
        for obj in copies + ([joined] if joined is not None else []):
            try:
                if obj.as_pointer() and bpy.data.objects.get(obj.name) == obj:
                    bpy.data.objects.remove(obj, do_unlink=True)
            except ReferenceError:
                pass
        _select_only(parts)


def build(variant='current'):
    if variant not in ('current', 'material', 'refined'):
        raise ValueError('Choose current, material, or refined')
    if not SOURCE.is_file():
        raise FileNotFoundError(SOURCE)
    records = json.loads((ROOT / 'assets-source/realism-materials.json').read_text())['materials']
    if variant != 'current':
        for family in ('oak', 'walnut'):
            for key in ('baseColor', 'normal', 'orm'):
                if not (ROOT / records[family][key]).is_file():
                    raise FileNotFoundError(records[family][key])
    scene = _own_scene(variant)
    parts, materials = _append_source(scene)
    baseline_geometry = _geometry_hash(parts)
    if variant == 'refined':
        parts = _refine(parts, materials)
    _RUNTIME[variant]['parts'] = list(parts)
    if variant != 'current':
        _timber_material(materials['honey-oak'], 'oak', records['oak'])
        _timber_material(materials['walnut'], 'walnut', records['walnut'])
        _timber_uv(parts, records)
    geometry_hash = _geometry_hash(parts)
    if variant == 'material' and geometry_hash != baseline_geometry:
        raise ValueError('Material-only variant changed geometry')
    lo, hi = _bounds(parts)
    if max(abs((hi - lo)[i] - DIMENSIONS[i]) for i in range(3)) > .0001 or abs(lo.z) > .0001:
        raise ValueError('Table envelope or ground contact changed: ' + str((list(lo), list(hi))))
    triangles = sum(len(p.vertices) - 2 for o in parts for p in o.data.polygons)
    if triangles >= 25000:
        raise ValueError('Table triangle budget exceeded')
    BLEND_DIR.mkdir(parents=True, exist_ok=True)
    GLB_DIR.mkdir(parents=True, exist_ok=True)
    blend_path, glb_path = BLEND_DIR / ('table-' + variant + '.blend'), GLB_DIR / ('table-' + variant + '.glb')
    scene['lab_geometry_sha256'] = geometry_hash
    scene['lab_source_sha256'] = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    scene['lab_material_only_geometry_unchanged'] = variant == 'material' and geometry_hash == baseline_geometry
    # A scene library write does not rename the user's main Blender document.
    bpy.data.libraries.write(str(blend_path), {scene}, fake_user=True, compress=True)
    document = _export(parts, materials, glb_path)
    if glb_path.stat().st_size >= 6_000_000:
        raise ValueError('Table GLB byte budget exceeded')
    return {'variant': variant, 'catalogId': CATALOG_ID, 'dimensionsMm': [1000, 550, 400],
            'editableParts': len(parts), 'triangles': triangles, 'glbBytes': glb_path.stat().st_size,
            'images': len(document.get('images', [])), 'materialKeys': sorted(MATERIAL_KEYS),
            'geometrySha256': geometry_hash, 'baselineGeometrySha256': baseline_geometry,
            'sourceSha256': scene['lab_source_sha256'], 'blend': str(blend_path), 'glb': str(glb_path),
            'scene': scene.name, 'owner': OWNER}
