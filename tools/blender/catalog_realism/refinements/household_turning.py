"""Measured kettle shell, child table and mug handle corrections only."""
from pathlib import Path
import math,runpy
_dir=Path(__file__).parent
_curves=runpy.run_path(str(_dir/'curved_construction.py'))
_round=runpy.run_path(str(_dir/'round_appliances.py'))
_garage=runpy.run_path(str(_dir/'garage_construction.py'))
bounds=_curves['bounds'];fit=_curves['fit'];outward=_curves['outward']

def monotone(rows,steps=6,zero_start=False):
    if len(rows)<2 or any(b[0]<=a[0] for a,b in zip(rows,rows[1:])):raise ValueError('Strictly increasing measured profile abscissae required')
    intervals=[b[0]-a[0] for a,b in zip(rows,rows[1:])]
    slopes=[(b[1]-a[1])/h for a,b,h in zip(rows,rows[1:],intervals)]
    tangents=[0 if zero_start else slopes[0]]
    for i in range(1,len(rows)-1):
        a,b=slopes[i-1:i+1]
        if a*b<=0:tangents.append(0)
        else:
            w1=2*intervals[i]+intervals[i-1];w2=intervals[i]+2*intervals[i-1]
            tangents.append((w1+w2)/(w1/a+w2/b))
    tangents.append(slopes[-1]);result=[]
    for i,(a,b) in enumerate(zip(rows,rows[1:])):
        h=intervals[i]
        for j in range(steps):
            t=j/steps
            value=(2*t**3-3*t*t+1)*a[1]+(t**3-2*t*t+t)*h*tangents[i]
            value+=(-2*t**3+3*t*t)*b[1]+(t**3-t*t)*h*tangents[i+1]
            result.append((a[0]+h*t,value))
    return result+[rows[-1]]

def source_profile(points,count):
    if len(points)%count:raise ValueError('Source turned station count changed')
    box=bounds(points);cx,cy=[(box['min'][a]+box['max'][a])/2 for a in (0,1)]
    rx,ry=[(box['max'][a]-box['min'][a])/2 for a in (0,1)];result=[]
    for start in range(0,len(points),count):
        row=points[start:start+count];zs=[p[2] for p in row]
        rs=[math.hypot((p[0]-cx)/rx,(p[1]-cy)/ry) for p in row]
        if max(zs)-min(zs)>2e-6 or max(rs)-min(rs)>2e-5:raise ValueError('Source shell is no longer concentric')
        r=sum(rs)/count;t=(sum(zs)/count-box['min'][2])/(box['max'][2]-box['min'][2])
        result.append((0 if r<1e-6 else 1 if abs(r-1)<1e-6 else r,0 if abs(t)<1e-6 else 1 if abs(t-1)<1e-6 else t))
    return result

def closed_lathe(profile,box,segments=96):
    points=[];rings=[];faces=[]
    cx,cy=[(box['min'][a]+box['max'][a])/2 for a in (0,1)]
    rx,ry=[(box['max'][a]-box['min'][a])/2 for a in (0,1)]
    for r,t in profile:
        z=box['min'][2]+t*(box['max'][2]-box['min'][2])
        n=1 if r<1e-8 else segments;rings.append(list(range(len(points),len(points)+n)))
        points += [(cx+rx*r*math.cos(i*math.tau/n),cy+ry*r*math.sin(i*math.tau/n),z) for i in range(n)]
    for a,b in zip(rings,rings[1:]+rings[:1]):
        if len(a)==len(b)==1:continue
        for i in range(segments):
            j=(i+1)%segments
            if len(a)==1:faces.append((a[0],b[j],b[i]))
            elif len(b)==1:faces.append((a[i],a[j],b[0]))
            else:faces.append((a[i],a[j],b[j],b[i]))
    return outward(fit(points,box),faces)

def kettle_shell(profile,box,kind):
    if kind=='lid':
        if len(profile)!=5 or profile[-1][0]!=0:raise ValueError('Expected the authored four-band kettle dome')
        outer=list(reversed(monotone(list(reversed(profile)),6,zero_start=True)))
        thickness=.003/(box['max'][2]-box['min'][2])
        inner=[(r*.99,max(.004,t-thickness)) for r,t in reversed(outer)]
        return closed_lathe(outer+inner,box)
    if kind!='bowl' or len(profile)!=6:raise ValueError('Expected six original double-wall bowl stations')
    outer=monotone(profile[:3],8);inner=list(reversed(monotone(list(reversed(profile[3:])),8)))
    return closed_lathe(outer+inner,box)

def mug_handle(path,radius,box):
    if len(path)!=8 or not .003<radius<.009:raise ValueError('Expected original eight-anchor ceramic handle')
    curve=_garage['rounded_path'](path,cut=.006,spacing=.0015)
    points,faces=_garage['tube'](curve,radius,20)
    return outward(fit(points,box),faces)

def apply(root,scene,item,keys,names,evidence):
    ident=item['id']
    if ident not in ('kettle-bbq','kids-round-play-table','kitchen-everyday-mug') or item['sourceBlend']!=evidence['sourceBlend']:raise ValueError('Reviewed household source changed')
    objects=_curves['_objects'](scene,names);checked={};points={};changes=[]
    for spec in evidence['objects']:checked[spec['name']],points[spec['name']]=_curves['_checked'](objects,spec,keys)
    for spec in evidence['objects']:
        name=spec['name'];obj=checked[name];extra={}
        if ident=='kettle-bbq':
            kind='bowl' if name=='double_walled_spun_bowl' else 'lid'
            profile=source_profile(points[name],48)
            mesh=kettle_shell(profile,spec['bounds'],kind)
            description='smooth measured spun '+kind+' with closed thin material wall and preserved original envelope'
            extra={'measuredProfile':profile,'radialSegments':96,'smoothProfileSubdivisions':6 if kind=='lid' else 8}
        elif ident=='kids-round-play-table':
            target=spec['bounds'];profile=_round['recover_profile'](points[name],2,32)
            if name=='sculpted_center_pedestal':
                top=next(s for s in evidence['objects'] if s['name']=='shaped_slab_top')
                target,extra=_round['contact_target'](target,top['bounds'])
            mesh=_round['turned'](profile,target,128)
            description='smooth source turned stations with the pedestal seated below its top'
        else:
            path=_garage['centers'](points[name],12);radius=_garage['source_radius'](points[name],12)
            mesh=mug_handle(path,radius,spec['bounds'])
            description='smooth continuous ceramic D handle in the original attachment and silhouette envelope'
            extra={'originalAnchorsM':path,'sectionRadiusM':radius,'tubeSides':20}
        box=bounds(mesh[0])
        if any(box[s][a]<evidence['bounds']['min'][a]-1e-7 or box[s][a]>evidence['bounds']['max'][a]+1e-7 for s in ('min','max') for a in range(3)):raise ValueError('Household correction escaped original dimensions')
        stats=_curves['_replace'](obj,mesh,smooth_sides=False)
        for face in obj.data.polygons:
            zs=[(obj.matrix_world@obj.data.vertices[v].co).z for v in face.vertices]
            face.use_smooth=len(face.vertices)<=4 and (ident!='kids-round-play-table' or max(zs)-min(zs)>1e-8)
        changes.append({'kind':'source-evidenced-construction','component':name,'construction':description,**stats,**extra})
    return changes
