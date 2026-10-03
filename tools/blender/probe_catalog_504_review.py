"""Owned read-only native source probe for four five-view construction rejects."""
import hashlib
from pathlib import Path
import runpy


IDS = ('mantel-clock', 'mesh-dining-chair', 'midcentury-sofa', 'mirror')


def inspect(root):
    root = Path(root)
    import bpy
    source = runpy.run_path(str(root / 'tools/blender/catalog_realism/source.py'))
    counts = lambda: {k: len(getattr(bpy.data, k)) for k in source['DATA_KINDS']}
    before = counts()
    result = {'version': 1, 'before': before, 'models': {}}
    for mid in IDS:
        path = root / 'assets-source/blender' / (mid + '.blend')
        rows = []
        with source['load_source'](path) as (scene, keys, names):
            for obj in scene.objects:
                if obj.type != 'MESH': continue
                name = names[obj.name]
                if mid == 'mantel-clock' and name not in ('arched_case_lower', 'arched_upper_case', 'ivory_porcelain_dial', 'mantel_plinth'): continue
                if mid == 'mesh-dining-chair' and any(x in name for x in ('strand', 'woven', 'welt')): continue
                if mid == 'midcentury-sofa' and not name.startswith('juniper_'): continue
                points = [obj.matrix_world @ v.co for v in obj.data.vertices]
                row = {'name': name, 'vertices': len(points), 'triangles': sum(len(p.vertices)-2 for p in obj.data.polygons),
                       'materials': [keys[m.name] for m in obj.data.materials], 'bounds': source['mesh_bounds'](obj),
                       'matrix': [list(r) for r in obj.matrix_world], 'uvLayers': [u.name for u in obj.data.uv_layers],
                       'modifiers': [m.type for m in obj.modifiers],
                       'motionRole': obj.get('motion_role'), 'sharedGeometry': obj.get('shared_geometry')}
                if mid == 'mantel-clock' or name.startswith('mirror_sun_'):
                    row['points'] = [list(p) for p in points]
                    row['polygons'] = [list(p.vertices) for p in obj.data.polygons]
                    row['smoothFaces'] = sum(p.use_smooth for p in obj.data.polygons)
                rows.append(row)
        result['models'][mid] = {'sourceSha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'objects': rows}
    result['after'] = counts()
    if before != result['after']: raise ValueError('Read-only import did not restore native ownership')
    return result
