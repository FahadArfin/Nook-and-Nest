"""Only the reviewed washer door, wood-stove logs and wall-reel hoses."""
from pathlib import Path
import runpy
_h=runpy.run_path(str(Path(__file__).with_name('household_756.py')))
_c=_h['_c'];_r=_h['_r'];_l=_h['_l'];_d=_r['_designed']
bounds=_c['bounds']


def washer_geometry(name,points,box,rim_box):
    if name in ('Fine perimeter gasket','Fine perimeter gasket.001'):
        return _r['door_gasket'](rim_box,int(name.endswith('.001')))
    if name not in ('washer_door_rim','washer_door_glass','washer_dial'):raise ValueError('Unexpected washer component')
    sides=14 if name=='washer_dial' else 24
    profile=_r['recover_profile'](points,1,sides)
    return _r['turned'](profile,box,96,1),{'radialSegments':96,'sourceRadialSegments':sides}


def validate_logs(points,faces):
    groups=_c['components'](len(points),[(a,b)for f in faces for a,b in zip(f,f[1:]+f[:1])])
    if len(groups)!=5 or any(len(g)!=30 for g in groups):raise ValueError('Expected the five original three-ring ten-sided logs')
    return [[points[i]for i in group]for group in groups]


def hose_geometry(points,model_box,front_limit=False):
    if len(points)!=(32 if front_limit else 24):raise ValueError('Expected original four/three eight-sided hose stations')
    centers,radius=_d['ring_centers'](points,8)
    path=_d['rounded_path'](centers,cut=.03,spacing=.002)
    if front_limit:
        # This hose, rather than the casing, sets the catalog's front extent.
        # Calibrate only its circular radius to that original plane; retain the
        # original connection centers instead of scaling/translating the sweep.
        unit,_=_l['tube'](path,1,12)
        limits=[(path[i//12][1]-model_box['min'][1])/(path[i//12][1]-p[1]) for i,p in enumerate(unit) if p[1]<path[i//12][1]-1e-8]
        calibrated=min(limits)
        if not .85*radius<=calibrated<=1.2*radius:raise ValueError('Measured hose radius no longer reaches the original front plane')
        radius=calibrated
    geometry=_l['tube'](path,radius,12)
    if any(p[a]<model_box['min'][a]-1e-8 or p[a]>model_box['max'][a]+1e-8 for p in geometry[0]for a in range(3)):
        raise ValueError('Rounded hose left its original catalog envelope')
    return geometry,{'radialSegments':12,'pathStations':len(path),'tubeRadiusM':radius,
                     'originalEndpointsM':[centers[0],centers[-1]],'catalogFrontPlanePreserved':front_limit}


def apply(root,scene,item,keys,names,evidence):
    import bpy
    if item['id'] not in ('washer','wood-stove','wall-hose-reel') or item['sourceBlend']!=evidence['sourceBlend']:
        raise ValueError('Wrong reviewed household source')
    objects=_c['_objects'](scene,names);specs={s['name']:s for s in evidence['objects']};checked={};points={};changes=[]
    for name,spec in specs.items():checked[name],points[name]=_c['_checked'](objects,spec,keys)
    def replace(name,geometry,description,detail=None,axis=None):
        if sum(len(f)-2 for f in geometry[1])>9000:raise ValueError('Household component exceeds its detail budget')
        changes.append({'kind':'source-evidenced-construction','component':name,'construction':description,
                        **_r['_replace'](checked[name],geometry,axis),**(detail or {}),
                        'preserved':['catalog dimensions, placement and canonical material keys','unrelated source geometry and protected motion']})
    if item['id']=='washer':
        for name,spec in specs.items():
            geometry,detail=washer_geometry(name,points[name],spec['bounds'],specs['washer_door_rim']['bounds'])
            gasket=name.startswith('Fine perimeter gasket')
            replace(name,geometry,'curved gasket seated on the door face' if gasket else 'smooth measured circular door or dial retaining all six authored radial stations',detail,None if gasket else 1)
    elif item['id']=='wood-stove':
        name='charred_round_log';faces=[tuple(p.vertices)for p in checked[name].data.polygons]
        parts=validate_logs(points[name],faces);logs,ridges=_h['log_geometry'](points[name],faces)
        replace(name,logs,'five rounded bark logs with restrained taper inside each original wood envelope',{'originalLogBoundsM':[bounds(part)for part in parts]})
        replace('split_log_bark_ridge',ridges,'thin curved bark fissures seated on the logs; original flames, grate and fireplace mechanism retained')
    else:
        for name in specs:
            geometry,detail=hose_geometry(points[name],evidence['modelBounds'],name=='short stowed hose')
            replace(name,geometry,'smooth twelve-sided flexible tube with rounded bends and exact original connection centers',detail)
    bpy.context.view_layer.update()
    return changes
