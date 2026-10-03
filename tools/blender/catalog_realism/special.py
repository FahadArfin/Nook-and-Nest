"""Additive construction details for explicitly reviewed catalog pieces.

Original objects, meshes, materials, UVs and images are never modified. Aquarium
additions use opaque casework material, stay inside the original envelope and
outside the union of the glass/water bounds. Pure plans are inspectable without
Blender; ``apply`` creates only the planned owned meshes in the supplied scene.
"""
import hashlib
import json
import math
from pathlib import Path
import re
import struct

SOFA_FAMILY = frozenset({'sofa', 'loveseat', 'track-sofa', 'channel-sofa', 'corner-pit-sofa',
                        'low-modular-sofa', 'metal-frame-sofa', 'modular-play-sofa', 'upholstered-pet-sofa',
                        'boneless-loveseat', 'boneless-chaise', 'left-chaise-sectional',
                        'right-chaise-sectional', 'modular-sectional', 'u-sectional'})
SUPPORTED = SOFA_FAMILY | frozenset({'armchair', 'anime-landscape-1', 'anime-landscape-2', 'anime-landscape-3',
                       'desktop-aquarium', 'planted-aquarium', 'reef-aquarium',
                       'door-closet-sliding', 'outdoor-round-conversation-table'})
AQUARIUMS = frozenset({'desktop-aquarium', 'planted-aquarium', 'reef-aquarium'})
EPSILON = 1e-7


def _name(value):
    return re.sub(r'\.\d+$', '', value).lower().replace(' ', '_')


def bounds(points):
    if not points or any(not math.isfinite(v) for point in points for v in point):
        raise ValueError('Finite nonempty geometry required')
    return {'min': [min(p[i] for p in points) for i in range(3)],
            'max': [max(p[i] for p in points) for i in range(3)]}


def contained(inner, outer):
    return all(inner['min'][i] >= outer['min'][i] - EPSILON and inner['max'][i] <= outer['max'][i] + EPSILON for i in range(3))


def separated(a, b, clearance=.0002):
    return any(a['max'][i] <= b['min'][i] - clearance or a['min'][i] >= b['max'][i] + clearance for i in range(3))


def _union(rows):
    return bounds([row['bounds'][side] for row in rows for side in ('min', 'max')])


def _one(rows, name):
    matches = [r for r in rows if _name(r['name']) == name]
    if len(matches) != 1:
        raise ValueError('Expected exactly one authored component: ' + name)
    return matches[0]


def _box(lo, hi):
    vertices = [(x, y, z) for x in (lo[0], hi[0]) for y in (lo[1], hi[1]) for z in (lo[2], hi[2])]
    return vertices, [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]


def _rounded_rectangle(width, depth, radius):
    result = []
    for cx, cy, start in [(width / 2 - radius, depth / 2 - radius, 0),
                          (-width / 2 + radius, depth / 2 - radius, math.pi / 2),
                          (-width / 2 + radius, -depth / 2 + radius, math.pi),
                          (width / 2 - radius, -depth / 2 + radius, math.pi * 1.5)]:
        for step in range(4):
            a = start + step * math.pi / 6
            result.append((cx + radius * math.cos(a), cy + radius * math.sin(a)))
    return result


def _rounded_box(lo, hi, radius):
    """Closed cover with three segments around each eased manufactured edge."""
    width, depth, height = [hi[i] - lo[i] for i in range(3)]
    radius = min(radius, width / 4, depth / 4, height / 4)
    center = [(lo[i] + hi[i]) / 2 for i in range(2)]
    levels = [(lo[2], radius), (lo[2] + radius * .134, radius * .5),
              (lo[2] + radius * .5, radius * .134), (lo[2] + radius, 0),
              (hi[2] - radius, 0), (hi[2] - radius * .5, radius * .134),
              (hi[2] - radius * .134, radius * .5), (hi[2], radius)]
    vertices = []
    for z, inset in levels:
        vertices.extend((center[0] + x, center[1] + y, z) for x, y in
                        _rounded_rectangle(width - 2 * inset, depth - 2 * inset, max(radius * .10, radius - inset)))
    count = 16
    faces = [(row * count + i, row * count + (i + 1) % count,
              (row + 1) * count + (i + 1) % count, (row + 1) * count + i)
             for row in range(len(levels) - 1) for i in range(count)]
    faces.extend([tuple(reversed(range(count))), tuple(range((len(levels) - 1) * count, len(levels) * count))])
    return vertices, faces


def _curved_rectangular_upright(control, width=.027, depth=.023):
    """Swept rounded extrusion through measured attachment locations."""
    path = []
    for index in range(len(control) - 1):
        a, b, c, d = control[max(0, index - 1)], control[index], control[index + 1], control[min(len(control) - 1, index + 2)]
        for step in range(5):
            t = step / 5
            path.append(tuple(.5 * ((2 * b[i]) + (-a[i] + c[i]) * t + (2 * a[i] - 5 * b[i] + 4 * c[i] - d[i]) * t*t
                                     + (-a[i] + 3 * b[i] - 3 * c[i] + d[i]) * t*t*t) for i in range(3)))
    path.append(tuple(control[-1]))
    profile = _rounded_rectangle(width, depth, .004)
    vertices = []
    for index, p in enumerate(path):
        a, b = path[max(0, index - 1)], path[min(len(path) - 1, index + 1)]
        dy, dz = b[1] - a[1], b[2] - a[2]
        length = math.hypot(dy, dz)
        if length < 1e-9:
            raise ValueError('Degenerate upright path')
        vertices.extend((p[0] + x, p[1] + y * dz / length, p[2] - y * dy / length) for x, y in profile)
    count = len(profile)
    faces = [(row * count + i, row * count + (i + 1) % count,
              (row + 1) * count + (i + 1) % count, (row + 1) * count + i)
             for row in range(len(path) - 1) for i in range(count)]
    faces.extend([tuple(reversed(range(count))), tuple(range((len(path) - 1) * count, len(path) * count))])
    return vertices, faces


def _lathe(profile, center=(0, 0), segments=64):
    """Closed annular Z profile with continuous circumference/height UVs."""
    vertices = [(center[0] + radius * math.cos(i * math.tau / segments),
                 center[1] + radius * math.sin(i * math.tau / segments), z)
                for radius, z in profile for i in range(segments)]
    faces, uv = [], []
    for level in range(len(profile)):
        nxt = (level + 1) % len(profile)
        radius_a, z_a = profile[level]; radius_b, z_b = profile[nxt]
        for i in range(segments):
            j = (i + 1) % segments
            faces.append((level * segments + i, level * segments + j, nxt * segments + j, nxt * segments + i))
            # Include radial distance when two profile levels share a height.
            # This keeps bearing faces' normal-map tangent coordinates valid.
            uv.append(((i / segments, z_a + radius_a), ((i + 1) / segments, z_a + radius_a),
                       ((i + 1) / segments, z_b + radius_b), (i / segments, z_b + radius_b)))
    return vertices, faces, uv


def _socket_head(center, radius, depth):
    """Front-facing Y-axis head with chamfer and a modeled recessed socket."""
    segments = 24
    rings = [(radius * .95, -.00025), (radius, depth * .7), (radius * .86, depth),
             (radius * .42, depth), (radius * .42, depth * .43)]
    vertices = []
    for level, (r, d) in enumerate(rings):
        for i in range(segments):
            angle = i * math.tau / segments
            if level >= 3:
                r = radius * .42 * math.cos(math.pi / 6) / math.cos((angle % (math.pi / 3)) - math.pi / 6)
            vertices.append((center[0] + r * math.cos(angle), center[1] - d, center[2] + r * math.sin(angle)))
    faces = []
    for level in range(len(rings) - 1):
        for i in range(segments):
            j = (i + 1) % segments
            faces.append((level * segments + i, level * segments + j, (level + 1) * segments + j, (level + 1) * segments + i))
    faces.append(tuple(reversed(range(segments))))
    faces.append(tuple(range((len(rings) - 1) * segments, len(rings) * segments)))
    return vertices, faces


def _spec(name, kind, key, geometry, source, evidence, uv=None):
    vertices, faces = geometry
    return {'name': name, 'kind': kind, 'materialKey': key, 'vertices': vertices, 'faces': faces,
            'bounds': bounds(vertices), 'sourceComponents': source, 'contactEvidence': evidence,
            'uvFaces': uv}


def _frame(rows):
    frame, art = _one(rows, 'slim_gallery_frame'), _one(rows, 'original_landscape_artwork')
    f, a = frame['bounds'], art['bounds']
    if not contained(a, f) and abs(a['min'][1] - f['min'][1]) > .003:
        raise ValueError('Artwork/frame relationship changed')
    outer = [f['min'][0] + .0008, f['max'][0] - .0008, f['min'][2] + .0008, f['max'][2] - .0008]
    inner = [a['min'][0] - .0007, a['max'][0] + .0007, a['min'][2] - .0007, a['max'][2] + .0007]
    if not (outer[0] < inner[0] < inner[1] < outer[1] and outer[2] < inner[2] < inner[3] < outer[3]):
        raise ValueError('No visible frame border available')
    vertices = []
    # All profile surfaces remain behind the original image plane. Four miter
    # corners follow one continuous rectangle; no trim crosses the image area.
    for mix, y in [(0, f['min'][1] + .0015), (.28, a['min'][1] + .00015),
                   (.72, a['min'][1] + .00025), (1, f['min'][1] + .0010),
                   (1, f['min'][1] + .0025), (0, f['min'][1] + .0025)]:
        x0, x1, z0, z1 = [o + (i - o) * mix for o, i in zip(outer, inner)]
        vertices.extend([(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)])
    faces = [(ring * 4 + i, ring * 4 + (i + 1) % 4, ((ring + 1) % 6) * 4 + (i + 1) % 4, ((ring + 1) % 6) * 4 + i)
             for ring in range(6) for i in range(4)]
    return [_spec('detail_casework_mitered_picture_profile', 'mitered-picture-frame-profile',
                  'modern-recess-charcoal', (vertices, faces), [frame['name'], art['name']],
                  {'outerRectangleXZ': outer, 'clearImageRectangleXZ': inner, 'imagePlaneY': a['min'][1],
                   'imageGeometryAndUV': 'retained unchanged'})]


def _aquarium(model_id, rows, envelope):
    glass = [r for r in rows if any(key in {'aquarium-clear-glass', 'aquarium-water-surface'} for key in r['materials'])]
    if len(glass) < 5:
        raise ValueError('Aquarium glass/water exclusion components missing')
    exclusion = _union(glass)
    result = []
    key = 'aquarium-charcoal-frame'
    if model_id == 'desktop-aquarium':
        base = _one(rows, 'tank_base_frame'); b = base['bounds']
        free_depth = b['min'][1] - envelope['min'][1]
        if free_depth < .001:
            raise ValueError('No exterior base detail allowance')
        depth = min(.0015, free_depth * .72)
        z = b['min'][2] + (min(b['max'][2], exclusion['min'][2]) - b['min'][2]) * .45
        for index, x in enumerate((b['min'][0] + .035, b['max'][0] - .035)):
            result.append(_spec('detail_fastener_aquarium_base_' + str(index + 1), 'exterior-base-socket-fastener', key,
                                _socket_head((x, b['min'][1], z), .0036, depth), [base['name']],
                                {'caseworkFaceY': b['min'][1], 'glassWaterExclusion': exclusion}))
        # A short raised registration bead belongs to the molded base shell.
        # It is in the spare exterior depth, never on the glass or substrate.
        lo = [b['min'][0] + .053, b['min'][1] - depth * .66, z - .0012]
        hi = [b['max'][0] - .053, b['min'][1] + .00025, z + .0012]
        result.append(_spec('detail_casework_aquarium_base_register', 'molded-base-register-bead', key,
                            _box(lo, hi), [base['name']], {'caseworkFaceY': b['min'][1], 'glassWaterExclusion': exclusion}))
    else:
        doors = [r for r in rows if _name(r['name']) == 'aquarium_cabinet_door']
        if len(doors) != 2:
            raise ValueError('Expected the two original aquarium cabinet doors')
        for door_index, door in enumerate(doors):
            b = door['bounds']; free_depth = b['min'][1] - envelope['min'][1]
            depth = min(.0018, free_depth * .65)
            if depth < .0007:
                raise ValueError('No exterior cabinet fastener allowance')
            x = b['min'][0] + .021 if door_index == 0 else b['max'][0] - .021
            for index, z in enumerate((b['min'][2] + .047, b['max'][2] - .047)):
                result.append(_spec('detail_fastener_aquarium_case_' + str(door_index + 1) + '_' + str(index + 1),
                                    'exterior-cabinet-socket-fastener', key, _socket_head((x, b['min'][1], z), .0038, depth),
                                    [door['name']], {'caseworkFaceY': b['min'][1], 'glassWaterExclusion': exclusion}))
    for addition in result:
        if not separated(addition['bounds'], exclusion):
            raise ValueError('Aquarium detail intersects protected tank envelope')
    return result


def _closet(rows):
    head = _one(rows, 'head_jamb'); h = head['bounds']
    tracks = [r for r in rows if _name(r['name']) == 'bypass_track']
    moving = [r for r in rows if r.get('motionRole') or _name(r['name']).startswith('sliding_leaf_')]
    if len(tracks) != 2 or len(moving) != 2:
        raise ValueError('Expected two static tracks and two preserved sliding leaves')
    leaf_top = max(r['bounds']['max'][2] for r in moving)
    result = []
    for track_index, track in enumerate(tracks):
        t = track['bounds']; bottom = t['max'][2] - .0005; top = h['min'][2] + .0005
        if not leaf_top + .002 < bottom < top or top - bottom > .025:
            raise ValueError('No clear track-to-header mounting space')
        for index, fraction in enumerate((.20, .80)):
            x = t['min'][0] + (t['max'][0] - t['min'][0]) * fraction
            y = (t['min'][1] + t['max'][1]) / 2
            result.append(_spec('detail_casework_closet_track_bracket_' + str(track_index + 1) + '_' + str(index + 1),
                                'fixed-bypass-track-header-bracket', 'variant-surface-metal',
                                _box([x - .015, y - .006, bottom], [x + .015, y + .006, top]),
                                [track['name'], head['name']], {'leafTopZ': leaf_top, 'trackTopZ': t['max'][2], 'headUndersideZ': h['min'][2]}))
            result.append(_spec('detail_fastener_closet_track_bracket_' + str(track_index + 1) + '_' + str(index + 1),
                                'fixed-track-bracket-socket-fastener', 'variant-surface-metal',
                                _socket_head((x, y - .006, (bottom + top) / 2), min(.0022, (top - bottom) * .28), .0011),
                                [track['name'], head['name']], {'leafTopZ': leaf_top, 'staticHardware': True}))
    return result


def _conversation_table(rows):
    core, top = _one(rows, 'stone_pedestal_core'), _one(rows, 'broad_stone_tabletop')
    c, t = core['bounds'], top['bounds']
    bottom, upper = c['max'][2] - .001, t['min'][2] + .001
    if not .003 < upper - bottom < .030:
        raise ValueError('Pedestal/tabletop joint dimensions changed')
    radius = min(c['max'][i] - c['min'][i] for i in (0, 1)) / 2
    center = [(c['min'][i] + c['max'][i]) / 2 for i in (0, 1)]
    profile = [(radius * .84, bottom), (radius + .010, bottom), (radius + .014, bottom + .002),
               (radius + .014, upper - .002), (radius + .010, upper), (radius * .84, upper)]
    vertices, faces, uv = _lathe(profile, center)
    return [_spec('detail_casework_stone_table_bearing_collar', 'profiled-pedestal-bearing-collar',
                  'outdoor-honed-basalt', (vertices, faces), [core['name'], top['name']],
                  {'coreTopZ': c['max'][2], 'tabletopUndersideZ': t['min'][2], 'jointGapM': t['min'][2] - c['max'][2]}, uv)]


def _sofa_back(rows, envelope):
    platform = _one(rows, 'connected_upholstered_platform')
    backs = [r for r in rows if _name(r['name']) == 'angled_back_cushion']
    arms = sorted([r for r in rows if _name(r['name']) == 'integrated_track_arm'], key=lambda r: r['bounds']['min'][0])
    if not backs or len(arms) != 2 or any(any(word in _name(r['name']) for word in
            ('back_carcass', 'supporting_back', 'rear_upholstered_frame', 'wooden_back_frame', 'tufted_back')) for r in rows):
        raise ValueError('Supporting sofa back requires reviewed platform, cushions and two track arms')
    p, b = platform['bounds'], _union(backs)
    key = platform['materials'][0]
    if len(platform['materials']) != 1 or any(r['materials'] != [key] for r in backs + arms):
        raise ValueError('Sofa support must retain the exact existing shared upholstery material')
    # A common rear plane is required, including a chaise only when it uses the
    # same authored straight-backed platform construction.
    if max(r['bounds']['max'][1] for r in backs) - min(r['bounds']['max'][1] for r in backs) > .012:
        raise ValueError('Nonlinear sectional back needs an individually authored support recipe')
    left, right = arms[0]['bounds'], arms[1]['bounds']
    if not left['max'][0] < right['min'][0] or min(left['max'][1], right['max'][1]) < b['min'][1]:
        raise ValueError('Track arms do not attach to the rear cushion assembly')
    back_y = min(envelope['max'][1] - .002, max(left['max'][1], right['max'][1]) + .007)
    depth = min(.115, max(.060, (b['max'][1] - b['min'][1]) * .45))
    front_y = back_y - depth
    low_z = p['max'][2] - min(.025, (p['max'][2] - p['min'][2]) * .18)
    high_z = b['min'][2] + (b['max'][2] - b['min'][2]) * .63
    overlap = min(.018, (left['max'][0] - left['min'][0]) * .14, (right['max'][0] - right['min'][0]) * .14)
    lo, hi = [left['max'][0] - overlap, front_y, low_z], [right['min'][0] + overlap, back_y, high_z]
    if not (front_y < p['max'][1] - .012 and low_z < min(left['max'][2], right['max'][2]) and high_z > b['min'][2] + .04):
        raise ValueError('Back carcass would not contact its supporting platform and arms')
    radius = min(.014, depth * .14)
    result = _spec('detail_casework_continuous_upholstered_back', 'continuous-upholstered-supporting-back', key,
                   _rounded_box(lo, hi, radius), [platform['name']] + [r['name'] for r in backs + arms],
                   {'platformBounds': p, 'leftArmBounds': left, 'rightArmBounds': right, 'backCushionBounds': b,
                    'platformOverlapM': p['max'][2] - low_z, 'armOverlapM': overlap,
                    'bevelSegments': 3, 'coverConstruction': 'Closed face, rear panel and eased boxing; existing cushion covers untouched.'})
    result['smooth'] = True
    return [result]


def _armchair_supports(rows):
    pan, back = _one(rows, 'structural_seat_pan'), _one(rows, 'tailored_back_cushion')
    if len([r for r in rows if _name(r['name']) == 'arm_support']) != 2:
        raise ValueError('Armchair mounting recipe requires the authored metal arm construction')
    p, b = pan['bounds'], back['bounds']
    feet = [r for r in rows if _name(r['name']) == 'aluminum_foot' and r['bounds']['min'][1] > p['min'][1] + (p['max'][1] - p['min'][1]) * .55]
    if len(feet) != 2:
        raise ValueError('Expected exactly two existing rear metal legs')
    if any('back_upright' in _name(r['name']) or 'back_mount' in _name(r['name']) for r in rows):
        raise ValueError('Existing back support must not be duplicated')
    result = []
    for index, foot in enumerate(sorted(feet, key=lambda row: row['bounds']['min'][0])):
        f = foot['bounds']; key = foot['materials'][0]
        x = (f['min'][0] + f['max'][0]) / 2
        height = b['max'][2] - b['min'][2]
        rear_lower = b['max'][1] - height * .12
        controls = [(x, (f['min'][1] + f['max'][1]) / 2, f['max'][2] - .023),
                    (x, p['max'][1] - .007, p['max'][2] - .009),
                    (x, rear_lower + height * .12 * .24, b['min'][2] + height * .24),
                    (x, rear_lower + height * .12 * .69, b['min'][2] + height * .69)]
        result.append(_spec('detail_casework_armchair_back_upright_' + str(index + 1), 'continuous-metal-back-mount-upright',
                            key, _curved_rectangular_upright(controls), [foot['name'], pan['name'], back['name']],
                            {'rearLegBounds': f, 'seatPanBounds': p, 'backCushionBounds': b,
                             'attachmentCenters': controls, 'sectionWidthM': .027, 'sectionDepthM': .023}))
        result[-1]['smooth'] = True
    return result


def plan(model_id, rows):
    """Return original additive mesh descriptions from measured source parts."""
    if model_id not in SUPPORTED:
        return []
    rows = [r for r in rows if r.get('bounds')]
    envelope = _union(rows)
    if model_id in AQUARIUMS:
        result = _aquarium(model_id, rows, envelope)
    elif model_id.startswith('anime-landscape-'):
        result = _frame(rows)
    elif model_id == 'door-closet-sliding':
        result = _closet(rows)
    elif model_id in SOFA_FAMILY:
        result = _sofa_back(rows, envelope)
    elif model_id == 'armchair':
        result = _armchair_supports(rows)
    else:
        result = _conversation_table(rows)
    for addition in result:
        if not addition['name'].startswith(('detail_casework_', 'detail_fastener_')):
            raise ValueError('Unexpected detail namespace')
        if not contained(addition['bounds'], envelope):
            raise ValueError('Additive detail exceeded source dimensions: ' + addition['name'])
        addition['originalEnvelope'] = envelope
    return result


def _opaque(material):
    ext = material.get('extensions', {})
    return (material.get('alphaMode', 'OPAQUE') == 'OPAQUE'
            and material.get('pbrMetallicRoughness', {}).get('baseColorFactor', [1, 1, 1, 1])[3] == 1
            and not any(material.get('emissiveFactor', []))
            and not any(k in ext for k in ('KHR_materials_transmission', 'KHR_materials_volume', 'KHR_materials_unlit')))


def _mesh_uv(mesh, coords=None):
    uv = mesh.uv_layers.new(name='UVMap')
    for face in mesh.polygons:
        axes = [axis for axis in range(3) if axis != max(range(3), key=lambda axis: abs(face.normal[axis]))]
        for corner, loop in enumerate(face.loop_indices):
            p = mesh.vertices[mesh.loops[loop].vertex_index].co
            uv.data[loop].uv = coords[face.index][corner] if coords else (p[axes[0]], p[axes[1]])
    uv.active_render = True
    mesh.uv_layers.active = uv


def apply(root, scene, item, material_keys, object_names):
    """Only add planned owned detail objects; all original data stays intact."""
    import bpy
    model_id = item['id']
    if model_id not in SUPPORTED:
        return []
    data = (Path(root) / 'public/models/furniture' / (model_id + '.glb')).read_bytes()
    baseline = json.loads(data[20:20 + struct.unpack_from('<I', data, 12)[0]])
    baseline_materials = {m['name']: m for m in baseline['materials']}
    rows, available = [], {}
    original = list(scene.objects)
    for obj in original:
        if obj.type != 'MESH' or not obj.data.vertices:
            continue
        keys = [material_keys[m.name] for m in obj.data.materials if m]
        for material in obj.data.materials:
            if material:
                available.setdefault(material_keys[material.name], material)
        rows.append({'name': object_names.get(obj.name, obj.name), 'materials': keys,
                     'bounds': bounds([tuple(obj.matrix_world @ v.co) for v in obj.data.vertices]),
                     'motionRole': obj.get('motion_role')})
    additions = plan(model_id, rows)
    for addition in additions:
        key = addition['materialKey']
        if key not in available or key not in baseline_materials or not _opaque(baseline_materials[key]):
            raise ValueError('Detail requires its existing opaque casework material: ' + key)
        if any(object_names.get(o.name, o.name) == addition['name'] for o in original):
            raise ValueError('Additive recipe was already applied')
    owned, changes = [], []
    try:
        for addition in additions:
            mesh = bpy.data.meshes.new(addition['name'] + '_editable_mesh')
            obj = bpy.data.objects.new(addition['name'], mesh)
            owned.append((obj, mesh))
            scene.collection.objects.link(obj)
            mesh.from_pydata(addition['vertices'], [], addition['faces'])
            mesh.materials.append(available[addition['materialKey']]); mesh.update()
            if addition.get('smooth'):
                for polygon in mesh.polygons:
                    polygon.use_smooth = True
            _mesh_uv(mesh, addition['uvFaces'])
            mesh.calc_loop_triangles()
            obj['material_key'] = addition['materialKey']
            obj['catalog_realism_added_detail'] = True
            obj['catalog_realism_recipe'] = addition['kind']
            object_names[obj.name] = addition['name']
            digest = hashlib.sha256()
            for vertex in mesh.vertices:
                digest.update(struct.pack('<3f', *vertex.co))
            for triangle in mesh.loop_triangles:
                digest.update(struct.pack('<3I', *triangle.vertices))
            changes.append({'kind': addition['kind'], 'newComponent': addition['name'],
                            'materialKey': addition['materialKey'], 'sourceComponents': addition['sourceComponents'],
                            'contactEvidence': addition['contactEvidence'], 'geometryChanged': True,
                            'originalGeometry': 'unchanged; additive detail only',
                            'added': {'sha256': digest.hexdigest(), 'vertices': len(mesh.vertices),
                                      'triangles': len(mesh.loop_triangles), 'bounds': addition['bounds']}})
        return changes
    except Exception:
        for obj, mesh in reversed(owned):
            object_names.pop(obj.name, None)
            bpy.data.objects.remove(obj, do_unlink=True)
            if mesh.users == 0:
                bpy.data.meshes.remove(mesh)
        raise
