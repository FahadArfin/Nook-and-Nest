"""Read-only owned native imports for six exact reviewed construction defects."""
import hashlib
from pathlib import Path
import runpy

IDS=('patio-fire-bowl','patio-fire-table','patio-parasol','pizza-oven-cart','pleated-table-lamp','pet-feeding-station')


def inspect(root):
    import bpy
    root=Path(root)
    source=runpy.run_path(str(root/'tools/blender/catalog_realism/source.py'))
    counts=lambda:{k:len(getattr(bpy.data,k)) for k in source['DATA_KINDS']}
    before=counts();result={'version':1,'before':before,'models':{}}
    for mid in IDS:
        path=root/'assets-source/blender'/(mid+'.blend');rows=[]
        with source['load_source'](path) as (scene,keys,names):
            for obj in scene.objects:
                if obj.type!='MESH':continue
                name=names[obj.name]
                row={'name':name,'vertices':len(obj.data.vertices),'materials':[keys[m.name] for m in obj.data.materials],
                     'bounds':source['mesh_bounds'](obj),'matrix':[list(r) for r in obj.matrix_world],
                     'uvLayers':[u.name for u in obj.data.uv_layers], 'motionRole':obj.get('motion_role'),
                     'sharedGeometry':obj.get('shared_geometry'),'smoothFaces':sum(p.use_smooth for p in obj.data.polygons)}
                if name.startswith(('split_firewood','stone_surround','curved_sewn_canopy_gore','canopy_rib','refractory_barrel_vault','oven_dark_back','shade_core','open_food_bowl','lampshade_bound_hem')) or name in ('linen_pleat','double_walled_spun_bowl'):
                    row['points']=[list(obj.matrix_world@v.co) for v in obj.data.vertices]
                    row['polygons']=[list(p.vertices) for p in obj.data.polygons]
                rows.append(row)
        result['models'][mid]={'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'objects':rows}
    result['after']=counts()
    if before!=result['after']:raise ValueError('Read-only source ownership was not restored')
    return result
