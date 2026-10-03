"""Repair invalid exported tangents from valid neighboring UV triangles.

Blender's averaged tangent can cancel at a very small smooth cap. Derive its
basis from the largest incident nondegenerate UV triangle, then orthogonalize
against the exported normal. Missing/degenerate UV charts fail instead of
inventing a basis. Call before restoring untouched dynamic subtrees.
"""
import math
import struct

# Match scripts/lib/catalog-realism-validate.mjs's strict tangent-basis gate.
BASIS_TOLERANCE = .02
HANDEDNESS_TOLERANCE = .001


def dot(a, b):
    return sum(x*y for x, y in zip(a, b))


def sub(a, b):
    return [x-y for x, y in zip(a, b)]


def cross(a, b):
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]


def normalize(value):
    length = math.sqrt(dot(value, value))
    if length < 1e-12:
        raise ValueError('Degenerate tangent basis')
    return [c/length for c in value]


def triangle_basis(points, uvs, normal):
    if any(not math.isfinite(v) for values in [*points, *uvs, normal] for v in values) or dot(normal, normal) < 1e-12:
        return None
    normal = normalize(normal)
    e1, e2 = sub(points[1], points[0]), sub(points[2], points[0])
    d1, d2 = sub(uvs[1], uvs[0]), sub(uvs[2], uvs[0])
    determinant = d1[0]*d2[1]-d2[0]*d1[1]
    area_squared = dot(cross(e1, e2), cross(e1, e2))
    if abs(determinant) < 1e-14 or area_squared < 1e-24:
        return None
    tangent = [(e1[i]*d2[1]-e2[i]*d1[1])/determinant for i in range(3)]
    bitangent = [(e2[i]*d1[0]-e1[i]*d2[0])/determinant for i in range(3)]
    projection = dot(tangent, normal)
    tangent = sub(tangent, [n*projection for n in normal])
    if dot(tangent, tangent) < 1e-20:
        return None
    tangent = normalize(tangent)
    return area_squared, [*tangent, -1 if dot(cross(normal, tangent), bitangent) < 0 else 1]


def repair(path, glb):
    document, original = glb['read_glb'](path)
    binary = bytearray(original)
    def accessor(index):
        a = document['accessors'][index]
        v = document['bufferViews'][a['bufferView']]
        components = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
        code = {5121: 'B', 5123: 'H', 5125: 'I', 5126: 'f'}[a['componentType']]
        fmt = '<' + code*components
        start = v.get('byteOffset', 0) + a.get('byteOffset', 0)
        stride = v.get('byteStride', struct.calcsize(fmt))
        return [struct.unpack_from(fmt, binary, start+i*stride) for i in range(a['count'])], (start, stride)
    repaired = []
    changed = False
    for mesh_index, mesh in enumerate(document.get('meshes', [])):
        for primitive_index, primitive in enumerate(mesh['primitives']):
            attributes = primitive['attributes']
            if 'TANGENT' not in attributes:
                continue
            tangents, (start, stride) = accessor(attributes['TANGENT'])
            normals, _ = accessor(attributes['NORMAL']) if 'NORMAL' in attributes else (None, None)
            material = document.get('materials', [])[primitive['material']] if 'material' in primitive else {}
            reference = material.get('normalTexture')
            if reference and (normals is None or len(normals) != len(tangents) or any(
                    not all(math.isfinite(v) for v in n) or abs(math.sqrt(dot(n, n))-1) >= BASIS_TOLERANCE for n in normals)):
                raise ValueError('Normal-mapped tangent repair requires valid exported unit normals')
            bad = {i for i, t in enumerate(tangents) if not all(math.isfinite(v) for v in t)
                   or abs(math.sqrt(dot(t[:3], t[:3]))-1) >= BASIS_TOLERANCE
                   or abs(abs(t[3])-1) >= HANDEDNESS_TOLERANCE
                   or (normals is not None and abs(dot(normals[i], t[:3])) >= BASIS_TOLERANCE)}
            if not bad:
                continue
            if reference is None:
                # Unused tangent attributes have no shading role.
                del attributes['TANGENT']
                changed = True
                continue
            uv_index = reference.get('extensions', {}).get('KHR_texture_transform', {}).get('texCoord', reference.get('texCoord', 0))
            positions, _ = accessor(attributes['POSITION'])
            uvs, _ = accessor(attributes['TEXCOORD_' + str(uv_index)])
            indices = [v[0] for v in accessor(primitive['indices'])[0]] if 'indices' in primitive else list(range(len(positions)))
            best = {}
            for at in range(0, len(indices), 3):
                face = indices[at:at+3]
                affected = bad.intersection(face)
                for index in affected:
                    basis = triangle_basis([positions[i] for i in face], [uvs[i] for i in face], normals[index])
                    if basis and (index not in best or basis[0] > best[index][0]):
                        best[index] = basis
            if set(best) != bad:
                raise ValueError('Normal-mapped vertices have no nondegenerate tangent chart: ' + str(sorted(bad-set(best))))
            for index, (_, tangent) in best.items():
                struct.pack_into('<4f', binary, start+index*stride, *tangent)
            repaired.append({'mesh': mesh_index, 'primitive': primitive_index, 'vertices': len(best),
                             'method': 'largest incident UV triangle, orthogonalized against normal'})
    if changed or repaired or binary != original:
        glb['write_glb'](path, document, binary)
    return repaired
