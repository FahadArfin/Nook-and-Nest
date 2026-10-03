"""Bounded construction refinements; no blanket geometry or coverage claims.

Pure helpers select recipes and prove bounds without Blender. ``apply`` mutates
only the isolated supplied scene. Evaluated geometry changes are mandatory.
"""
import hashlib
import math
import re
import runpy
import struct
from pathlib import Path

PAD = re.compile(r'(^|_)(cushion|pillow|seat_pad|back_pad|padded_back|upholstered_seat)(_|$)')
HARD = re.compile(r'(^|_)(panel|frame|rail|post|leg|foot|drawer|shelf|shelves|top|cabinet|door|plinth|base|housing|case|bezel|handle|rim|pedestal|cistern|basin|bowl)(_|$)')
EXCLUDED = re.compile(r'(leaf|leaves|needle|petal|flower|fern|grass|fish|bubble|flame|water|screen|display|artwork|print|decal|shade|fabric|cushion|pillow|duvet|blanket|quilt|cord|welt|stitch|seam|rib|mesh|grill|slat|louvre|rope|cable|wire)')
TRIM = re.compile(r'(^|_)(welt|welting|seam|stitch|stitches|stitched|piping)(_|$)')
PROTECTED_ROLES = ('motion_role', 'shared_geometry', 'linked_bough')
TOLERANCE = .000002


def _norm(name):
    return re.sub(r'\.\d+$', '', name).lower().replace(' ', '_').replace('-', '_')


def point_bounds(points):
    points = [tuple(float(v) for v in p) for p in points]
    if not points or any(not math.isfinite(v) for p in points for v in p):
        raise ValueError('Nonempty finite geometry required')
    lo = [min(p[i] for p in points) for i in range(3)]
    hi = [max(p[i] for p in points) for i in range(3)]
    return {'min': lo, 'max': hi, 'size': [hi[i] - lo[i] for i in range(3)]}


def inside_bounds(inner, outer, tolerance=TOLERANCE):
    return all(inner['min'][i] >= outer['min'][i] - tolerance and inner['max'][i] <= outer['max'][i] + tolerance for i in range(3))


def bounds_delta(before, after):
    return max(abs(before[s][i] - after[s][i]) for s in ('min', 'max') for i in range(3))


def fit_points_to_bounds(points, target):
    """PCA-local fitting alone drifts rotated pads; restore world extrema."""
    current = point_bounds(points)
    extent = current['size']
    if min(extent) <= 1e-9:
        raise ValueError('Cannot fit degenerate pad geometry')
    return [tuple(target['min'][i] + (p[i] - current['min'][i]) / extent[i] * (target['max'][i] - target['min'][i]) for i in range(3)) for p in points]


def face_uv(point, normal):
    """Noncollapsed metric UVs for new construction faces, including caps."""
    dominant = max(range(3), key=lambda axis: abs(normal[axis]))
    axes = [axis for axis in range(3) if axis != dominant]
    return tuple(float(point[axis]) for axis in axes)


def trim_candidate_indices(name, object_bounds, pads, sample_bounds=None):
    """A whole welt belongs to its own pad; merged stitches match locally."""
    name = _norm(name)
    if not TRIM.search(name):
        return []
    whole = [i for i, pad in enumerate(pads) if inside_bounds(object_bounds, pad['bounds'], .012)]
    if whole:
        return whole
    if sample_bounds is not None and 'individual' in name and 'stitch' in name:
        return [i for i, pad in enumerate(pads) if inside_bounds(sample_bounds, pad['bounds'], .009)]
    return []


def trim_local_groups(points, edges, threshold=.007):
    """Connected short edges identify tube sections and individual stitches."""
    adjacency = [[] for _ in points]
    for a, b in edges:
        if math.dist(points[a], points[b]) <= threshold:
            adjacency[a].append(b); adjacency[b].append(a)
    remaining, groups = set(range(len(points))), []
    while remaining:
        seed = min(remaining); remaining.remove(seed)
        stack, group = [seed], []
        while stack:
            index = stack.pop(); group.append(index)
            for neighbor in adjacency[index]:
                if neighbor in remaining:
                    remaining.remove(neighbor); stack.append(neighbor)
        groups.append(sorted(group))
    return groups


def pad_recipe(catalog_id, shape, name, keys, vertices):
    name = _norm(name)
    if shape not in {'seat', 'bed'} or len(keys) != 1 or vertices > 256 or not PAD.search(name):
        return None
    if any(w in catalog_id for w in ('chester', 'tuft', 'papasan', 'togo', 'boneless', 'beanbag', 'egg-chair')):
        return None
    if any(w in name for w in ('welt', 'seam', 'stitch', 'tuft', 'channel', 'button', 'rolled')):
        return None
    if 'pillow' in name and shape == 'bed':
        return 'pillow'  # Some authored bedding retains a porcelain palette key.
    if not any(w in keys[0] for w in ('upholstery', 'fabric', 'chenille', 'linen', 'velvet', 'cloth', 'leather', 'boucle')):
        return None
    return 'back' if 'back' in name else 'seat'


def shelf_support_plan(shelf, sides, envelope):
    """Four load-bearing pins only at measured shelf/carcass contacts."""
    sizes = [shelf['max'][i] - shelf['min'][i] for i in range(3)]
    if sizes[0] < .18 or sizes[1] < .16 or not .009 <= sizes[2] <= .065:
        return []
    matches = {}
    for side in sides:
        if side['min'][2] > shelf['min'][2] - .015 or side['max'][2] < shelf['max'][2] + .015 or side['max'][0] - side['min'][0] > .09:
            continue
        if side['min'][1] > shelf['min'][1] + .035 or side['max'][1] < shelf['max'][1] - .035:
            continue
        for sign, gap in [(-1, shelf['min'][0] - side['max'][0]), (1, side['min'][0] - shelf['max'][0])]:
            if -.004 <= gap <= .020:
                matches[sign] = max(0., gap)
    if len(matches) != 2:
        return []
    results = []
    for sign in (-1, 1):
        edge = shelf['min'][0] if sign < 0 else shelf['max'][0]
        length = .013 + matches[sign]
        x = edge + sign * (matches[sign] / 2 - .0015)
        for y in [shelf['min'][1] + min(.06, sizes[1] * .22), shelf['max'][1] - min(.06, sizes[1] * .22)]:
            radius = .0025
            center = [x, y, shelf['min'][2] - radius + .0005]
            bound = {'min': [x - length / 2, y - radius, center[2] - radius], 'max': [x + length / 2, y + radius, center[2] + radius]}
            if not inside_bounds(bound, envelope):
                return []
            results.append({'kind': 'shelf-pin', 'center': center, 'axis': 0, 'radius': radius, 'length': length, 'bounds': bound})
    return results


def mounting_block_plan(top, legs, envelope):
    """Under-top blocks at actual leg contacts; no guessed decorative bolts."""
    size = [top['max'][i] - top['min'][i] for i in range(3)]
    if size[0] < .25 or size[1] < .20 or not .012 <= size[2] <= .09:
        return []
    result = []
    for leg in legs:
        if not top['min'][2] - .012 <= leg['max'][2] <= top['max'][2] + .005:
            continue
        center = [(leg['min'][i] + leg['max'][i]) / 2 for i in range(3)]
        if not all(top['min'][i] + .025 < center[i] < top['max'][i] - .025 for i in (0, 1)):
            continue
        spans = [min(.11, max(.045, leg['max'][i] - leg['min'][i] + .014)) for i in (0, 1)]
        bound = {'min': [center[0] - spans[0] / 2, center[1] - spans[1] / 2, top['min'][2] - .024], 'max': [center[0] + spans[0] / 2, center[1] + spans[1] / 2, top['min'][2] - .001]}
        if inside_bounds(bound, envelope) and all(bound['min'][i] > top['min'][i] and bound['max'][i] < top['max'][i] for i in (0, 1)):
            result.append({'kind': 'tabletop-fixing-block', 'bounds': bound})
    return result[:8]


def change_evidence(before, after):
    if before['sha256'] == after['sha256']:
        return None
    return {'geometryChanged': True, 'before': before, 'after': after, 'maxBoundsDriftM': bounds_delta(before['bounds'], after['bounds'])}


def _protected(obj):
    current = obj
    while current:
        if any(current.get(k) for k in PROTECTED_ROLES):
            return True
        current = current.parent
    return getattr(obj.data, 'users', 1) > 1


def _optical_or_art(obj, material_keys):
    for material in obj.data.materials:
        if material is None:
            continue
        key = material_keys.get(material.name, material.name).lower()
        if any(w in key for w in ('glass', 'glazing', 'mirror', 'screen', 'display', 'artwork', 'original-', 'flame', 'light', 'water')):
            return True
        if material.use_nodes:
            for node in material.node_tree.nodes:
                if node.type == 'BSDF_PRINCIPLED':
                    alpha, transmission = node.inputs.get('Alpha'), node.inputs.get('Transmission Weight')
                    if alpha and (alpha.is_linked or alpha.default_value < 1):
                        return True
                    if transmission and (transmission.is_linked or transmission.default_value > 0):
                        return True
    return False


def _snapshot(obj):
    import bpy
    evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    try:
        mesh.calc_loop_triangles()
        points = [tuple(obj.matrix_world @ v.co) for v in mesh.vertices]
        if not points:
            return None
        digest = hashlib.sha256()
        for point in points:
            digest.update(struct.pack('<3d', *(round(float(v), 9) for v in point)))
        for triangle in mesh.loop_triangles:
            digest.update(struct.pack('<3I', *triangle.vertices))
        return {'sha256': digest.hexdigest(), 'vertices': len(points), 'triangles': len(mesh.loop_triangles), 'bounds': point_bounds(points)}
    finally:
        evaluated.to_mesh_clear()


def _scene_bounds(scene):
    snapshots = [_snapshot(obj) for obj in scene.objects if obj.type in {'MESH', 'CURVE'}]
    return point_bounds([s['bounds'][side] for s in snapshots if s for side in ('min', 'max')])


def _oriented_pad(obj, kind):
    import numpy as np
    from mathutils import Matrix
    points = np.asarray([tuple(obj.matrix_world @ v.co) for v in obj.data.vertices])
    mean = points.mean(axis=0)
    _, axes = np.linalg.eigh(np.cov((points - mean).T))
    thin = axes[:, 0].copy()
    outward = np.array((0., -1., 0.) if kind == 'back' else (0., 0., 1.))
    if abs(float(thin @ outward)) < .70:
        return None
    if thin @ outward < 0:
        thin *= -1
    wide = max([axes[:, 1], axes[:, 2]], key=lambda axis: abs(axis[0])).copy()
    if wide[0] < 0:
        wide *= -1
    basis = np.column_stack((wide, np.cross(thin, wide), thin))
    local = (points - mean) @ basis
    low, high = local.min(axis=0), local.max(axis=0)
    size = high - low
    if min(size[:2]) < .20 or not .035 <= size[2] <= .32 or size[2] > min(size[:2]) * .7:
        return None
    center = mean + basis @ ((low + high) / 2)
    matrix = Matrix([[*basis[row], center[row]] for row in range(3)] + [[0, 0, 0, 1]])
    return tuple(float(x) for x in size), matrix


def _transfer_uvs(source, target, target_matrix):
    """Barycentric transfer retains original UVs on the changed cover surface."""
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    from mathutils.geometry import barycentric_transform
    source.data.calc_loop_triangles()
    triangles = list(source.data.loop_triangles)
    positions = [source.matrix_world @ v.co for v in source.data.vertices]
    tree = BVHTree.FromPolygons(positions, [tuple(t.vertices) for t in triangles], all_triangles=True)
    target_positions = [target_matrix @ v.co for v in target.vertices]
    # Choose the authored UV island once per new face. Per-vertex nearest
    # queries can pick opposite sides of an original UV seam and collapse a
    # whole boxing face to one edge. Unclamped planar barycentric extension
    # retains the source face's physical scale across a changed foam crown.
    source_faces = {}
    for polygon in target.polygons:
        center = sum((target_positions[i] for i in polygon.vertices), Vector()) / len(polygon.vertices)
        _, _, index, _ = tree.find_nearest(center)
        if index is None:
            raise ValueError('Could not transfer authored pad UV')
        source_faces[polygon.index] = triangles[index]
    for old_uv in source.data.uv_layers:
        uv = target.uv_layers.get(old_uv.name) or target.uv_layers.new(name=old_uv.name)
        for polygon in target.polygons:
            triangle = source_faces[polygon.index]
            coordinates = [Vector((*old_uv.data[i].uv, 0)) for i in triangle.loops]
            for loop_index in polygon.loop_indices:
                point = target_positions[target.loops[loop_index].vertex_index]
                value = barycentric_transform(point, *(positions[i] for i in triangle.vertices), *coordinates)
                uv.data[loop_index].uv = value[:2]
        uv.active_render = old_uv.active_render
    if source.data.uv_layers:
        target.uv_layers.active = target.uv_layers[source.data.uv_layers.active.name]


def _surface_bvh(obj, mesh=None):
    from mathutils.bvhtree import BVHTree
    mesh = mesh or obj.data
    mesh.calc_loop_triangles()
    return BVHTree.FromPolygons([obj.matrix_world @ v.co for v in mesh.vertices],
                               [tuple(t.vertices) for t in mesh.loop_triangles], all_triangles=True)


def bedding_cover_position(x, y, dimensions, ring, side, index, kind, sculpt):
    """Lofted sewn pillows and relaxed folded duvets inside measured envelopes."""
    width, depth, thickness = dimensions
    nx, ny = x/(width/2), y/(depth/2)
    panel = max(0., (1-nx*nx)*(1-ny*ny))
    if kind == 'pillow':
        loft = panel**.62
        if side == 'top':
            z = thickness*(.055+.445*loft)
            for sx, sy in ((-1,-1),(1,-1),(-1,1),(1,1)):
                a, b = width/2-sx*x, depth/2-sy*y
                z -= .0035*(1+.25*math.sin(index+sx))*math.exp(-((a+b)/.10)**2)*math.exp(-((a-.75*b)/.012)**2)
            z += .0025*math.sin(nx*2+index)*math.sin(ny*2.2+.4)*panel
        elif side == 'bottom':
            z = -thickness*(.10+.40*loft)
        else:
            z = thickness*(-.10+.155*(ring+.32)/.62)
    else:
        wave = .004*math.sin(nx*3.8+ny*2.1+index*.7)*panel
        wave += .006*math.sin(ny*5.3+nx*.9)*max(0.,1-nx*nx)
        if side == 'top':
            z = thickness*(.30+.20*panel)+wave
            z -= .004*math.exp(-((ny-.68)/.10)**2)*max(0.,1-nx*nx)
        elif side == 'bottom':
            z = -thickness*(.50-.18*max(abs(nx),abs(ny))**8)+wave*.35
        else:
            z = thickness*ring+wave*.5
        y += .005*math.sin(nx*3.2+index)*abs(ny)**6
    return x, y, z


def _refine_pad(root, scene, obj, kind, index, material_keys, original_name, surface_pairs):
    import bpy
    from mathutils import Vector
    if obj.modifiers or obj.data.shape_keys or obj.data.color_attributes:
        return None
    fit = _oriented_pad(obj, kind)
    if not fit:
        return None
    before = _snapshot(obj)
    size, matrix = fit
    material = obj.data.materials[0]
    material['material_key'] = material_keys[material.name]
    helper = runpy.run_path(str(Path(root) / 'tools/blender/sectional_realism_study.py'))
    if kind in {'pillow', 'duvet'}:
        helper['_cushion'].__globals__['_cover_position'] = bedding_cover_position
    temporary = None
    old_mesh = obj.data
    old_surface = _surface_bvh(obj)
    try:
        temporary, _ = helper['_cushion'](scene, original_name + ' temporary tailored cover', size, matrix, material, index, kind, False)
        world = [tuple(temporary.matrix_world @ v.co) for v in temporary.data.vertices]
        fitted = fit_points_to_bounds(world, before['bounds'])
        inverse = temporary.matrix_world.inverted()
        for vertex, position in zip(temporary.data.vertices, fitted):
            vertex.co = inverse @ Vector(position)
        temporary.data.update()
        _transfer_uvs(obj, temporary.data, temporary.matrix_world)
        # Retain object identity, transforms, metadata and neighboring welts.
        temporary.data.transform(obj.matrix_world.inverted() @ temporary.matrix_world)
        obj.data = temporary.data
        bpy.context.view_layer.update()
        after = _snapshot(obj)
        evidence = change_evidence(before, after)
        if not evidence or evidence['maxBoundsDriftM'] > TOLERANCE:
            obj.data = old_mesh
            return None
        obj['catalog_realism_construction'] = 'Fitted sewn face and boxing, foam crown and restrained corner tension'
        surface_pairs.append({'component': original_name, 'bounds': before['bounds'], 'old': old_surface, 'new': _surface_bvh(obj)})
        return {'kind': 'tailored-' + kind, 'component': original_name, 'details': 'Closed cover fitted to original world boundaries; source UV layers retained and matching tailoring conformed separately.', **evidence}
    finally:
        if temporary is not None:
            unused = temporary.data
            bpy.data.objects.remove(temporary, do_unlink=True)
            if unused.users == 0:
                bpy.data.meshes.remove(unused)


def pillow_welt_subdivisions(points, edges):
    """Subdivide each longitudinal span independently; never divide its rings.

    One global cut count would oversample the shorter sides below the 7 mm
    section-group threshold and merge whole runs into untransportable groups.
    """
    rings = trim_local_groups(points, edges)
    if any(len(ring) != 8 for ring in rings):
        raise ValueError('Reviewed pillow piping requires eight-vertex round sections')
    owner = {vertex: index for index, ring in enumerate(rings) for vertex in ring}
    spans = {}
    for index, (a, b) in enumerate(edges):
        if owner[a] != owner[b]:
            spans.setdefault(tuple(sorted((owner[a], owner[b]))), []).append(index)
    result = []
    for indices in spans.values():
        longest = max(math.dist(points[edges[i][0]], points[edges[i][1]]) for i in indices)
        if longest > .025:
            cuts = math.ceil(longest / .016) - 1
            if len(indices) != 8 or cuts > 64:
                raise ValueError('Unexpected pillow piping span topology or length')
            result.append({'edgeIndices': indices, 'cuts': cuts, 'maxSpanM': longest})
    return result


def _densify_pillow_welt(obj):
    import bmesh
    points = [tuple(obj.matrix_world @ v.co) for v in obj.data.vertices]
    edges = [tuple(e.vertices) for e in obj.data.edges]
    plan = pillow_welt_subdivisions(points, edges)
    if not plan:
        return None
    old_groups = trim_local_groups(points, edges)
    centers = [tuple(sum(points[i][a] for i in group)/len(group) for a in range(3)) for group in old_groups]
    radius = sum(math.dist(points[i], center) for group, center in zip(old_groups, centers) for i in group)/len(points)
    bm = bmesh.new()
    try:
        bm.from_mesh(obj.data); bm.edges.ensure_lookup_table()
        batches = [(list(bm.edges[i] for i in item['edgeIndices']), item['cuts']) for item in plan]
        for selected, cuts in batches:
            # BMesh interpolates every existing UV layer and retains the
            # original section loops/material assignments along each strip.
            bmesh.ops.subdivide_edges(bm, edges=selected, cuts=cuts, use_grid_fill=True)
        bm.to_mesh(obj.data)
    finally:
        bm.free()
    obj.data.update()
    # Linear interpolation between slightly rotated endpoint rings can shrink
    # a new section. Restore its original round radius before rigid transport.
    from mathutils import Vector
    world = [obj.matrix_world @ v.co for v in obj.data.vertices]
    groups = trim_local_groups(world, [tuple(e.vertices) for e in obj.data.edges])
    if any(len(group) != 8 for group in groups):
        raise ValueError('Pillow piping subdivision lost its round section loops')
    inverse = obj.matrix_world.inverted()
    for group in groups:
        center = sum((world[i] for i in group), Vector())/len(group)
        for i in group:
            offset = world[i]-center
            if offset.length < 1e-7:
                raise ValueError('Pillow piping subdivision collapsed a section')
            obj.data.vertices[i].co = inverse @ (center + offset.normalized()*radius)
    obj.data.update()
    return {'method': 'longitudinal quad strips only; UV layers interpolated; round section radius restored',
            'originalVertices': len(points), 'subdividedVertices': len(obj.data.vertices),
            'longSpans': len(plan), 'maximumSampleSpacingM': .016, 'sectionRadiusM': radius}


def pillow_welt_attachment(name, pair, section_radius):
    """Original bedding piping was embedded deeply in its beveled pillow.

    This exception is deliberately an exact construction pair. It allows the
    old centerline inside that cover, then seats the unchanged round section
    partly into the replacement cover instead of preserving a floating offset.
    """
    if _norm(name) != 'pillow_welt' or _norm(pair['component']) != 'gusseted_pillow':
        return None
    spans = [pair['bounds']['max'][i] - pair['bounds']['min'][i] for i in range(3)]
    if not .035 <= min(spans) <= .32 or not 0 < section_radius <= .005:
        return None
    return {'sourceDistanceLimitM': min(.04, min(spans) * .30),
            'surfaceOffsetM': min(.001, section_radius * .35)}


def _conform_tailoring(objects, pairs, material_keys, object_names, envelope):
    """Transport existing thin trim sections onto their exact matching cover.

    Rigid local sections retain the tube radius and old signed surface offset;
    projecting every tube vertex independently would flatten its cross-section.
    A combined stitch mesh is matched per short connected stitch, never assigned
    wholesale to one cushion. Pillow-only long spans gain interpolated section
    loops first; other trim changes only positions, with original topology/UV.
    """
    import bpy
    from mathutils import Vector
    if not pairs:
        return []
    records = []
    for obj in objects:
        name = object_names.get(obj.name, obj.name)
        if not TRIM.search(_norm(name)) or _protected(obj) or _optical_or_art(obj, material_keys) or obj.modifiers or obj.data.shape_keys:
            continue
        world = [obj.matrix_world @ v.co for v in obj.data.vertices]
        original_bounds = point_bounds(world)
        source_before, subdivision = None, None
        eligible_pairs = trim_candidate_indices(name, original_bounds, pairs)
        if any(pillow_welt_attachment(name, pairs[i], .0025) for i in eligible_pairs):
            source_before = _snapshot(obj)
            subdivision = _densify_pillow_welt(obj)
            world = [obj.matrix_world @ v.co for v in obj.data.vertices]
        groups = trim_local_groups(world, [tuple(e.vertices) for e in obj.data.edges])
        result = [p.copy() for p in world]
        matched, matched_groups, skipped_groups, largest_move = {}, 0, 0, 0.
        pillow_sections, largest_source_distance, pillow_offsets = 0, 0., []
        for group in groups:
            group_bounds = point_bounds([world[i] for i in group])
            if max(group_bounds['size']) > .016:
                skipped_groups += 1
                continue  # Dense or unfamiliar trim needs its own section rule.
            eligible = trim_candidate_indices(name, original_bounds, pairs, group_bounds)
            center = sum((world[i] for i in group), Vector()) / len(group)
            candidates = []
            for index in eligible:
                hit = pairs[index]['old'].find_nearest(center)
                radius = max((world[i] - center).length for i in group)
                pillow = pillow_welt_attachment(name, pairs[index], radius)
                limit = pillow['sourceDistanceLimitM'] if pillow else .014
                if hit[0] is not None and hit[3] <= limit:
                    candidates.append((hit[3], index, hit))
            if not candidates:
                skipped_groups += 1
                continue
            _, index, (old_point, old_normal, _, _) = min(candidates, key=lambda item: item[0])
            pair = pairs[index]
            hit = pair['new'].find_nearest(old_point)
            if hit[0] is None:
                skipped_groups += 1
                continue
            if hit[1].dot(old_normal) < .15:
                aligned = [h for h in pair['new'].find_nearest_range(old_point, .10) if h[1].dot(old_normal) >= .15]
                if not aligned:
                    skipped_groups += 1
                    continue
                hit = min(aligned, key=lambda h: h[3])
            new_point, new_normal, _, distance = hit
            if distance > .10:
                raise ValueError('Tailoring displacement requires manual cover review: ' + name)
            signed = max(-.0015, min(.003, (center - old_point).dot(old_normal)))
            # Preserve the actual section radius while placing its center just
            # outside the surface: the inner part overlaps the sewn cover.
            radius = max(abs((world[i] - center).dot(old_normal)) for i in group)
            pillow = pillow_welt_attachment(name, pair, radius)
            if pillow:
                signed = pillow['surfaceOffsetM']
                pillow_sections += 1
                pillow_offsets.append(signed)
                largest_source_distance = max(largest_source_distance, (center - old_point).length)
            new_center = new_point + new_normal * signed
            rotation = old_normal.rotation_difference(new_normal)
            transported = [new_center + rotation @ (world[i] - center) for i in group]
            # Preserve the model's external dimensions with a rigid inward
            # movement, rather than clipping and flattening individual vertices.
            bound = point_bounds(transported)
            correction = Vector(tuple(max(0., envelope['min'][axis] - bound['min'][axis])
                                      + min(0., envelope['max'][axis] - bound['max'][axis]) for axis in range(3)))
            for vertex, position in zip(group, transported):
                result[vertex] = position + correction
                largest_move = max(largest_move, (result[vertex] - world[vertex]).length)
            matched[pair['component']] = matched.get(pair['component'], 0) + len(group)
            matched_groups += 1
        if not matched_groups or largest_move < 1e-7:
            if subdivision:
                raise ValueError('Densified pillow piping was not attached to its cover: ' + name)
            continue
        if subdivision and skipped_groups:
            raise ValueError('Pillow piping left unmatched sections after subdivision: ' + name)
        ratios = []
        for edge in obj.data.edges:
            a, b = edge.vertices
            original_length = (world[a] - world[b]).length
            if original_length >= .0005:
                ratio = (result[a] - result[b]).length / original_length
                ratios.append(ratio)
                if ratio < .08 or ratio > 8:
                    raise ValueError('Tailoring transport would collapse or stretch an edge: ' + name)
        before = source_before if subdivision else _snapshot(obj)
        inverse = obj.matrix_world.inverted()
        for vertex, position in zip(obj.data.vertices, result):
            vertex.co = inverse @ position
        obj.data.update(); bpy.context.view_layer.update()
        after = _snapshot(obj)
        if not inside_bounds(after['bounds'], envelope):
            raise ValueError('Conformed tailoring exceeded original model bounds')
        evidence = change_evidence(before, after)
        if evidence:
            records.append({'kind': 'conformed-existing-tailoring', 'component': name, 'matchedPadVertices': matched,
                            'transportedSections': matched_groups, 'untouchedSections': skipped_groups,
                            'maxDisplacementM': largest_move, 'edgeLengthRatioRange': [min(ratios), max(ratios)] if ratios else [],
                            'pillowAttachment': {'seatedSections': pillow_sections, 'maxOriginalSurfaceDistanceM': largest_source_distance,
                                                 'surfaceOffsetRangeM': [min(pillow_offsets), max(pillow_offsets)] if pillow_offsets else []},
                            'topologyRefinement': subdivision,
                            'preservedChannels': (['material keys', 'UV layers with subdivision interpolation', 'thin section radius'] if subdivision
                                                  else ['topology', 'material keys', 'UV layers', 'thin section radius']), **evidence})
    return records


def _mesh_detail(scene, name, vertices, faces, material, material_key):
    import bpy
    mesh = bpy.data.meshes.new(name + ' editable mesh')
    mesh.from_pydata(vertices, [], faces); mesh.materials.append(material); mesh.update()
    obj = bpy.data.objects.new(name, mesh); scene.collection.objects.link(obj)
    obj['material_key'] = material_key; obj['catalog_realism_added_detail'] = True
    uv = mesh.uv_layers.new(name='UVMap')
    for polygon in mesh.polygons:
        for loop in polygon.loop_indices:
            uv.data[loop].uv = face_uv(mesh.vertices[mesh.loops[loop].vertex_index].co, polygon.normal)
    mesh.update()
    return obj


def _pin(scene, name, plan, material, key):
    sides = 12
    center, radius, length = plan['center'], plan['radius'], plan['length']
    vertices = [(center[0] + end * length / 2, center[1] + radius * math.cos(i * math.tau / sides), center[2] + radius * math.sin(i * math.tau / sides)) for end in (-1, 1) for i in range(sides)]
    faces = [(i, (i + 1) % sides, (i + 1) % sides + sides, i + sides) for i in range(sides)]
    faces.extend([tuple(reversed(range(sides))), tuple(range(sides, sides * 2))])
    return _mesh_detail(scene, name, vertices, faces, material, key)


def _block(scene, name, bound, material, key):
    vertices = [(bound[x][0], bound[y][1], bound[z][2]) for x, y, z in [('min', 'min', 'min'), ('max', 'min', 'min'), ('max', 'max', 'min'), ('min', 'max', 'min'), ('min', 'min', 'max'), ('max', 'min', 'max'), ('max', 'max', 'max'), ('min', 'max', 'max')]]
    return _mesh_detail(scene, name, vertices, [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], material, key)


def _construction_details(scene, item, material_keys, object_names, envelope):
    import bpy
    objects = [o for o in scene.objects if o.type == 'MESH' and len(o.data.vertices) and not _protected(o)]
    records = [(o, _norm(object_names.get(o.name, o.name)), _snapshot(o)['bounds']) for o in objects]
    changes = []
    if item.get('shape') == 'storage':
        sides = [bound for obj, name, bound in records if any(t in name for t in ('carcass_side', 'cabinet_side', 'bookcase_side', 'side_panel', 'internal_divider')) and not _optical_or_art(obj, material_keys)]
        material = next((m for o in objects for m in o.data.materials if m and any(t in material_keys.get(m.name, '') for t in ('steel', 'brass', 'aluminum', 'chrome'))), None)
        existing = any('shelf_pin' in name or 'shelf_support' in name for _, name, _ in records)
        if material and not existing:
            for shelf, name, bound in records:
                if len(changes) >= 24:
                    break
                if not any(t in name for t in ('adjustable_internal_shelf', 'adjustable_shelf', 'usable_display_shelf')) or _optical_or_art(shelf, material_keys):
                    continue
                for index, plan in enumerate(shelf_support_plan(bound, sides, envelope)):
                    new = _pin(scene, 'Realism shelf support ' + shelf.name + ' ' + str(index + 1), plan, material, material_keys[material.name])
                    new['construction'] = 'Support dowel at measured shelf-to-carcass contact'
                    object_names[new.name] = new.name
                    evidence = _snapshot(new)
                    if not inside_bounds(evidence['bounds'], envelope):
                        bpy.data.objects.remove(new, do_unlink=True)
                        raise ValueError('Shelf pin exceeded original envelope')
                    changes.append({'kind': 'shelf-support-pin', 'component': object_names.get(shelf.name, shelf.name), 'newComponent': new.name, 'contactEvidence': plan, 'geometryChanged': True, 'added': evidence})
    if item.get('shape') == 'table' and not any('mounting_block' in name or 'corner_block' in name for _, name, _ in records):
        legs = [bound for obj, name, bound in records if re.search(r'(^|_)(leg|legs)(_|$)', name) and not _optical_or_art(obj, material_keys)]
        wood = next((m for o in objects for m in o.data.materials if m and any(t in material_keys.get(m.name, '') for t in ('wood', 'oak', 'walnut', 'maple'))), None)
        tops = [(obj, bound) for obj, name, bound in records if any(t in name for t in ('table_top', 'tabletop', 'desktop', 'work_surface')) and not _optical_or_art(obj, material_keys)]
        if wood and len(legs) >= 2:
            for top, bound in tops[:1]:
                for index, plan in enumerate(mounting_block_plan(bound, legs, envelope)):
                    new = _block(scene, 'Realism underside fixing block ' + str(index + 1), plan['bounds'], wood, material_keys[wood.name])
                    new['construction'] = 'Under-top fixing block at measured leg contact'
                    bevel = new.modifiers.new('Small eased block edges', 'BEVEL'); bevel.width = .001; bevel.segments = 2
                    object_names[new.name] = new.name
                    changes.append({'kind': 'tabletop-fixing-block', 'component': object_names.get(top.name, top.name), 'newComponent': new.name, 'contactEvidence': plan, 'geometryChanged': True, 'added': _snapshot(new)})
    return changes


UVLESS_STITCH_ROLES = {
    'chair-sleeper': ('household-slate-fabric', 1744, 2616),
    'chair-sleeper-open': ('entry-slate-upholstery', 320, 480),
}
UVLESS_STITCH_COMPONENT = 'Tailoring - individual saddle stitches'


def uvless_stitch_role(model_id, component, keys, existing_layers):
    return (model_id in UVLESS_STITCH_ROLES and component == UVLESS_STITCH_COMPONENT
            and keys == [UVLESS_STITCH_ROLES[model_id][0]] and not existing_layers)


def uvless_stitch_uvs(points, faces, repeat_m):
    """Author the missing ordinary thread chart in physical metres per tile."""
    if not math.isfinite(repeat_m) or not .02 <= repeat_m <= 4:
        raise ValueError('Missing stitch chart requires a calibrated physical repeat')
    point_bounds(points)  # Reject non-finite coordinates before authoring UVs.
    result = []
    for face in faces:
        positions = [points[i] for i in face]
        normal = [0., 0., 0.]
        for a, b in zip(positions, positions[1:]+positions[:1]):
            normal[0] += (a[1]-b[1])*(a[2]+b[2])
            normal[1] += (a[2]-b[2])*(a[0]+b[0])
            normal[2] += (a[0]-b[0])*(a[1]+b[1])
        if sum(v*v for v in normal) < 1e-24:
            raise ValueError('Missing stitch chart has no valid geometric face')
        result.append([tuple(value/repeat_m for value in face_uv(point, normal)) for point in positions])
    return result


def _author_missing_stitch_uvs(scene, item, material_keys, object_names):
    """Two hash-bound source models contain stitch meshes with no UV layers.

    Their baseline join filled TEXCOORD_0 with (0,1), which cannot define a
    tangent chart. This authors UV0 only where no source UV ever existed.
    Existing images, references, factors, geometry and authored UVs stay intact.
    """
    model_id = item['id']
    if model_id not in UVLESS_STITCH_ROLES:
        return []
    expected_key, expected_vertices, expected_triangles = UVLESS_STITCH_ROLES[model_id]
    matches = [o for o in scene.objects if o.type == 'MESH' and object_names.get(o.name, o.name) == UVLESS_STITCH_COMPONENT]
    if len(matches) != 1:
        raise ValueError('Expected the reviewed UV-less stitch source component')
    obj = matches[0]; mesh = obj.data
    keys = [material_keys[m.name] for m in mesh.materials if m]
    if not uvless_stitch_role(model_id, UVLESS_STITCH_COMPONENT, keys, list(mesh.uv_layers)):
        return []  # Never replace any authored source UV or unrelated material.
    if _protected(obj) or _optical_or_art(obj, material_keys) or obj.modifiers or mesh.shape_keys:
        raise ValueError('Missing stitch UV repair requires the original static mesh')
    mesh.calc_loop_triangles()
    if len(mesh.vertices) != expected_vertices or len(mesh.loop_triangles) != expected_triangles:
        raise ValueError('UV-less stitch source geometry differs from inspected evidence')
    baseline = next(m for m in item['baselineGltf']['materials'] if m['name'] == expected_key)
    reference = baseline.get('normalTexture', {})
    texcoord = reference.get('extensions', {}).get('KHR_texture_transform', {}).get('texCoord', reference.get('texCoord', 0))
    if not reference or texcoord != 0:
        raise ValueError('Reviewed missing stitch chart requires its unchanged normal texture on UV0')
    repeat = baseline.get('extras', {}).get('sofa_repeat_m')
    before = _snapshot(obj)
    old_normals = [tuple(n.vector) for n in mesh.corner_normals]
    points = [tuple(obj.matrix_world @ v.co) for v in mesh.vertices]
    coordinates = uvless_stitch_uvs(points, [tuple(p.vertices) for p in mesh.polygons], repeat)
    uv = mesh.uv_layers.new(name='UVMap')
    for polygon, values in zip(mesh.polygons, coordinates):
        for loop, value in zip(polygon.loop_indices, values):
            uv.data[loop].uv = value
    uv.active_render = True; mesh.uv_layers.active = uv
    if before != _snapshot(obj) or old_normals != [tuple(n.vector) for n in mesh.corner_normals]:
        raise ValueError('Missing stitch UV authoring changed protected geometry or normals')
    digest = hashlib.sha256(b''.join(struct.pack('<2f', *loop.uv) for loop in uv.data)).hexdigest()
    return [{'kind': 'source-uvless-stitch-chart', 'component': UVLESS_STITCH_COMPONENT,
             'materialKey': expected_key, 'geometryChanged': False, 'attributesChanged': True,
             'uvLayer': 'UVMap', 'texCoord': 0, 'repeatM': [repeat, repeat], 'uvSha256': digest,
             'sourceEvidence': {'sourceBlend': item['sourceBlend'], 'originalUVLayers': [],
                                'vertices': expected_vertices, 'triangles': expected_triangles,
                                'baselineCollapsedUVTriangles': expected_triangles},
             'mapping': 'Actual face-normal dominant projection of world metres divided by the unchanged material physical repeat.',
             'preservedChannels': ['geometry', 'normals', 'material keys', 'texture images', 'texture bindings', 'material factors'],
             'before': before, 'after': before}]


def apply(root, scene, item, material_keys, object_names):
    """Return measured changes only; an empty list is valid preserved fidelity."""
    import bpy
    catalog_id = item['id']
    if 'aquarium' in catalog_id:
        return []
    envelope = _scene_bounds(scene)
    changes = _author_missing_stitch_uvs(scene, item, material_keys, object_names)
    objects = [o for o in scene.objects if o.type == 'MESH' and len(o.data.vertices)]
    padded_ids = set()
    surface_pairs = []
    for index, obj in enumerate(objects):
        if _protected(obj) or _optical_or_art(obj, material_keys):
            continue
        name = object_names.get(obj.name, obj.name)
        keys = [material_keys.get(m.name, m.name) for m in obj.data.materials if m]
        kind = pad_recipe(catalog_id, item.get('shape'), name, keys, len(obj.data.vertices))
        if kind and len(padded_ids) < 12:
            record = _refine_pad(root, scene, obj, kind, index, material_keys, name, surface_pairs)
            if record:
                changes.append(record); padded_ids.add(obj.as_pointer())
    changes.extend(_conform_tailoring(objects, surface_pairs, material_keys, object_names, envelope))
    for obj in objects:
        if obj.as_pointer() in padded_ids or _protected(obj) or _optical_or_art(obj, material_keys):
            continue
        name = _norm(object_names.get(obj.name, obj.name))
        if not HARD.search(name) or EXCLUDED.search(name) or len(obj.data.vertices) > 4000 or obj.data.shape_keys:
            continue
        if any(m.type in {'BEVEL', 'SUBSURF'} for m in obj.modifiers):
            continue
        size = point_bounds([v.co for v in obj.data.vertices])['size']
        if min(size) < .009:
            continue
        before = _snapshot(obj)
        modifier = obj.modifiers.new('Realism softened manufactured edge', 'BEVEL')
        modifier.width = min(.0012, min(size) * .025); modifier.segments = 3
        modifier.limit_method = 'ANGLE'; modifier.angle_limit = math.radians(55)
        modifier.affect = 'EDGES'; modifier.use_clamp_overlap = True; modifier.harden_normals = True
        bpy.context.view_layer.update()
        after = _snapshot(obj)
        evidence = change_evidence(before, after)
        if not evidence or evidence['maxBoundsDriftM'] > TOLERANCE:
            obj.modifiers.remove(modifier)
            continue
        changes.append({'kind': 'edge-construction', 'component': object_names.get(obj.name, obj.name), 'widthM': modifier.width, 'segments': 3, 'angleDegrees': 55, **evidence})
    changes.extend(_construction_details(scene, item, material_keys, object_names, envelope))
    bpy.context.view_layer.update()
    if bounds_delta(envelope, _scene_bounds(scene)) > TOLERANCE:
        raise ValueError('Geometry refinement changed the original overall envelope')
    return changes


def inspect_inventory(inventory, items):
    """Read-only candidates, not evidence that a Blender build succeeded."""
    result = {}
    for catalog_id, row in inventory['models'].items():
        item = items.get(catalog_id, {})
        pads = []
        for obj in row['objects']:
            if obj.get('motionRole') or obj.get('sharedGeometry') or obj.get('modifiers'):
                continue
            kind = pad_recipe(catalog_id, item.get('shape'), obj['name'], obj['materials'], obj['vertices'])
            if kind:
                pads.append({'component': obj['name'], 'recipe': kind})
        result[catalog_id] = {'padCandidates': pads, 'status': 'candidate only; evaluated bounds and visual review required'}
    return result
