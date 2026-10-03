"""Original three-place left-chaise sectional, authored in metres.

X is width, -Y is front, Z is up. The measured 2.8 x 2.2 x .93 m envelope
preserves everyday-sectional-track-left placement compatibility. The quilted
looking surface of a low-density foam block is deliberately avoided: six sewn
covers have flat contact patches, broad crowns, separate boxing, compression
and local corner tension. This is a researched construction interpretation,
not a manufacturer replica. Existing Blender scenes are never modified.
"""

import math
from pathlib import Path
import runpy
import uuid

import bpy
from mathutils import Matrix, Vector


# These frozen helpers only create explicitly requested new datablocks. The
# exporter binds this file and the helper's bytes as source inputs.
_SUPPORT = runpy.run_path(str(Path(__file__).with_name('sofa_realism_study.py')))
_mesh = _SUPPORT['_mesh']
_rounded_perimeter = _SUPPORT['_rounded_perimeter']
_bounds = _SUPPORT['_bounds']
FABRIC = 'soft-grey-chenille'
SEAM = 'seam'
WOOD = 'walnut'
RUNTIME_KEY = 'nook.sectional.realism.study'


def _cover_position(x, y, dimensions, ring, side, index, kind, sculpt):
    width, depth, thickness = dimensions
    hx, hy = width / 2, depth / 2
    nx, ny = x / hx, y / hy
    edge = max(abs(nx), abs(ny))
    if side == 'top':
        panel = (1 - nx**6) * (1 - ny**6)
        soft = (1 - nx**4) * (1 - ny**4)
        crown = .016 if kind != 'back' else .033
        z = thickness * (.30 + .20 * panel) + crown * soft
        if kind == 'back':
            # A broad, gently padded lumbar roll inside a boxed back cushion.
            # The top corners stay tailored rather than becoming round blobs.
            z += .023 * math.exp(-((y + depth * .20) / .120)**2) * soft
        if sculpt:
            for sx, sy in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
                a, b = hx - sx * x, hy - sy * y
                reach = math.exp(-((a + b) / (.195 if kind == 'back' else .180))**2)
                slope = .62 + .09 * math.sin(index * 1.2 + sx)
                valley = math.exp(-((a - slope * b - .019) / .023)**2)
                shoulder = math.exp(-((a - slope * b + .024) / .032)**2)
                strength = (1.05 if sy < 0 else .56) * (1 + .18 * math.sin(index + sx * 2))
                z += reach * strength * (-.0125 * valley + .0042 * shoulder)
            # Distinct shallow tucks emerge from the actual front/lower seam.
            # Their scale is physical millimetres, never broad random noise.
            distance = y + hy
            for number, anchor in enumerate((-.32, .16, .37)):
                shifted = width * (anchor + .019 * math.sin(index * 1.7 + number))
                line = x - shifted - (.19 if number % 2 else -.14) * distance
                reach = math.exp(-(distance / (.155 if kind == 'back' else .125))**2)
                strength = (.85, .48, 1.0)[number] * (1 + .16 * math.sin(index + number * 1.8))
                z += reach * strength * (-.0105 * math.exp(-(line / .024)**2)
                                         + .0032 * math.exp(-((line - .032) / .032)**2))
            if kind == 'back':
                # Light contact from adjacent covers, not decorative tufting.
                z -= .009 * math.exp(-((x - .025 * math.sin(index)) / .23)**2
                                    - ((y + depth * .36) / .080)**2)
                z += .0025 * math.sin(nx * 2.8 + index) * soft
                # A lightly settled top hem and compressed lower contact edge
                # interrupt the mechanically straight pillow silhouette.
                y -= .0075 * (1 - nx**2) * max(ny, 0)**5
                y -= .0040 * (1 - nx**2) * max(-ny, 0)**5
            else:
                centre_y = depth * .21 if kind == 'chaise' else depth * .06
                z -= .0130 * math.exp(-((x + .02 * math.sin(index)) / .25)**2
                                     - ((y - centre_y) / .26)**2)
                if kind == 'chaise':
                    z -= .006 * math.exp(-(x / .25)**2 - ((y + .37) / .30)**2)
                z += .0013 * math.sin(nx * 3 + index) * math.sin(ny * 2 + .4) * soft
    elif side == 'bottom':
        # The centre actually rests on the deck; only the sewn hem turns up.
        z = -thickness * (.50 - .18 * edge**8)
    else:
        z = thickness * ring
        if sculpt:
            swell = math.sin((ring + .32) * math.pi / .62)
            x += .0012 * math.sin(y * 17 + index) * swell
            y += .0011 * math.sin(x * 21 + index * .7) * swell
            front = math.exp(-((y + hy) / .035)**2)
            for number, anchor in enumerate((-.32, .16, .37)):
                shifted = width * (anchor + .019 * math.sin(index * 1.7 + number))
                strength = (.85, .48, 1.0)[number]
                y += front * .0065 * strength * math.exp(-((x - shifted) / .028)**2) * swell
    if kind == 'chaise':
        # The front of a chaise cushion wraps around the outside arm's nose.
        # Its inner/right edge stays straight; the outer/front wing fills the
        # complete module instead of leaving a bare upholstered ledge. A
        # 200-mm eased transition is sewn into the cover's actual outline.
        phase = min(1., max(0., (.10 - y) / .20))
        wing = .190 * phase * phase * (3 - 2 * phase)
        x -= wing * (1 - nx) / 2
    return x, y, z


def _cushion(scene, name, dimensions, matrix, material, index, kind, master):
    width, depth, thickness = dimensions
    outline = _rounded_perimeter(width, depth, .068 if kind == 'back' else .055,
                                 80 if master else 56)
    count = len(outline)
    radial = (24 if kind == 'chaise' else 19) if master else (18 if kind == 'chaise' else 14)
    vertices, shaped, faces, uv_faces = [], [], [], []

    def add(x, y, ring, side):
        vertices.append(_cover_position(x, y, dimensions, ring, side, index, kind, False))
        shaped.append(_cover_position(x, y, dimensions, ring, side, index, kind, True))
        return len(vertices) - 1

    def face(ids, coords):
        faces.append(ids)
        uv_faces.append(coords)

    panels = []
    for side in ('top', 'bottom'):
        rings = []
        for step in range(1, radial + 1):
            scale = step / radial
            rings.append([add(x * scale, y * scale, 0, side) for x, y in outline])
        centre = add(0, 0, 0, side)
        for j in range(count):
            ids = [centre, rings[0][j], rings[0][(j + 1) % count]]
            if side == 'bottom':
                ids.reverse()
            face(ids, [(vertices[v][0], vertices[v][1]) for v in ids])
        for inner, outer in zip(rings[:-1], rings[1:]):
            for j in range(count):
                q = (j + 1) % count
                ids = [inner[j], outer[j], outer[q], inner[q]]
                if side == 'bottom':
                    ids.reverse()
                face(ids, [(vertices[v][0], vertices[v][1]) for v in ids])
        panels.append(rings)
    side_rings = [panels[1][-1]]
    for step in range(1, 5):
        t = step / 5
        swell = 1 + .0075 * math.sin(t * math.pi)
        side_rings.append([add(x * swell, y * swell, -.32 + .62 * t, 'side')
                           for x, y in outline])
    side_rings.append(panels[0][-1])
    distances = [0.]
    uv_outline = [_cover_position(x, y, dimensions, 0, 'side', index, kind, False)[:2]
                  for x, y in outline]
    for j in range(count):
        distances.append(distances[-1] + math.dist(uv_outline[j], uv_outline[(j + 1) % count]))
    for lower, upper in zip(side_rings[:-1], side_rings[1:]):
        for j in range(count):
            q = (j + 1) % count
            ids = [lower[j], lower[q], upper[q], upper[j]]
            face(ids, [(distances[j], vertices[lower[j]][2]),
                       (distances[j + 1], vertices[lower[q]][2]),
                       (distances[j + 1], vertices[upper[q]][2]),
                       (distances[j], vertices[upper[j]][2])])
    obj = _mesh(scene, name, vertices if master else shaped, faces, material, uv_faces)
    obj.matrix_world = matrix
    obj['construction'] = 'Separate sewn face panels and boxing; broad foam crown; real seam tension'
    obj['upholstery_anatomy'] = kind
    if master:
        obj.shape_key_add(name='Unloaded tailored foam and cover')
        key = obj.shape_key_add(name='Settled foam, contact compression and corner tension')
        for point, co in zip(key.data, shaped):
            point.co = co
        key.value = 1
    return obj, outline


def _seam_path(scene, name, path, matrix, material, master, radius=.00155,
               plane_normal=(0, 0, 1)):
    """Editable master cord; explicit browser tube with continuous metre UVs."""
    path = [Vector(p) for p in path]
    if master:
        curve = bpy.data.curves.new(name + ' editable seam', 'CURVE')
        curve.dimensions = '3D'
        curve.resolution_u = 1
        curve.bevel_depth = radius
        curve.bevel_resolution = 1
        spline = curve.splines.new('POLY')
        spline.points.add(len(path) - 1)
        for point, co in zip(spline.points, path):
            point.co = (*co, 1)
        spline.use_cyclic_u = True
        obj = bpy.data.objects.new(name, curve)
        scene.collection.objects.link(obj)
        curve.materials.append(material)
        obj.matrix_world = matrix
        obj['material_key'] = material['material_key']
        obj['uv_units'] = 'metres'
        return obj
    count, sides = len(path), 6
    vertices, faces, uv_faces, distances = [], [], [], [0.]
    for j in range(count):
        distances.append(distances[-1] + (path[j] - path[(j + 1) % count]).length)
    for j, centre in enumerate(path):
        tangent = (path[(j + 1) % count] - path[(j - 1) % count]).normalized()
        outward = tangent.cross(Vector(plane_normal)).normalized()
        up = tangent.cross(outward).normalized()
        for k in range(sides):
            angle = k * math.tau / sides
            vertices.append(centre + radius * (outward * math.cos(angle) + up * math.sin(angle)))
    for j in range(count):
        q = (j + 1) % count
        for k in range(sides):
            r = (k + 1) % sides
            faces.append([j * sides + k, q * sides + k, q * sides + r, j * sides + r])
            u0, u1 = k * math.tau * radius / sides, (k + 1) * math.tau * radius / sides
            uv_faces.append([(u0, distances[j]), (u0, distances[j + 1]),
                             (u1, distances[j + 1]), (u1, distances[j])])
    obj = _mesh(scene, name, vertices, faces, material, uv_faces)
    obj.matrix_world = matrix
    return obj


def _cushion_welt(scene, name, outline, dimensions, matrix, material,
                  master, index, kind, upper):
    path = [_cover_position(x, y, dimensions, 0, 'top' if upper else 'bottom',
                            index, kind, True) for x, y in outline]
    return _seam_path(scene, name, path, matrix, material, master)


def _soft_block(scene, name, dimensions, location, material, master,
                corner=.045, bevel=.022, open_bottom=False, arm=False):
    """An upholstered timber carcass with rounded arrises and broad flat panels.

    XY perimeter strips carry distance/height UVs; caps carry planar XY UVs.
    That separate boxing construction prevents collapsed UVs at rolled edges.
    """
    width, depth, height = dimensions
    bevel = min(bevel, height * .24, width * .20, depth * .20)
    count_steps = 40 if master else 32
    levels = [(-height / 2, bevel),
              (-height / 2 + bevel * .134, bevel * .5),
              (-height / 2 + bevel * .5, bevel * .134),
              (-height / 2 + bevel, 0),
              (height / 2 - bevel, 0),
              (height / 2 - bevel * .5, bevel * .134),
              (height / 2 - bevel * .134, bevel * .5),
              (height / 2, bevel)]
    vertices, faces, uv_faces, rings = [], [], [], []
    outlines = []
    for z, inset in levels:
        outline = _rounded_perimeter(width - inset * 2, depth - inset * 2,
                                     max(.008, corner - inset), count_steps)
        outlines.append(outline)
        ring = []
        for x, y in outline:
            ring.append(len(vertices))
            # Millimetre-scale padding over a squared track-arm frame.
            swell = (.005 if arm else .0015) * max(0, 1 - (z / (height / 2))**4)
            vertices.append((x + swell * x / (width / 2),
                             y + swell * y / (depth / 2), z))
        rings.append(ring)
    count = len(rings[0])
    perimeter = [0.]
    for j in range(count):
        perimeter.append(perimeter[-1] + math.dist(outlines[3][j], outlines[3][(j + 1) % count]))
    for lower, upper in zip(rings[:-1], rings[1:]):
        for j in range(count):
            q = (j + 1) % count
            faces.append([lower[j], lower[q], upper[q], upper[j]])
            uv_faces.append([(perimeter[j], vertices[lower[j]][2]),
                             (perimeter[j + 1], vertices[lower[q]][2]),
                             (perimeter[j + 1], vertices[upper[q]][2]),
                             (perimeter[j], vertices[upper[j]][2])])
    for bottom in (True, False):
        if bottom and open_bottom:
            continue
        ring, outline = (rings[0], outlines[0]) if bottom else (rings[-1], outlines[-1])
        z = -height / 2 if bottom else height / 2
        cap_rings = []
        for scale in (.25, .5, .75):
            new = []
            for x, y in outline:
                new.append(len(vertices))
                crown = 0 if bottom else (.006 if arm else .0015) * (1 - scale**4)
                vertices.append((x * scale, y * scale, z + crown))
            cap_rings.append(new)
        cap_rings.append(ring)
        centre = len(vertices)
        vertices.append((0, 0, z if bottom else z + (.006 if arm else .0015)))
        for j in range(count):
            ids = [centre, cap_rings[0][j], cap_rings[0][(j + 1) % count]]
            if bottom:
                ids.reverse()
            faces.append(ids)
            uv_faces.append([(vertices[v][0], vertices[v][1]) for v in ids])
        for inner, outer in zip(cap_rings[:-1], cap_rings[1:]):
            for j in range(count):
                q = (j + 1) % count
                ids = [inner[j], outer[j], outer[q], inner[q]]
                if bottom:
                    ids.reverse()
                faces.append(ids)
                uv_faces.append([(vertices[v][0], vertices[v][1]) for v in ids])
    obj = _mesh(scene, name, vertices, faces, material, uv_faces)
    obj.location = location
    obj['construction'] = 'Tailored padded frame with separate cap panels and continuous boxing'
    return obj


def _wood_member(scene, name, start, end, width, depth, material,
                 bottom_scale=1, top_scale=1, radius=.005):
    obj = _SUPPORT['_beam'](scene, name, start, end, width, depth, material,
                            top_scale=top_scale, bottom_scale=bottom_scale, radius=radius)
    obj['construction'] = 'Recessed walnut frame member with rounded arrises and longitudinal grain'
    # Use the frozen deterministic cuts but keep the canonical walnut key.
    data = obj.data
    uv = data.uv_layers.active
    coords = [[tuple(uv.data[i].uv) for i in p.loop_indices] for p in data.polygons]
    shifted, offsets = _SUPPORT['_board_uv_cut'](name, coords)
    for polygon, face in zip(data.polygons, shifted):
        for loop, co in zip(polygon.loop_indices, face):
            uv.data[loop].uv = co
    obj['wood_uv_offset_m'] = offsets
    return obj


def _dust_panel(scene, name, centre, dimensions, material):
    x, y, z = centre
    hx, hy = dimensions[0] / 2, dimensions[1] / 2
    vertices = [(x - hx, y - hy, z), (x + hx, y - hy, z),
                (x + hx, y + hy, z), (x - hx, y + hy, z)]
    # The face intentionally points down: the underside is a real inset cover.
    ids = [3, 2, 1, 0]
    obj = _mesh(scene, name, vertices, [ids], material,
                [[(vertices[v][0], vertices[v][1]) for v in ids]])
    obj['construction'] = 'Recessed underside dust cover, separate from the padded outer frame'
    return obj


def _family(scene, materials, master):
    parts = []
    fabric, seam, wood = materials[FABRIC], materials[SEAM], materials[WOOD]
    # Two believable transport modules: a long chaise and a two-seat section.
    modules = [(-.901, -.010, .992, 2.170, 'Left chaise'),
               (.493, .547, 1.786, 1.056, 'Two-seat right')]
    for x, y, width, depth, word in modules:
        parts.append(_soft_block(scene, word + ' upholstered lower deck',
                                 (width, depth, .201), (x, y, .1925), fabric, master,
                                 corner=.052, bevel=.022, open_bottom=True))
        parts.append(_dust_panel(scene, word + ' inset underside dust cover',
                                 (x, y, .150), (width - .135, depth - .13), seam))
        hx, hy = width / 2 - .065, depth / 2 - .065
        for yy, name in ((-hy, 'front'), (hy, 'rear')):
            parts.append(_wood_member(scene, word + ' hidden ' + name + ' rail',
                                      (x - hx, y + yy, .123), (x + hx, y + yy, .123),
                                      .040, .038, wood, radius=.004))
        for xx, name in ((-hx, 'left'), (hx, 'right')):
            parts.append(_wood_member(scene, word + ' hidden ' + name + ' rail',
                                      (x + xx, y - hy, .123), (x + xx, y + hy, .123),
                                      .040, .038, wood, radius=.004))
        for xx in (-hx + .018, hx - .018):
            for yy in (-hy + .025, hy - .025):
                parts.append(_wood_member(scene, word + ' inset walnut foot '
                                          + str(round(xx, 3)) + ' ' + str(round(yy, 3)),
                                          (x + xx, y + yy, 0), (x + xx, y + yy, .105),
                                          .087, .078, wood, bottom_scale=.88, radius=.009))
    # Independently upholstered back modules retain a vertical assembly joint.
    for x, width, label in ((-.901, .992, 'Left'), (.493, 1.786, 'Right')):
        parts.append(_soft_block(scene, label + ' padded rear frame and panel',
                                 (width, .222, .653), (x, .979, .4255), fabric, master,
                                 corner=.044, bevel=.021))
    for side in (-1, 1):
        label = 'Left' if side < 0 else 'Right'
        location = (side * 1.290, .537, .380)
        dimensions = (.205, 1.090, .552)
        parts.append(_soft_block(scene, label + ' padded squared track arm',
                                 dimensions, location, fabric, master,
                                 corner=.050, bevel=.028, arm=True))
        # A sewn top cap follows the actual rolled edge; it is tone-on-tone.
        outline = _rounded_perimeter(.190, 1.075, .043, 56 if master else 40)
        path = [(x, y, .266) for x, y in outline]
        parts.append(_seam_path(scene, label + ' tailored arm cap seam', path,
                                Matrix.Translation(location), seam, master, radius=.00125))
        # The front cap is a separate sewn piece. Its cord follows the padded
        # nose instead of floating in front of the rounded XY corner.
        front_outline = _rounded_perimeter(.166, .496, .024, 56 if master else 40)
        path = []
        for x, z in front_outline:
            along_corner = max(0, abs(x) - (.205 / 2 - .050))
            xy_inset = .050 - math.sqrt(max(0, .050**2 - along_corner**2))
            padding = .005 * max(0, 1 - (z / (.552 / 2))**4)
            y = -1.090 / 2 + xy_inset - padding - .0008
            path.append((x, y, z))
        parts.append(_seam_path(scene, label + ' sewn front arm panel', path,
                                Matrix.Translation(location), seam, master, radius=.00115,
                                plane_normal=(0, -1, 0)))
    seats = [('Long left chaise', (-.800, -.112, .389), (.789, 1.895, .192), 'chaise'),
             ('Middle seat', (.000, .421, .389), (.790, .830, .192), 'seat'),
             ('Right seat', (.798, .422, .391), (.788, .828, .192), 'seat')]
    for index, (name, location, dimensions, kind) in enumerate(seats):
        matrix = Matrix.Translation(location) @ Matrix.Rotation(
            math.radians((-.10, .10, -.18)[index]), 4, 'Z')
        obj, outline = _cushion(scene, name + ' continuous boxed cover', dimensions,
                                matrix, fabric, index, kind, master)
        parts.append(obj)
        for upper in (True, False):
            parts.append(_cushion_welt(scene, name + (' upper' if upper else ' lower') + ' sewn welt',
                                      outline, dimensions, matrix, seam, master,
                                      index, kind, upper))
    for index, x in enumerate((-.800, .000, .798)):
        dimensions = ((.803, .801, .799)[index], (.451, .446, .450)[index], .207)
        # Back pillows stand on the seat with 11-13 degrees of relaxed recline.
        matrix = Matrix.Translation((x + (.001 if index == 2 else 0),
                                     (.857, .861, .858)[index],
                                     (.692, .693, .691)[index])) @ Matrix.Rotation(
                                         math.radians((78.1, 77.4, 78.3)[index]), 4, 'X')
        obj, outline = _cushion(scene, 'Back ' + str(index + 1) + ' settled boxed pillow',
                                dimensions, matrix, fabric, index + 3, 'back', master)
        parts.append(obj)
        for upper in (True, False):
            parts.append(_cushion_welt(scene, 'Back ' + str(index + 1)
                                      + (' face' if upper else ' rear') + ' sewn welt',
                                      outline, dimensions, matrix, seam, master,
                                      index + 3, 'back', upper))
    return parts


def build(root_path, materials=None):
    root = Path(root_path).resolve()
    if not (root / 'package.json').is_file():
        raise ValueError('Expected repository root')
    tag = uuid.uuid4().hex[:8]
    if materials is None:
        materials = {FABRIC: _SUPPORT['_material'](FABRIC, (.23, .26, .27, 1), .91),
                     SEAM: _SUPPORT['_material'](SEAM, (.17, .19, .20, 1), .95),
                     WOOD: _SUPPORT['_material'](WOOD, (.16, .078, .037, 1), .67)}
    if set(materials) != {FABRIC, SEAM, WOOD}:
        raise ValueError('Expected soft-grey-chenille, seam and walnut materials')
    scenes, families, normalization = [], [], []
    for is_master in (True, False):
        scene = bpy.data.scenes.new(('Sectional realism editable master ' if is_master
                                     else 'Sectional realism browser ') + tag)
        scene.unit_settings.system = 'METRIC'
        scene.unit_settings.scale_length = 1
        parts = _family(scene, materials, is_master)
        lo, hi = _bounds(parts, scene)
        size = hi - lo
        factors = Vector((2.8 / size.x, 2.2 / size.y, .93 / size.z))
        centre = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
        parent = bpy.data.objects.new('Sectional measured envelope ' + tag
                                      + (' master' if is_master else ' browser'), None)
        scene.collection.objects.link(parent)
        parent.location = (-centre.x * factors.x, -centre.y * factors.y, -centre.z * factors.z)
        parent.scale = factors
        parent['realism_study_owner'] = tag
        for obj in parts:
            transform = obj.matrix_world.copy()
            obj.parent = parent
            obj.matrix_parent_inverse = Matrix.Identity(4)
            obj.matrix_basis = transform
            obj['realism_study_owner'] = tag
        measured_lo, measured_hi = _bounds(parts, scene)
        measured_size = measured_hi - measured_lo
        if any(abs(measured_size[i] - target) > 1e-5
               for i, target in enumerate((2.8, 2.2, .93))):
            raise ValueError('Sectional measured envelope normalization failed')
        scene['catalog_id'] = 'everyday-sectional-track-left'
        scene['dimensions_m'] = [2.8, 2.2, .93]
        scene['source_material_keys'] = [FABRIC, SEAM, WOOD]
        scene['design_note'] = 'Original everyday track-arm left-chaise interpretation; not a manufacturer replica'
        scenes.append(scene)
        families.append(parts)
        normalization.append(list(factors))
    runtime = {'owner': tag, 'root': str(root), 'masterScene': scenes[0],
               'browserScene': scenes[1], 'masterParts': families[0],
               'browserParts': families[1], 'materials': materials,
               'normalization': normalization, 'catalogId': 'everyday-sectional-track-left',
               'dimensionsM': [2.8, 2.2, .93],
               'sourceNotes': [
                   'Original two-module left-chaise construction with squared padded track arms',
                   'Continuous long chaise, two regular seat covers and three separately inclined back pillows',
                   'Six editable compression shape keys; physical seam tension and separate sewn boxing/welts',
                   'Tailored arm caps, independently paneled rear, recessed walnut feet, timber underside and inset dust covers',
                   'Metre-scale continuous boxing UVs and panel UVs; browser surface relief uses native tiled PBR maps',
                   'Floor-centred exact 2800 x 2200 x 930 mm envelope retained for original placement compatibility']}
    bpy.app.driver_namespace[RUNTIME_KEY] = runtime
    return runtime
