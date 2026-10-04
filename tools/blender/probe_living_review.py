"""Read-only owned imports for the three reviewed living/decor candidates.

Run ``runpy.run_path(path)['inspect'](root)`` through the root's native session.
Returns evidence; never saves source/candidate files or edits loaded geometry.
"""
import hashlib
import json
from pathlib import Path
import runpy


def inspect(root):
    import bpy
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    root = Path(root)
    source = runpy.run_path(str(root / 'tools/blender/catalog_realism/source.py'))
    counts = lambda: {kind: len(getattr(bpy.data, kind)) for kind in source['DATA_KINDS']}
    before = counts()
    result = {'version': 1, 'before': before, 'models': {}}
    for mid in ('landscape-painting', 'library-reading-loveseat', 'lift-coffee-table'):
        path = root / 'assets-source/blender' / (mid + '.blend')
        rows = []
        with source['load_source'](path) as (scene, keys, names):
            for obj in scene.objects:
                if obj.type != 'MESH': continue
                name = names[obj.name]
                obj.data.calc_loop_triangles()
                row = {'name': name, 'vertices': len(obj.data.vertices),
                       'materials': [keys[m.name] for m in obj.data.materials],
                       'bounds': source['mesh_bounds'](obj),
                       'origin': list(obj.matrix_world.translation),
                       'matrix': [list(v) for v in obj.matrix_world],
                       'uvLayers': [u.name for u in obj.data.uv_layers]}
                if 'sewn welt' in name:
                    pts = [obj.matrix_world @ v.co for v in obj.data.vertices]
                    row['sectionCenters'] = [list(sum(pts[i:i+6], Vector()) / 6) for i in range(0, len(pts), 6)]
                    row['firstSectionRadii'] = [(p - Vector(row['sectionCenters'][0])).length for p in pts[:6]]
                if name == 'valley_art':
                    row['front'] = []
                    for face in obj.data.polygons:
                        normal = obj.matrix_world.to_3x3().inverted().transposed() @ face.normal
                        if normal.y < -.99:
                            row['front'].append([{'position': list(obj.matrix_world @ obj.data.vertices[obj.data.loops[i].vertex_index].co),
                                                  'uv': list(obj.data.uv_layers[0].data[i].uv)} for i in face.loop_indices])
                rows.append(row)
        result['models'][mid] = {'sourceSha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'objects': rows}
    result['after'] = counts()
    if result['after'] != before: raise ValueError('Read-only probe did not restore owned native data')
    return result
