"""Measured, editable construction repair for the original table lamp only.

The existing shade object is retained. Its measured radial bevel profile becomes
a 72-sided, 1.5 mm hollow cloth shell; all original UV layer names and materials
are transferred. Internal support parts reuse the original exact material keys.
No Blender operators, external assets, material edits or other model recipes.
"""
import math
from pathlib import Path
import runpy

TOLERANCE = .000002
SHADE = 'table_lamp_linen_shade'
NECK = 'table_lamp_neck'


def bounds(points):
    if not points or any(not math.isfinite(v) for p in points for v in p):
        raise ValueError('Lamp geometry must be finite and nonempty')
    return {'min': [min(p[i] for p in points) for i in range(3)],
            'max': [max(p[i] for p in points) for i in range(3)]}


def _drift(a, b):
    return max(abs(a[k][i] - b[k][i]) for k in ('min', 'max') for i in range(3))


def lathe(profile, center=(0, 0), segments=72, ratio_y=1, closed=False):
    """Revolve ordered (radius, Z) points; closed joins the section ends.

    A hollow shade uses one closed annular cross-section. No face spans either
    opening. Cardinal samples make its measured XY envelope exact.
    """
    if segments < 12 or segments % 4 or len(profile) < 2:
        raise ValueError('Lathe needs a bounded section and cardinal samples')
    if any(r <= 0 or not math.isfinite(r + z) for r, z in profile):
        raise ValueError('Positive finite lathe radii required')
    vertices = [(center[0] + r * math.cos(i * math.tau / segments),
                 center[1] + r * ratio_y * math.sin(i * math.tau / segments), z)
                for r, z in profile for i in range(segments)]
    faces = []
    for row in range(len(profile) if closed else len(profile) - 1):
        nxt = (row + 1) % len(profile)
        faces.extend((row * segments + i, row * segments + (i + 1) % segments,
                      nxt * segments + (i + 1) % segments, nxt * segments + i)
                     for i in range(segments))
    if not closed:
        faces += [tuple(reversed(range(segments))),
                  tuple(range((len(profile) - 1) * segments, len(profile) * segments))]
    return vertices, faces


def hollow_shade(points, thickness=.0015, segments=72):
    """Recover the authored lathe levels instead of inventing a new silhouette."""
    box = bounds(points)
    cx, cy = [(box['min'][i] + box['max'][i]) / 2 for i in (0, 1)]
    rx, ry = [(box['max'][i] - box['min'][i]) / 2 for i in (0, 1)]
    levels = {}
    for x, y, z in points:
        levels.setdefault(round(z, 6), []).append((x, y, z))
    if not 3 <= len(levels) <= 16 or min(rx, ry) < thickness * 8:
        raise ValueError('Expected the original simple beveled table-lamp lathe')
    profile = [(max(math.hypot((p[0] - cx) / rx, (p[1] - cy) / ry) for p in group),
                sum(p[2] for p in group) / len(group)) for _, group in sorted(levels.items())]
    maximum = max(r for r, z in profile)
    outer = [(r * rx / maximum, z) for r, z in profile]
    # The original top/bottom faces lie at the source extrema, including small
    # float variation. Reuse those extrema exactly before shell construction.
    outer[0] = (outer[0][0], box['min'][2])
    outer[-1] = (outer[-1][0], box['max'][2])
    if not .35 < outer[-1][0] / outer[0][0] < .85:
        raise ValueError('The source is not the reviewed tapered linen shade')
    section = outer + [(r - thickness, z) for r, z in reversed(outer)]
    vertices, faces = lathe(section, (cx, cy), segments, ry / rx, closed=True)
    if _drift(box, bounds(vertices)) > TOLERANCE:
        raise ValueError('Hollow shade changed the original component envelope')
    return {'vertices': vertices, 'faces': faces, 'bounds': box, 'profile': outer,
            'center': [cx, cy], 'ratioY': ry / rx, 'thicknessM': thickness}


def _rod(start, end, radius, segments=12):
    direction = [end[i] - start[i] for i in range(3)]
    length = math.sqrt(sum(v * v for v in direction))
    if length <= 0:
        raise ValueError('Support rod needs two different endpoints')
    axis = [v / length for v in direction]
    ref = [1, 0, 0] if abs(axis[0]) < .8 else [0, 1, 0]
    cross = lambda a, b: [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]
    u = cross(axis, ref); norm = math.sqrt(sum(x*x for x in u)); u = [x/norm for x in u]
    v = cross(axis, u)
    vertices = [tuple(p[j] + radius*(u[j]*math.cos(i*math.tau/segments) + v[j]*math.sin(i*math.tau/segments)) for j in range(3))
                for p in (start, end) for i in range(segments)]
    faces = [(i, (i+1)%segments, segments+(i+1)%segments, segments+i) for i in range(segments)]
    faces += [tuple(reversed(range(segments))), tuple(range(segments, segments*2))]
    return vertices, faces


def support_plan(shade, neck_bounds):
    cx, cy = shade['center']; lo, hi = shade['bounds']['min'][2], shade['bounds']['max'][2]
    height = hi - lo
    socket_bottom, socket_top = lo + height*.08, lo + height*.24
    if neck_bounds['max'][2] >= socket_bottom:
        raise ValueError('Unexpected source stem/socket overlap')
    result = []
    def add(name, key, geometry, contact):
        points, faces = geometry
        result.append({'name': 'detail_lamp_' + name, 'materialKey': key,
                       'vertices': points, 'faces': faces, 'bounds': bounds(points), 'contactEvidence': contact})
    add('socket_stem', 'wood-dark', lathe([(.006, neck_bounds['max'][2]-.001), (.006, socket_bottom+.002)], (cx, cy), 24),
        'Stem overlaps the existing neck and socket by 1–2 mm.')
    add('socket', 'wood-dark', lathe([(.013, socket_bottom), (.014, socket_bottom+.003),
        (.014, socket_top-.003), (.012, socket_top)], (cx, cy), 32), 'Socket seats around stem and supports the bulb neck.')
    bulb_profile = [(.010, socket_top-.003), (.011, socket_top+.009), (.020, socket_top+.018),
                    (.027, socket_top+.032), (.028, socket_top+.046), (.025, socket_top+.059),
                    (.018, socket_top+.069), (.009, socket_top+.076), (.0015, socket_top+.079)]
    add('bulb', 'linen-textured', lathe(bulb_profile, (cx, cy), 48), 'Closed pear bulb seats 3 mm into the socket; no emission or new key.')
    # Three nearly horizontal spokes meet the inner shell at its measured
    # lower bevel level. Their top is below the bulb's widest portion.
    radius, z = shade['profile'][1]
    radius -= shade['thicknessM'] + .0005
    inner_z = socket_bottom + .006
    for index in range(3):
        angle = index*math.tau/3 + math.pi/6
        end = (cx+radius*math.cos(angle), cy+radius*shade['ratioY']*math.sin(angle), z+.0015)
        add('spider_' + str(index+1), 'wood-dark', _rod((cx+.011*math.cos(angle), cy+.011*math.sin(angle), inner_z), end, .0015),
            'Three 3 mm round spokes connect the socket collar to the lower inner shade ring.')
    return result


def apply(root, scene, item, material_keys, object_names):
    """Return measured change receipts; only the exact table-lamp is eligible."""
    if item['id'] != 'table-lamp':
        return []
    import bpy
    from mathutils import Vector
    helper = runpy.run_path(str(Path(root)/'tools/blender/catalog_realism/geometry.py'))
    original = [obj for obj in scene.objects if obj.type == 'MESH']
    by_name = {object_names.get(o.name, o.name): o for o in original}
    if SHADE not in by_name or NECK not in by_name:
        raise ValueError('The reviewed table-lamp components are missing')
    shade, neck = by_name[SHADE], by_name[NECK]
    if shade.modifiers or shade.data.shape_keys or shade.get('motion_role'):
        raise ValueError('Animated or modified lamp shade needs separate review')
    if [material_keys[m.name] for m in shade.data.materials] != ['linen-textured']:
        raise ValueError('The original shade material identity changed')
    available = {material_keys[m.name]: m for o in original for m in o.data.materials if m}
    envelope = bounds([tuple(o.matrix_world @ v.co) for o in original for v in o.data.vertices])
    plan = hollow_shade([tuple(shade.matrix_world @ v.co) for v in shade.data.vertices])
    additions = support_plan(plan, bounds([tuple(neck.matrix_world @ v.co) for v in neck.data.vertices]))
    for add in additions:
        if add['name'] in by_name or add['materialKey'] not in available:
            raise ValueError('Lamp support already exists or its original material is missing')
        if any(add['bounds']['min'][i] < envelope['min'][i] or add['bounds']['max'][i] > envelope['max'][i] for i in range(3)):
            raise ValueError('Internal lamp support exceeds the original envelope')
    before = helper['_snapshot'](shade); old_mesh = shade.data; owned = []
    replacement = bpy.data.meshes.new(SHADE + '_hollow_editable_mesh')
    try:
        inverse = shade.matrix_world.inverted()
        replacement.from_pydata([inverse @ Vector(p) for p in plan['vertices']], [], plan['faces'])
        for material in old_mesh.materials:
            replacement.materials.append(material)
        replacement.update()
        helper['_transfer_uvs'](shade, replacement, shade.matrix_world)
        for polygon in replacement.polygons:
            polygon.use_smooth = True
        shade.data = replacement
        changes = [{'kind': 'hollow-linen-shade', 'component': SHADE, 'segments': 72,
                    'wallThicknessM': plan['thicknessM'], 'openTopAndBottom': True,
                    'details': 'Original radial bevel profile, object, transforms, material keys and transferred UV layers retained.',
                    **helper['change_evidence'](before, helper['_snapshot'](shade))}]
        for add in additions:
            mesh = bpy.data.meshes.new(add['name']+'_editable_mesh')
            obj = bpy.data.objects.new(add['name'], mesh); owned.append((obj, mesh))
            scene.collection.objects.link(obj)
            mesh.from_pydata(add['vertices'], [], add['faces']); mesh.materials.append(available[add['materialKey']]); mesh.update()
            uv = mesh.uv_layers.new(name='UVMap')
            for polygon in mesh.polygons:
                polygon.use_smooth = True
                for loop in polygon.loop_indices:
                    co = mesh.vertices[mesh.loops[loop].vertex_index].co
                    uv.data[loop].uv = helper['face_uv'](co, polygon.normal)
            obj['material_key'] = add['materialKey']; obj['catalog_realism_added_detail'] = True
            object_names[obj.name] = add['name']
            changes.append({'kind': 'lamp-internal-construction', 'newComponent': add['name'],
                            'materialKey': add['materialKey'], 'contactEvidence': add['contactEvidence'],
                            'geometryChanged': True, 'added': helper['_snapshot'](obj)})
        bpy.context.view_layer.update()
        after = bounds([tuple(o.matrix_world @ v.co) for o in scene.objects if o.type=='MESH' for v in o.data.vertices])
        if _drift(envelope, after) > TOLERANCE:
            raise ValueError('Lamp construction changed the overall dimensions')
        return changes
    except Exception:
        shade.data = old_mesh
        for obj, mesh in reversed(owned):
            object_names.pop(obj.name, None); bpy.data.objects.remove(obj, do_unlink=True)
            if not mesh.users:
                bpy.data.meshes.remove(mesh)
        if not replacement.users:
            bpy.data.meshes.remove(replacement)
        raise


def self_test():
    """Pure topology, envelope and contact checks, without importing Blender."""
    original, _ = lathe([(.145,.33),(.15,.336),(.149,.342),(.088,.508),(.084,.515),(.080,.52)], segments=16)
    shell = hollow_shade(original)
    assert _drift(bounds(original), bounds(shell['vertices'])) < 1e-10
    edges = {}
    for face in shell['faces']:
        assert len(face) == 4
        for a, b in zip(face, face[1:]+face[:1]):
            key = tuple(sorted((a,b))); edges[key] = edges.get(key,0)+1
    assert set(edges.values()) == {2}, 'Shell must be manifold with annular rims'
    cx,cy = shell['center']
    assert min(math.hypot(p[0]-cx,p[1]-cy) for p in shell['vertices']) > .07, 'Both central openings stay empty'
    additions = support_plan(shell, {'min':[-.024,-.024,.226], 'max':[.024,.024,.288]})
    assert len(additions) == 6
    assert max(a['bounds']['max'][2] for a in additions) < .52
    assert min(a['bounds']['min'][2] for a in additions) >= .287
    assert {a['materialKey'] for a in additions} == {'wood-dark','linen-textured'}
    print('Lighting pure checks passed: exact shade bounds, manifold hollow shell, empty openings, six fitted supports.')


if __name__ == '__main__':
    self_test()
