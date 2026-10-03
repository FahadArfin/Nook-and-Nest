"""Measured circular furniture/appliance silhouettes for three reviewed IDs."""
import math,runpy
from pathlib import Path
_dir=Path(__file__).parent
_c=runpy.run_path(str(_dir/'curved_construction.py'))
_t=runpy.run_path(str(_dir/'round_appliances.py'))
bounds=_c['bounds'];outward=_c['outward'];fit=_c['fit']


def rounded_cylinder(points,faces,segments=96):
    caps=[f for f in faces if len(f)==32]
    if len(caps)!=2 or len(points)!=64:raise ValueError('Expected the two measured 32-sided plate caps')
    centers=[tuple(sum(points[i][a] for i in f)/32 for a in range(3)) for f in caps]
    a,b=centers
    u=tuple(points[caps[0][0]][k]-a[k] for k in range(3))
    v=tuple(points[caps[0][8]][k]-a[k] for k in range(3))
    w=tuple(b[k]-a[k] for k in range(3))
    if min(math.dist(a,b),math.sqrt(sum(x*x for x in u)),math.sqrt(sum(x*x for x in v)))<.001:raise ValueError('Collapsed measured plate basis')
    profile=[(0,0),(.98,0),(.995,.04),(1,.12),(1,.88),(.995,.96),(.98,1),(0,1)]
    vertices=[];rings=[];result=[]
    for radius,t in profile:
        if radius==0:rings.append([len(vertices)]);vertices.append(tuple(a[k]+t*w[k] for k in range(3)))
        else:
            rings.append(list(range(len(vertices),len(vertices)+segments)))
            for i in range(segments):
                angle=i*math.tau/segments
                vertices.append(tuple(a[k]+t*w[k]+radius*(u[k]*math.cos(angle)+v[k]*math.sin(angle)) for k in range(3)))
    for first,second in zip(rings,rings[1:]):
        for i in range(segments):
            j=(i+1)%segments
            if len(first)==1:result.append((first[0],second[j],second[i]))
            elif len(second)==1:result.append((first[i],first[j],second[0]))
            else:result.append((first[i],first[j],second[j],second[i]))
    return outward(fit(vertices,bounds(points)),result)


def apply(root,scene,item,keys,names,evidence):
    if item['sourceBlend']!=evidence['sourceBlend']:raise ValueError('Measured turned source changed')
    objects=_c['_objects'](scene,names);changes=[]
    for spec in evidence['objects']:
        obj,points=_c['_checked'](objects,spec,keys)
        if item['id']=='rotary-waffle-maker':
            mesh=rounded_cylinder(points,[tuple(f.vertices) for f in obj.data.polygons]);axis=None
            description='smooth rounded plate or lid with original tilted axis, grid and hinge retained'
        else:
            profile=_t['recover_profile'](points,2,32)
            mesh=_t['turned'](profile,spec['bounds'],128,2);axis=2
            description='128-sided turned profile retaining original radial stations, dimensions and support construction'
        changes.append({'kind':'source-evidenced-construction','component':spec['name'],'construction':description,**_t['_replace'](obj,mesh,axis)})
        if axis is None:
            # The radial strips are smooth, the center cap triangles remain flat.
            for face in obj.data.polygons:face.use_smooth=len(face.vertices)==4
    return changes
