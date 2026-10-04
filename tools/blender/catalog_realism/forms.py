"""Measured form refinements for bedding, turned ceramics and older houseplants.

No construction inference is made from a material name alone. Recipes require
authored part names, small source meshes and measured topology, and preserve
the original evaluated envelope and object identity.
"""
import json
import math
import re
import runpy
from pathlib import Path


def smooth_width(t):
    """C1 leaf outline through the original botanical outline stations."""
    stations = [(0, 0), (.23, .65), (.55, 1), (.84, .55), (1, 0)]
    for (a, wa), (b, wb) in zip(stations, stations[1:]):
        if a <= t <= b:
            f = (t-a)/(b-a)
            f = f*f*(3-2*f)
            return wa+(wb-wa)*f
    return 0


def _normal_name(name):
    return re.sub(r'\.\d+$', '', name).lower().replace(' ', '_').replace('-', '_')


def ceramic_part(name, vertices, profile):
    if profile not in {'ceramic', 'clay'} or not 24 <= vertices <= 640:
        return False
    name = _normal_name(name)
    if re.search(r'(tile|panel|slab|counter|handle|knob|button|plate|rectangular)', name):
        return False
    return bool(re.search(r'(ceramic_body|terracotta_pot|ceramic_vase|tapered_pedestal|pedestal_column|recessed_basin|vessel_basin|rounded_bowl|porcelain_bowl|round_planter|ceramic_lamp)', name))


def _ceramic(obj, geometry):
    import bpy
    import bmesh
    from mathutils import Vector
    before = geometry['_snapshot'](obj)
    if obj.modifiers or obj.data.shape_keys or min(before['bounds']['size']) < .04:
        return None
    # A turned form must have a useful radial spread, not a thin ceramic panel.
    size = before['bounds']['size']
    if min(size[:2])/max(size[:2]) < .3:
        return None
    old_mesh = obj.data
    obj.data = old_mesh.copy()
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    crease = bm.edges.layers.float.get('crease_edge') or bm.edges.layers.float.new('crease_edge')
    for edge in bm.edges:
        if edge.is_boundary:
            edge[crease] = 1.0
        elif edge.is_manifold and edge.calc_face_angle() > 1.0:
            edge[crease] = .82
    bm.to_mesh(obj.data)
    bm.free()
    for face in obj.data.polygons:
        face.use_smooth = True
    modifier = obj.modifiers.new('Editable turned ceramic surface', 'SUBSURF')
    modifier.subdivision_type = 'CATMULL_CLARK'
    modifier.levels = modifier.render_levels = 2 if len(old_mesh.vertices) < 160 else 1
    bpy.context.view_layer.update()
    current = geometry['_snapshot'](obj)
    inverse = obj.matrix_world.inverted()
    # Subdivision is affine: fitting the control cage fits evaluated geometry
    # without discarding its editable modifier or flattening rim construction.
    for vertex in obj.data.vertices:
        point = obj.matrix_world @ vertex.co
        point = Vector([before['bounds']['min'][i] +
            (point[i]-current['bounds']['min'][i])*before['bounds']['size'][i]/current['bounds']['size'][i]
            for i in range(3)])
        vertex.co = inverse @ point
    obj.data.update()
    bpy.context.view_layer.update()
    after = geometry['_snapshot'](obj)
    evidence = geometry['change_evidence'](before, after)
    if not evidence or evidence['maxBoundsDriftM'] > geometry['TOLERANCE']:
        obj.modifiers.remove(modifier)
        obj.data = old_mesh
        return None
    obj['catalog_realism_form'] = 'Editable smooth turned profile with creased lip and exact evaluated envelope'
    return {'kind': 'turned-ceramic-profile', 'component': obj.name,
            'details': 'Smooth radial construction; sharp lips retained with editable edge creases.', **evidence}


def _densify_ticking(obj):
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    long_edges = [e for e in bm.edges if (obj.matrix_world.to_3x3() @ (e.verts[1].co-e.verts[0].co)).length > .10]
    if long_edges:
        cuts = min(40, max(2, math.ceil(max(e.calc_length() for e in long_edges)/.05)))
        bmesh.ops.subdivide_edges(bm, edges=long_edges, cuts=cuts, use_grid_fill=True)
        bm.to_mesh(obj.data)
        obj.data.update()
    bm.free()


def _leaves(obj, geometry):
    """Refine the nine-vertex leaf fans used by the two older houseplants."""
    import bpy
    from mathutils import Vector
    old = obj.data
    if len(old.vertices) % 9 or len(old.polygons)*9 != len(old.vertices)*8:
        return None
    before = geometry['_snapshot'](obj)
    points = [obj.matrix_world @ v.co for v in old.vertices]
    output, faces, uv_faces = [], [], []
    segments, across = 24, 8
    for first in range(0, len(points), 9):
        leaf = points[first:first+9]
        base, tip, center = leaf[1], leaf[5], leaf[0]
        axis = tip-base
        side = (leaf[3]-leaf[7])/2
        width = side.length*2
        if axis.length < .02 or width < .005 or abs(axis.normalized().dot(side.normalized())) > .2:
            return None
        normal = side.cross(axis).normalized()
        if normal.dot(center-(base+axis*.52)) < 0:
            normal.negate()
        bound = geometry['point_bounds'](leaf)
        t_values = sorted(set([i/segments for i in range(segments+1)]+[.23, .55, .84]))
        def point(t, s):
            return base+axis*t+side*(s*smooth_width(t))+normal*(math.sin(math.pi*t)*width*(.04+.13*(1-s*s)))
        patch = [point(t, -1+2*j/across) for t in t_values for j in range(across+1)]
        fitted = geometry['fit_points_to_bounds'](patch, bound)
        # Leaf base/tip remain at the original petiole and species apex.
        for j in range(across+1):
            fitted[j] = tuple(base)
            fitted[-across-1+j] = tuple(tip)
        start = len(output)
        output.extend(fitted)
        for i in range(len(t_values)-1):
            for j in range(across):
                ids = [i*(across+1)+j, i*(across+1)+j+1, (i+1)*(across+1)+j+1, (i+1)*(across+1)+j]
                if i == 0:
                    ids = [ids[0], ids[2], ids[3]]
                elif i == len(t_values)-2:
                    ids = [ids[0], ids[1], ids[2]]
                faces.append(tuple(start+k for k in ids))
                uv_faces.append([(k%(across+1)/across, t_values[k//(across+1)]) for k in ids])
        # Raised secondary veins follow the curved lamina. These use the same
        # leaf material and sit fractions of a millimetre above its surface.
        low = geometry['point_bounds'](patch)
        def fitted_point(t, s):
            p = point(t, s)
            return Vector([bound['min'][a]+(p[a]-low['min'][a])*bound['size'][a]/low['size'][a] for a in range(3)])
        for t in (.22, .36, .50, .64, .77):
            for sign in (-1, 1):
                strip = len(output)
                for k in range(6):
                    phase = k/5
                    tt, ss = t+.085*phase, sign*.87*phase
                    p = fitted_point(tt, ss)+normal*width*.0015
                    for offset in (-1, 1):
                        v = p + axis.normalized()*(offset*width*.0025*(1-.7*phase))
                        output.append(tuple(min(bound['max'][a],max(bound['min'][a],v[a])) for a in range(3)))
                for k in range(5):
                    faces.append((strip+2*k, strip+2*k+1, strip+2*k+3, strip+2*k+2))
                    uv_faces.append([(0,k/5),(1,k/5),(1,(k+1)/5),(0,(k+1)/5)])
    mesh = bpy.data.meshes.new(old.name+' curved botanical construction')
    inverse = obj.matrix_world.inverted()
    mesh.from_pydata([inverse @ Vector(p) for p in output], [], faces)
    for mat in old.materials:
        mesh.materials.append(mat)
    uv = mesh.uv_layers.new(name='UVMap')
    for face, coordinates in zip(mesh.polygons, uv_faces):
        face.use_smooth = True
        for loop, co in zip(face.loop_indices, coordinates):
            uv.data[loop].uv = co
    mesh.update()
    obj.data = mesh
    bpy.context.view_layer.update()
    after = geometry['_snapshot'](obj)
    evidence = geometry['change_evidence'](before, after)
    if not evidence or evidence['maxBoundsDriftM'] > geometry['TOLERANCE']:
        obj.data = old
        return None
    obj['catalog_realism_form'] = 'Individually curved laminae, fixed petiole and tip, raised secondary veins'
    return {'kind': 'curved-houseplant-leaves', 'component': obj.name,
            'leafCount': len(points)//9, 'details': 'Each original leaf retains its own bounds, petiole and apex; curved surface and raised venation.', **evidence}


def apply(root, scene, item, material_keys, object_names):
    import bpy
    root = Path(root)
    g = runpy.run_path(str(root/'tools/blender/catalog_realism/geometry.py'))
    profiles = json.loads((root/'assets-source/catalog-realism/material-plan.json').read_text(encoding='utf-8'))['models'][item['id']]['materials']
    profiles = {p['materialKey']: p.get('profile') for p in profiles}
    envelope = g['_scene_bounds'](scene)
    objects = [o for o in scene.objects if o.type == 'MESH']
    changes, pairs = [], []
    ceramic_count = 0
    for index, obj in enumerate(objects):
        if g['_protected'](obj) or g['_optical_or_art'](obj, material_keys) or len(obj.data.materials) != 1:
            continue
        name = object_names.get(obj.name, obj.name)
        key = material_keys.get(obj.data.materials[0].name)
        result = None
        if item['shape'] == 'bed' and _normal_name(name) in {'folded_duvet', 'fitted_mattress', 'mattress'} and len(obj.data.vertices) <= 256:
            result = g['_refine_pad'](root, scene, obj, 'duvet' if 'duvet' in name else 'seat', index, material_keys, name, pairs)
            if result:
                result['kind'] = 'tailored-duvet' if 'duvet' in name else 'tailored-mattress'
        elif item['id'] in {'small-plant', 'large-plant'} and _normal_name(name) == 'veined_houseplant_leaf':
            result = _leaves(obj, g)
        elif ceramic_count < 8 and ceramic_part(name, len(obj.data.vertices), profiles.get(key)):
            result = _ceramic(obj, g)
            if result:
                ceramic_count += 1
        if result:
            result['component'] = name
            changes.append(result)
    if pairs:
        for obj in objects:
            name = object_names.get(obj.name, obj.name)
            if 'duvet_quilt_stitch' in name or 'mattress_upper_ticking' in name:
                _densify_ticking(obj)
                if 'ticking' in name:
                    object_names[obj.name] = name+' seam'
        changes.extend(g['_conform_tailoring'](objects, pairs, material_keys, object_names, envelope))
    bpy.context.view_layer.update()
    if g['bounds_delta'](envelope, g['_scene_bounds'](scene)) > g['TOLERANCE']:
        raise ValueError('Form refinement changed the original catalog envelope')
    return changes
