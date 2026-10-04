"""Measured contact and construction repairs for five reviewed household assets."""
from pathlib import Path
import math,runpy
_dir=Path(__file__).parent
_c=runpy.run_path(str(_dir/'curved_construction.py'))
_t=runpy.run_path(str(_dir/'textile_turning.py'))
_r=runpy.run_path(str(_dir/'round_appliances.py'))
_l=runpy.run_path(str(_dir/'laundry_construction.py'))
_room=runpy.run_path(str(_dir/'room_construction.py'))
bounds=_c['bounds'];outward=_c['outward'];fit=_c['fit']


def pillow_welt(obj,pad):
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    points=[tuple(obj.matrix_world@v.co) for v in obj.data.vertices]
    groups=_c['components'](len(points),[tuple(e.vertices) for e in obj.data.edges])
    if len(groups)!=3 or any(len(g)!=150 for g in groups):raise ValueError('Expected three original bedding loops')
    pad.data.calc_loop_triangles();pv=[pad.matrix_world@v.co for v in pad.data.vertices];box=bounds(pv)
    tree=BVHTree.FromPolygons(pv,[tuple(p.vertices) for p in pad.data.loop_triangles],all_triangles=True)
    all_parts=[];seated=0
    for group in groups:
        old=[points[i] for i in group];b=bounds(old)
        if b['max'][0]-b['min'][0]>.99:
            lookup={v:i for i,v in enumerate(group)}
            all_parts.append((old,[tuple(lookup[i] for i in f.vertices) for f in obj.data.polygons if all(i in lookup for i in f.vertices)]));continue
        centers,radius=_c['authored_trim_loop'](old);centers=_c['resample_closed'](centers,.008);path=[];normals=[]
        for p in centers:
            hit=tree.ray_cast(Vector((p[0],p[1],box['max'][2]+.06)),Vector((0,0,-1)),.3)
            if hit[0] is None or hit[1].z<.1 or math.dist(hit[0],p)>.075:raise ValueError('Pillow trim cannot follow the measured cover')
            normal=hit[1].normalized();path.append(hit[0]+normal*radius*.25);normals.append(normal)
        v=[];f=[];n=len(path)
        for i,p in enumerate(path):
            tangent=(path[(i+1)%n]-path[i-1]).normalized();side=tangent.cross(normals[i]).normalized();up=side.cross(tangent).normalized()
            for j in range(6):
                angle=j*math.tau/6;v.append(tuple(p+radius*(math.cos(angle)*side+math.sin(angle)*up)))
        for i in range(n):
            for j in range(6):f.append((i*6+j,((i+1)%n)*6+j,((i+1)%n)*6+(j+1)%6,i*6+(j+1)%6))
        all_parts.append(outward(v,f));seated+=1
    if seated!=1:raise ValueError('Expected exactly one pillow cover')
    return _room['combine'](all_parts)


def tray_rim(points):
    if len(points)!=336:raise ValueError('Expected seven original 48-point tray stations')
    original=points[144:192];old=bounds(original)
    path=_c['resample_closed'](original,.008);box=bounds(path)
    # Smooth interpolation cannot enlarge the lip's original XY envelope.
    path=[tuple(old['min'][a]+(p[a]-box['min'][a])/(box['max'][a]-box['min'][a])*(old['max'][a]-old['min'][a]) if a<2 else .684735974 for a in range(3)) for p in path]
    return _l['tube'](path,.005264026,12,True)


def log_geometry(points,faces):
    from mathutils import Vector
    groups=_c['components'](len(points),[(a,b) for f in faces for a,b in zip(f,f[1:]+f[:1])])
    if len(groups)!=5 or any(len(g)!=30 for g in groups):raise ValueError('Expected five original three-ring ten-sided logs')
    logs=[];ridges=[]
    for number,group in enumerate(groups):
        old=[points[i] for i in group];centers=[Vector(tuple(sum(p[a] for p in old[i:i+10])/10 for a in range(3))) for i in (0,10,20)]
        axis=(centers[-1]-centers[0]).normalized();u=(Vector(old[0])-centers[0]);u=(u-axis*u.dot(axis)).normalized();v=axis.cross(u).normalized()
        radius=sum((Vector(p)-centers[0]).length for p in old[:10])/10*.88
        vertices=[];polygons=[];sides=32;stations=13
        for j in range(stations):
            t=j/(stations-1);center=centers[0].lerp(centers[-1],t)
            for k in range(sides):
                angle=k*math.tau/sides;r=radius*(1-.14*t)*(1+.035*math.sin(7*angle+number)+.02*math.sin(13*angle+3*t))
                vertices.append(tuple(center+r*(u*math.cos(angle)+v*math.sin(angle))))
        for j in range(stations-1):
            for k in range(sides):polygons.append((j*sides+k,j*sides+(k+1)%sides,(j+1)*sides+(k+1)%sides,(j+1)*sides+k))
        polygons.extend([tuple(reversed(range(sides))),tuple((stations-1)*sides+k for k in range(sides))])
        # Retain each authored wood piece's envelope; remove the branch-like 80% taper.
        before=bounds(vertices);target=bounds(old);vertices=fit(vertices,target);logs.append(outward(vertices,polygons))
        def transformed(p):return tuple(target['min'][a]+(p[a]-before['min'][a])/(before['max'][a]-before['min'][a])*(target['max'][a]-target['min'][a]) for a in range(3))
        for q in range(4):
            angle=.45+q*.68;path=[]
            for j in range(13):
                t=.04+.92*j/12;center=centers[0].lerp(centers[-1],t);a=angle+.015*math.sin(t*9+q)
                r=radius*(1-.14*t)*(1+.035*math.sin(7*a+number)+.02*math.sin(13*a+3*t))
                path.append(transformed(tuple(center+r*.993*(u*math.cos(a)+v*math.sin(a)))))
            ridges.append(_l['tube'](path,.0012,6))
    return _room['combine'](logs),_room['combine'](ridges)


def apply(root,scene,item,keys,names,evidence):
    import bpy
    if item['sourceBlend']!=evidence['sourceBlend']:raise ValueError('Reviewed household source changed')
    objects=_c['_objects'](scene,names);checked={};specs={s['name']:s for s in evidence['objects']};changes=[]
    for spec in evidence['objects']:
        soft=spec['name']=='pillow';trim=spec['name']=='tailored_double_welt'
        checked[spec['name']]=_c['_checked'](objects,spec,keys,exact_bounds=not(soft or trim),exact_count=not soft)[0]
    def points(name):return [tuple(checked[name].matrix_world@v.co) for v in checked[name].data.vertices]
    def replace(name,g,description,axis=None):
        changes.append({'kind':'source-evidenced-construction','component':name,'construction':description,**_r['_replace'](checked[name],g,axis)})
    if item['id']=='sparkling-water-maker':
        name='Carbonation nozzle';box={s:list(specs[name]['bounds'][s]) for s in ('min','max')}
        box['min'][2]=specs['Bottle neck collar']['bounds']['max'][2]-.003
        replace(name,_r['turned']([(0,0),(.94,0),(1,.035),(1,.98),(.96,1),(0,1)],box,64,2),'carbonation tube reaches inside the bottle collar without moving glass or tower',2)
    elif item['id']=='spindle-bed':
        replace('tailored_double_welt',pillow_welt(checked['tailored_double_welt'],checked['pillow']),'one pillow loop seated on its soft cover; mattress and duvet loops retained exactly')
    elif item['id']=='steel-wheelbarrow':
        replace('rolled tray rim',tray_rim(points('deep pressed steel tray')),'continuous rolled rim follows the measured top station and intersects the pressed tray lip')
    elif item['id']=='stacked-laundry':
        for name in checked:
            if name.startswith('Fine perimeter gasket'):
                index=0 if name=='Fine perimeter gasket' else int(name.rsplit('.',1)[1]);rim='stacked_washer_door_rim' if index<2 else 'stacked_dryer_door_rim'
                g,_=_r['door_gasket'](specs[rim]['bounds'],index%2);replace(name,g,'curved gasket half seated on the round door rim')
            else:
                sides=14 if name.endswith('_dial') else 24;profile=_r['recover_profile'](points(name),1,sides)
                replace(name,_r['turned'](profile,specs[name]['bounds'],96,1),'smooth measured circular door or dial retaining original radial stations and dimensions',1)
    elif item['id']=='stone-arch-fireplace':
        logs,ridges=log_geometry(points('charred_round_log'),[tuple(p.vertices) for p in checked['charred_round_log'].data.polygons])
        replace('charred_round_log',logs,'five rounded bark logs with restrained taper inside each original wood envelope')
        replace('split_log_bark_ridge',ridges,'thin curved bark fissures seated along the five log surfaces; original flames and grate unchanged')
    else:raise ValueError('Wrong household repair ID')
    bpy.context.view_layer.update();return changes
