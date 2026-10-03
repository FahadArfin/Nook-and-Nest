"""Original reference-assisted oak day sofa: isolated Beta realism experiment.

Execute with Blender's Python, not a shell Blender process::
    import importlib.util
    spec = importlib.util.spec_from_file_location('lab_sofa', PATH)
    lab = importlib.util.module_from_spec(spec); spec.loader.exec_module(lab)
    result = lab.build()

Dimensions are metres. Front is -Y. Source parts remain separate and named;
only evaluated export copies are joined. Nothing in the production catalog is
overwritten. A separate review rig may render the scene returned by build().
"""
import bpy
import hashlib
import json
import math
import struct
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion

OWNER = 'Nook realism lab sofa'
ROOT = Path(__file__).resolve().parents[2]
_RUNTIME = bpy.app.driver_namespace.setdefault('nook.realism.sofa.runtime', {'owned': []})
KEYS = ('wood-honey-textured', 'upholstery-textured',
        'tailored-tone-on-tone-stitch', 'joinery-aged-brass')
PARAMETERS = {
    'envelope_m': (2.0, .850, .780),
    'seat_width': .592, 'seat_depth': .646, 'seat_thickness': .142,
    'seat_crown': .014, 'corner_radius': .033, 'welt_radius': .00115,
    'back_rake_degrees': 10.0, 'rail_height': .081,
    'linen_normal_strength': .25,
}


def _tag(data):
    data['authoring_owner'] = OWNER
    _RUNTIME['owned'].append(data)
    return data


def _live(data):
    try:
        return data.as_pointer() != 0
    except ReferenceError:
        return False


def _cleanup():
    # Ownership is an in-memory datablock reference, never an importable ID
    # property. Tags in saved/loaded .blend or imported GLB files grant nothing.
    owned = [d for d in _RUNTIME['owned'] if _live(d)]
    scenes = [d for d in owned if isinstance(d, bpy.types.Scene)]
    for obj in [d for d in owned if isinstance(d, bpy.types.Object)]:
        if not any(scene not in scenes for scene in obj.users_scene):
            bpy.data.objects.remove(obj, do_unlink=True)
    for scene in scenes:
        # Preserve a scene if the user added untracked objects to it.
        if not scene.objects:
            bpy.data.scenes.remove(scene)
    for coll in [d for d in owned if isinstance(d, bpy.types.Collection)]:
        if _live(coll) and not coll.objects and not coll.children and coll.users == 0:
            bpy.data.collections.remove(coll)
    for datasets in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.images):
        for data in owned:
            if _live(data) and data.users == 0 and datasets.get(data.name) == data:
                datasets.remove(data)
    _RUNTIME['owned'] = []


def _safe_export_extras(value):
    allowed = {'catalog_id', 'sofa_material_key', 'lab_material_key',
               'realism_family', 'texture_source', 'texture_license', 'repeat_m',
               'nominal_dimensions_m', 'nominal_width_m', 'nominal_depth_m', 'nominal_height_m'}
    if isinstance(value, dict):
        if 'extras' in value:
            extras = value['extras']
            safe = {key: item for key, item in extras.items() if key in allowed} if isinstance(extras, dict) else {}
            if safe:
                value['extras'] = safe
            else:
                del value['extras']
        for item in value.values():
            _safe_export_extras(item)
    elif isinstance(value, list):
        for item in value:
            _safe_export_extras(item)


def _baseline_factors(root):
    path = root / 'public/models/furniture/slat-day-sofa.glb'
    raw = path.read_bytes()
    size = struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:20 + size])
    return {m['name']: m.get('pbrMetallicRoughness', {}) for m in doc['materials']}


def _materials(root):
    records = json.loads((root / 'assets-source/realism-materials.json').read_text())['materials']
    baseline = _baseline_factors(root)
    result = {}
    for key in KEYS:
        mat = _tag(bpy.data.materials.new(key))
        mat['sofa_material_key'] = key
        mat.use_nodes = True
        mat.use_backface_culling = True
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        bs = nodes.get('Principled BSDF')
        factor = baseline[key].get('baseColorFactor', [1, 1, 1, 1])
        # Preserve the accepted moss and oak factors as the material baseline.
        if key == KEYS[2]:
            factor = [v * .92 for v in baseline[KEYS[1]]['baseColorFactor'][:3]] + [1]
        bs.inputs['Base Color'].default_value = factor
        mat.diffuse_color = factor
        bs.inputs['Roughness'].default_value = baseline[key].get('roughnessFactor', .8)
        bs.inputs['Metallic'].default_value = baseline[key].get('metallicFactor', 0)
        if key in KEYS[:2]:
            family = 'oak' if key == KEYS[0] else 'linen'
            record = records[family]
            mat['realism_family'] = family
            mat['repeat_m'] = record['repeatM']
            mat['texture_source'] = record['source']
            mat['texture_license'] = record['license']
            def image_node(field, noncolor=False):
                im = _tag(bpy.data.images.load(str(root / record[field]), check_existing=False))
                im.colorspace_settings.name = 'Non-Color' if noncolor else 'sRGB'
                im.pack()
                node = nodes.new('ShaderNodeTexImage')
                node.image = im
                node.label = family + ' measured ' + field
                node.extension = 'REPEAT'
                return node
            base = image_node('baseColor')
            mix = nodes.new('ShaderNodeMix')
            mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'
            next(s for s in mix.inputs if s.identifier == 'Factor_Float').default_value = 1
            a = next(s for s in mix.inputs if s.identifier == 'A_Color')
            b = next(s for s in mix.inputs if s.identifier == 'B_Color')
            b.default_value = factor
            links.new(base.outputs['Color'], a)
            links.new(next(s for s in mix.outputs if s.identifier == 'Result_Color'), bs.inputs['Base Color'])
            normal = image_node('normal', True)
            nm = nodes.new('ShaderNodeNormalMap')
            nm.inputs['Strength'].default_value = .32 if family == 'oak' else PARAMETERS['linen_normal_strength']
            links.new(normal.outputs['Color'], nm.inputs['Color'])
            links.new(nm.outputs['Normal'], bs.inputs['Normal'])
            orm = image_node('orm', True)
            split = nodes.new('ShaderNodeSeparateColor')
            links.new(orm.outputs['Color'], split.inputs[0])
            links.new(split.outputs['Green'], bs.inputs['Roughness'])
            links.new(split.outputs['Blue'], bs.inputs['Metallic'])
            if 'Sheen Weight' in bs.inputs:
                # Current Blender/glTF combination exports a small white sheen
                # weight as full-white sheenColorFactor. Omit that optional
                # lobe in both source and export for faithful round trips; the
                # measured roughness and tangent normal retain textile detail.
                bs.inputs['Sheen Weight'].default_value = 0
                bs.inputs['Sheen Roughness'].default_value = .7
        result[key] = mat
    return result


def _uv(obj, family, axis=None):
    mesh = obj.data; mesh.update()
    layer = mesh.uv_layers.new(name='UVMap')
    phase = int(hashlib.sha256(obj.name.encode()).hexdigest()[:6], 16) / 0xffffff
    for face in mesh.polygons:
        dominant = max(range(3), key=lambda i: abs(face.normal[i]))
        axes = [i for i in range(3) if i != dominant]
        along = axis if axis in axes else axes[1]
        across = next(i for i in axes if i != along)
        for li in face.loop_indices:
            co = mesh.vertices[mesh.loops[li].vertex_index].co
            if family == 'oak':
                # Veneer longitudinal period is measured at 1.83 m. The narrow
                # scan width is 0.34 m. Local coordinates follow each board.
                pair = (co[across] / .34 + phase, co[along] / 1.83 + phase * .63)
            else:
                pair = (co[axes[0]] / .271 + phase, co[axes[1]] / .271 + phase * .31)
            layer.data[li].uv = pair


def _mesh(name, verts, faces, mat, collection, family=None, axis=None):
    mesh = _tag(bpy.data.meshes.new(name + ' editable mesh'))
    mesh.from_pydata(verts, [], faces); mesh.update()
    obj = _tag(bpy.data.objects.new(name, mesh))
    collection.objects.link(obj)
    mesh.materials.append(mat)
    if family:
        _uv(obj, family, axis)
    return obj


def _board(name, size, center, mat, collection, bevel=.005, taper=None, rotation=0):
    hx, hy, hz = [d / 2 for d in size]
    verts = []
    for zsign in (-1, 1):
        sx, sy = (taper if taper and zsign < 0 else (1, 1))
        for x, y in ((-hx, -hy), (hx, -hy), (hx, hy), (-hx, hy)):
            verts.append((x * sx, y * sy, zsign * hz))
    faces = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
             (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    obj = _mesh(name, verts, faces, mat, collection, 'oak', max(range(3), key=lambda a: size[a]))
    obj.location = center; obj.rotation_euler.x = rotation
    mod = obj.modifiers.new('Soft machined solid oak edges', 'BEVEL')
    mod.width = bevel; mod.segments = 3
    mod = obj.modifiers.new('Weighted flat board normals', 'WEIGHTED_NORMAL')
    mod.keep_sharp = True; mod.weight = 40
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj


def _coords(half, radius, inner_count):
    # Cluster vertices at sewing corners; keep broad, nearly flat panels.
    core = half - radius
    values = [-half, -half + radius * .20, -half + radius * .55]
    values += [-core + 2 * core * i / inner_count for i in range(inner_count + 1)]
    values += [half - radius * .55, half - radius * .20, half]
    return sorted(set(round(v, 8) for v in values))


def _cushion(name, size, center, mat, collection, crown=.012, rotation=0, back=False):
    half = Vector([s / 2 for s in size]); radius = min(.033, half.z * .64, half.y * .5)
    xs = _coords(half.x, radius, 22 if back else 12)
    ys = _coords(half.y, radius, 3 if back else 12)
    zs = _coords(half.z, radius, 12 if back else 2)
    coords = [xs, ys, zs]; verts = []; faces = []; indexes = {}
    def point(i, j, k):
        key = (i, j, k)
        if key in indexes:
            return indexes[key]
        p = Vector((xs[i], ys[j], zs[k])); inner = half - Vector((radius,) * 3)
        q = Vector([max(-inner[a], min(inner[a], p[a])) for a in range(3)])
        delta = p - q
        p = q + delta.normalized() * radius
        if back:
            # Continuous raked back, restrained lumbar crown on its front.
            u, v = p.x / half.x, p.z / half.z
            bulge = crown * max(0, 1 - u*u) ** .65 * max(0, 1 - v*v) ** .65
            p.y -= bulge * max(0, -p.y / half.y)
            # Shallow edge tension drawn into the upholstered corners.
            for side in (-1, 1):
                d = half.x - side * p.x
                crease = math.exp(-((p.z + half.z * .64 - d * .5) / .014) ** 2) * math.exp(-d / .11)
                p.y += .0018 * crease * max(0, -p.y / half.y)
        else:
            u, v = p.x / half.x, p.y / half.y
            panel = max(0, 1 - u*u) ** .70 * max(0, 1 - v*v) ** .70
            top = max(0, p.z / half.z)
            p.z += crown * panel * top
            # Fine compression creases only near the front corners; these are
            # real 1-2 mm surface displacements, not export-lost shader noise.
            for side in (-1, 1):
                dx = half.x - side * p.x; dy = p.y + half.y
                for offset, amp in ((.027, .0017), (.062, .0010)):
                    line = dy - .65 * dx - offset
                    crease = math.exp(-(line / .013) ** 2) * math.exp(-(dx + dy) / .15)
                    p.z -= amp * crease * top
            # Seat front subtly compresses between its welt and lower seam.
            p.y += .0018 * math.cos(p.x * 29) * math.exp(-((p.z / half.z) / .5) ** 2) * max(0, -p.y / half.y)
        indexes[key] = len(verts); verts.append(tuple(p)); return indexes[key]
    limits = [len(a) - 1 for a in coords]
    for fixed in range(3):
        axes = [a for a in range(3) if a != fixed]
        for side in (0, limits[fixed]):
            for a in range(limits[axes[0]]):
                for b in range(limits[axes[1]]):
                    face = []
                    for da, db in ((0, 0), (1, 0), (1, 1), (0, 1)):
                        key = [0, 0, 0]; key[fixed] = side
                        key[axes[0]] = a + da; key[axes[1]] = b + db
                        face.append(point(*key))
                    # x/z parameterization points out on its negative face.
                    positive_order = fixed != 1
                    if (side == limits[fixed]) != positive_order:
                        face.reverse()
                    faces.append(face)
    obj = _mesh(name, verts, faces, mat, collection, 'linen')
    obj.location = center; obj.rotation_euler.x = rotation
    for face in obj.data.polygons:
        face.use_smooth = True
    obj['construction'] = 'Rounded rectangular sewn cover; corner tension and crowned panel in editable mesh'
    return obj


def _welt(name, size, center, mat, collection, z, rotation=0, vertical=False):
    hx, hy = size[0] / 2, size[1] / 2
    radius = .034
    points = []
    for cx, cy, start in ((hx-radius, hy-radius, 0), (-hx+radius, hy-radius, 90),
                          (-hx+radius, -hy+radius, 180), (hx-radius, -hy+radius, 270)):
        for i in range(9):
            angle = math.radians(start + i * 90 / 8)
            x, y = cx + radius * math.cos(angle), cy + radius * math.sin(angle)
            points.append((x, z, y) if vertical else (x, y, z))
    curve = _tag(bpy.data.curves.new(name + ' editable welt path', 'CURVE'))
    curve.dimensions = '3D'; curve.resolution_u = 1
    curve.bevel_depth = PARAMETERS['welt_radius']; curve.bevel_resolution = 1
    spline = curve.splines.new('POLY'); spline.points.add(len(points) - 1)
    for p, co in zip(spline.points, points):
        p.co = (*co, 1)
    spline.use_cyclic_u = True
    obj = _tag(bpy.data.objects.new(name, curve)); collection.objects.link(obj)
    obj.location = center; obj.rotation_euler.x = rotation
    curve.materials.append(mat)
    return obj


def _peg(name, center, axis, mat, collection):
    # Small solid oak drawbore plugs, no bright decorative metal dots.
    verts, faces = [], []
    for depth in (-.0012, .0012):
        for i in range(12):
            angle = 2 * math.pi * i / 12
            p = [0.0, 0.0, 0.0]; p[axis] = depth
            other = [a for a in range(3) if a != axis]
            p[other[0]] = .004 * math.cos(angle); p[other[1]] = .004 * math.sin(angle)
            verts.append(p)
    faces += [tuple(reversed(range(12))), tuple(range(12, 24))]
    faces += [(i, (i+1)%12, (i+1)%12+12, i+12) for i in range(12)]
    obj = _mesh(name, verts, faces, mat, collection, 'oak', axis)
    obj.location = center
    return obj


def _canonical_export(path):
    raw = path.read_bytes(); n = struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:20+n])
    for mat in doc.get('materials', []):
        mat['name'] = mat.get('extras', {}).get('sofa_material_key', mat['name'])
    _safe_export_extras(doc)
    encoded = json.dumps(doc, separators=(',', ':'), ensure_ascii=False).encode()
    encoded += b' ' * ((-len(encoded)) % 4)
    tail = raw[20+n:]
    path.write_bytes(struct.pack('<III', 0x46546c67, 2, 20+len(encoded)+len(tail))
                     + struct.pack('<II', len(encoded), 0x4e4f534a) + encoded + tail)
    return doc


def get_objects():
    return [o for o in _RUNTIME['owned'] if _live(o) and isinstance(o, bpy.types.Object)
            and not o.get('export_copy')]


def _evaluated_bounds(objects):
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    depsgraph.update()
    lo = Vector((math.inf,) * 3); hi = Vector((-math.inf,) * 3)
    for obj in objects:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        try:
            world = evaluated.matrix_world.copy()
            for vertex in mesh.vertices:
                point = world @ vertex.co
                for axis in range(3):
                    lo[axis] = min(lo[axis], point[axis])
                    hi[axis] = max(hi[axis], point[axis])
        finally:
            evaluated.to_mesh_clear()
    return lo, hi


def _require_envelope(lo, hi, label):
    expected_lo = (-1.0, -.425, 0)
    expected_hi = (1.0, .425, .780)
    error = max(abs(lo[a]-expected_lo[a]) for a in range(3))
    error = max(error, max(abs(hi[a]-expected_hi[a]) for a in range(3)))
    if error > .00002:
        raise RuntimeError(f'{label} measured envelope error {error:.8f}m: {list(lo)} to {list(hi)}')
    return [hi[a]-lo[a] for a in range(3)]


def _exported_bounds(path):
    """Read real FLOAT POSITION bytes and node transforms, not accessor claims."""
    raw = path.read_bytes(); json_size = struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:20+json_size]); binary_start = 28 + json_size
    lo = Vector((math.inf,) * 3); hi = Vector((-math.inf,) * 3)
    def visit(index, parent):
        node = doc['nodes'][index]
        if 'matrix' in node:
            values = node['matrix']
            local = Matrix([[values[col*4+row] for col in range(4)] for row in range(4)])
        else:
            rotation = node.get('rotation', [0, 0, 0, 1])
            local = Matrix.Translation(Vector(node.get('translation', [0, 0, 0])))
            local = local @ Quaternion((rotation[3], *rotation[:3])).to_matrix().to_4x4()
            local = local @ Matrix.Diagonal((*node.get('scale', [1, 1, 1]), 1))
        world = parent @ local
        if 'mesh' in node:
            for primitive in doc['meshes'][node['mesh']]['primitives']:
                accessor = doc['accessors'][primitive['attributes']['POSITION']]
                if accessor['componentType'] != 5126 or accessor['type'] != 'VEC3':
                    raise RuntimeError('Unexpected experimental position encoding')
                view = doc['bufferViews'][accessor['bufferView']]
                start = binary_start + view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
                stride = view.get('byteStride', 12)
                for i in range(accessor['count']):
                    point = world @ Vector(struct.unpack_from('<3f', raw, start+i*stride))
                    # glTF is Y-up; authored source is Z-up, forward -Y.
                    point = Vector((point.x, -point.z, point.y))
                    for axis in range(3):
                        lo[axis] = min(lo[axis], point[axis])
                        hi[axis] = max(hi[axis], point[axis])
        for child in node.get('children', []):
            visit(child, world)
    for index in doc['scenes'][doc.get('scene', 0)].get('nodes', []):
        visit(index, Matrix.Identity(4))
    return lo, hi


def build(root=None):
    root = Path(root) if root else ROOT
    source = root / 'assets-source/experiments/realism-lab/sofa-refined.blend'
    export = root / 'public/experiments/realism-lab/sofa-refined.glb'
    source.parent.mkdir(parents=True, exist_ok=True); export.parent.mkdir(parents=True, exist_ok=True)
    previous_scene = bpy.context.window.scene
    # A repeat build can replace its previous scene while retaining all other
    # scenes. Move away before removing an active owned scene.
    owned_scenes = [d for d in _RUNTIME['owned'] if _live(d) and isinstance(d, bpy.types.Scene)]
    if previous_scene in owned_scenes:
        previous_scene = next((s for s in bpy.data.scenes if s not in owned_scenes), None)
        if previous_scene is None:
            previous_scene = bpy.data.scenes.new('Preserved workspace')
        bpy.context.window.scene = previous_scene
    _cleanup()
    scene = _tag(bpy.data.scenes.new('Nook realism lab sofa - refined'))
    coll = _tag(bpy.data.collections.new(OWNER)); scene.collection.children.link(coll)
    scene.unit_settings.system = 'METRIC'; scene.unit_settings.scale_length = 1
    scene['parameters_json'] = json.dumps(PARAMETERS)
    scene['reference_note'] = 'Generated multi-view concept informs construction; measured catalog envelope is authoritative.'
    bpy.context.window.scene = scene
    try:
        mats = _materials(root); wood, fabric, stitch, brass = [mats[k] for k in KEYS]
        # Integrated posts carry the armcaps; lower taper removes the baseline's
        # disconnected slab-and-feet construction. Front/back remain symmetric.
        for side in (-1, 1):
            for front in (-1, 1):
                _board(('Left' if side < 0 else 'Right') + (' front' if front < 0 else ' rear') + ' tapered continuous post',
                       (.057, .057, .624), (side*.950, front*.358, .312), wood, coll, .004, (.78,.80))
            _board(('Left' if side < 0 else 'Right') + ' chamfered arm cap',
                   (.100, .850, .033), (side*.950, 0, .6385), wood, coll, .009)
            _board(('Left' if side < 0 else 'Right') + ' mortised side rail',
                   (.041, .672, .081), (side*.950, 0, .2305), wood, coll, .0035)
            for j, y in enumerate((-.20, -.04, .12, .28)):
                _board(('Left' if side < 0 else 'Right') + f' arm spindle {j+1}',
                       (.024, .032, .342), (side*.950, y, .451), wood, coll, .003)
            for front in (-1, 1):
                _peg(f'Oak drawbore side {side} {front}', (side*.979, front*.358, .231), 0, wood, coll)
                _peg(f'Oak drawbore front {side} {front}', (side*.950, front*.387, .245), 1, wood, coll)
        for y, label in ((-.358, 'Front'), (.358, 'Rear')):
            _board(label + ' slender structural apron', (1.844, .042, .081), (0, y, .2305), wood, coll, .003)
        # Credible load path: seat slats and inset bearers are visible below and
        # between cushions without a monolithic wooden plinth.
        for side in (-1, 1):
            _board(f'Inner cushion bearing ledge {side}', (1.836, .030, .026), (0, side*.321, .257), wood, coll, .002)
        for j in range(13):
            _board(f'Seat support slat {j+1:02d}', (.085, .655, .022), (-.834+j*.139, 0, .279), wood, coll, .002)
        # Rear slats are individually editable and physically support the back.
        rake = -math.radians(PARAMETERS['back_rake_degrees'])
        for j in range(9):
            _board(f'Raked rear support slat {j+1:02d}', (.040, .026, .353), (-.836+j*.209, .365, .498), wood, coll, .003, rotation=rake)
        _board('Rear upper tying rail', (1.841, .036, .044), (0,.397,.676), wood, coll,.004)
        seat_size = (PARAMETERS['seat_width'], PARAMETERS['seat_depth'], PARAMETERS['seat_thickness'])
        # Slat top is .279 + .022/2 = .290 m. The cushion's flat
        # underside must touch that plane, including after envelope scaling.
        seat_center_z = .279 + .022 / 2 + seat_size[2] / 2
        for j, x in enumerate((-.604, 0, .604)):
            center = (x, -.029, seat_center_z)
            _cushion(f'Seat {j+1} crowned tailored linen', seat_size, center, fabric, coll, PARAMETERS['seat_crown'])
            _welt(f'Seat {j+1} upper tone-on-tone welt', (seat_size[0]-.008, seat_size[1]-.008), center, stitch, coll, .054)
            _welt(f'Seat {j+1} lower sewn seam', (seat_size[0]-.013, seat_size[1]-.013), center, stitch, coll, -.057)
        back_size = (1.826, .132, .371)
        back_center = (0, .280, .580)
        _cushion('Continuous raked back with lumbar crown', back_size, back_center, fabric, coll, .017, rake, True)
        _welt('Back perimeter tone-on-tone welt', (back_size[0]-.013, back_size[2]-.013), back_center, stitch, coll, -.060, rake, True)
        # Recessed brass hardware lives beneath the support structure; preserve
        # the existing independently recolorable fourth material key.
        for x in (-.85, .85):
            _peg(f'Underside recessed brass fastener {x}', (x, -.320, .242), 2, brass, coll)

        original_objects = list(coll.objects)
        lo, hi = _evaluated_bounds(original_objects)
        # Global, minute authored-envelope normalization applies identically to
        # named source parts and evaluated exports. No hidden bounding proxies.
        scale = Vector([PARAMETERS['envelope_m'][a] / (hi[a]-lo[a]) for a in range(3)])
        origin = Vector(((lo.x+hi.x)/2, (lo.y+hi.y)/2, lo.z))
        transform = Matrix.Diagonal((*scale, 1)) @ Matrix.Translation(-origin)
        original_matrices = {obj: obj.matrix_world.copy() for obj in original_objects}
        for obj in original_objects:
            obj.matrix_world = transform @ original_matrices[obj]
        # Blender decomposes object matrices back into location/rotation/scale;
        # anisotropic scaling of the raked back introduces a tiny shear-loss.
        # Correct from measured geometry, bounded to three small iterations.
        for _ in range(3):
            actual_lo, actual_hi = _evaluated_bounds(original_objects)
            target_lo = Vector((-1, -.425, 0))
            current_size = actual_hi - actual_lo
            correction_scale = Vector([PARAMETERS['envelope_m'][a] / current_size[a] for a in range(3)])
            if max(abs(current_size[a] - PARAMETERS['envelope_m'][a]) for a in range(3)) < .000002:
                break
            correction = (Matrix.Translation(target_lo)
                          @ Matrix.Diagonal((*correction_scale, 1))
                          @ Matrix.Translation(-actual_lo))
            matrices = {obj: obj.matrix_world.copy() for obj in original_objects}
            for obj in original_objects:
                obj.matrix_world = correction @ matrices[obj]
        measured_source = _require_envelope(*_evaluated_bounds(original_objects), 'Editable source')
        depsgraph = bpy.context.evaluated_depsgraph_get(); depsgraph.update()
        scene['source_parts'] = len(original_objects)
        scene['measured_envelope_m'] = measured_source
        bpy.data.libraries.write(str(source), {scene}, fake_user=True, compress=True)

        copies = []
        for obj in original_objects:
            evaluated = obj.evaluated_get(depsgraph)
            mesh = _tag(bpy.data.meshes.new_from_object(evaluated, depsgraph=depsgraph))
            # Bake evaluated world transforms into temporary geometry. All
            # export copies then share an identity matrix before joining.
            mesh.transform(evaluated.matrix_world.copy())
            mesh.update()
            copy = _tag(bpy.data.objects.new('Export ' + obj.name, mesh))
            copy['export_copy'] = True; coll.objects.link(copy)
            copy.matrix_world = Matrix.Identity(4); copies.append(copy)
        _require_envelope(*_evaluated_bounds(copies), 'Evaluated export copies')
        for obj in original_objects:
            obj.select_set(False)
        for obj in copies:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = copies[0]
        bpy.context.view_layer.update()
        bpy.ops.object.join()
        joined = bpy.context.object; joined.name = 'sofa-refined'
        _require_envelope(*_evaluated_bounds([joined]), 'Joined export')
        joined.data.calc_loop_triangles(); triangles = len(joined.data.loop_triangles)
        if triangles > 30000:
            raise RuntimeError(f'Experimental sofa exceeds triangle budget: {triangles}')
        bpy.ops.export_scene.gltf(filepath=str(export), export_format='GLB', use_selection=True,
                                  use_active_scene=True, export_cameras=False, export_lights=False,
                                  export_apply=True, export_extras=True, export_image_format='AUTO',
                                  export_texcoords=True, export_normals=True, export_tangents=False,
                                  export_materials='EXPORT', export_yup=True)
        doc = _canonical_export(export)
        exported_lo, exported_hi = _exported_bounds(export)
        measured_export = _require_envelope(exported_lo, exported_hi, 'Actual exported GLB vertices')
        keys = sorted(m['name'] for m in doc['materials'])
        if keys != sorted(KEYS):
            raise RuntimeError('Material-key mismatch: ' + str(keys))
        for mat in doc['materials']:
            if mat['name'] in KEYS[:2]:
                pbr = mat['pbrMetallicRoughness']
                assert 'baseColorTexture' in pbr and 'metallicRoughnessTexture' in pbr and 'normalTexture' in mat
        if export.stat().st_size > 6_000_000:
            raise RuntimeError('Experimental source GLB exceeds 6 MB budget')
        metadata = {'sceneName': scene.name, 'source': str(source), 'glb': str(export),
                    'dimensionsM': measured_export, 'sourceDimensionsM': measured_source,
                    'boundsM': {'min': list(exported_lo), 'max': list(exported_hi)}, 'triangles': triangles,
                    'sourceParts': len(original_objects), 'materialKeys': keys,
                    'glbBytes': export.stat().st_size, 'blendBytes': source.stat().st_size,
                    'imageCount': len(doc.get('images', [])), 'parameters': PARAMETERS}
        (source.parent / 'sofa-refined-metadata.json').write_text(json.dumps(metadata, indent=2) + '\n')
        return metadata
    finally:
        for obj in list(coll.objects):
            if obj.get('export_copy'):
                bpy.data.objects.remove(obj, do_unlink=True)
        bpy.context.window.scene = previous_scene
