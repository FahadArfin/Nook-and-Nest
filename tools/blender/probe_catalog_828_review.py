"""Owned read-only source probe for four exact review defects."""
import hashlib
from pathlib import Path
import runpy


def inspect(root):
    import bpy
    root=Path(root);source=runpy.run_path(str(root/'tools/blender/catalog_realism/source.py'))
    counts=lambda:{k:len(getattr(bpy.data,k)) for k in source['DATA_KINDS']}
    result={'version':1,'before':counts(),'models':{}}
    for mid in ('upholstered-bar-stool','upholstered-dining-chair','vessel-sink','waffle-iron'):
        path=root/'assets-source/blender'/(mid+'.blend');rows=[]
        with source['load_source'](path) as (scene,keys,names):
            for obj in scene.objects:
                if obj.type!='MESH':continue
                rows.append({'name':names[obj.name],'vertices':len(obj.data.vertices),
                             'materials':[keys[m.name] for m in obj.data.materials],
                             'bounds':source['mesh_bounds'](obj),'matrix':[list(r) for r in obj.matrix_world],
                             'uvLayers':[u.name for u in obj.data.uv_layers],
                             'motionRole':obj.get('motion_role'),'sharedGeometry':obj.get('shared_geometry'),
                             'points':[list(obj.matrix_world@v.co) for v in obj.data.vertices],
                             'polygons':[list(p.vertices) for p in obj.data.polygons],
                             'edges':[list(e.vertices) for e in obj.data.edges]})
        result['models'][mid]={'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'objects':rows}
    result['after']=counts()
    if result['before']!=result['after']:raise ValueError('Read-only source ownership was not restored')
    return result
