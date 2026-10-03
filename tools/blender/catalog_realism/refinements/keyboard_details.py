"""Readable original keyboard controls and a bounded ergonomic mouse shell."""
from pathlib import Path
import math,runpy
_dir=Path(__file__).parent
_curves=runpy.run_path(str(_dir/'curved_construction.py'))
_garage=runpy.run_path(str(_dir/'garage_construction.py'))
_fixture=runpy.run_path(str(_dir/'fixture_contacts.py'))
bounds=_curves['bounds'];fit=_curves['fit'];outward=_curves['outward']

def bottom_row(x0,x1,y0,y1,z0,z1):
    widths=[1.2,1.2,1.2,6,1.2,1.2,1.2,1.2];gap=.004
    unit=(x1-x0-gap*7)/sum(widths);result=[];x=x0
    if unit<.01:raise ValueError('Original keyboard row is too narrow for its measured layout')
    for width in widths:
        result.append({'min':[x,y0,z0],'max':[x+width*unit,y1,z1]});x+=width*unit+gap
    return result

def mouse_shell(box):
    points=[];rings=[];faces=[];steps=32
    profile=[(.78,0),(1,.07),(1,.25),(.98,.52),(.88,.78),(.62,.95),(0,1)]
    for r,z in profile:
        if r==0:rings.append([len(points)]);points.append((0,.14,1));continue
        rings.append(list(range(len(points),len(points)+steps)))
        for i in range(steps):
            t=i*math.tau/steps
            x=math.copysign(abs(math.cos(t))**.65,math.cos(t))*r
            y=math.copysign(abs(math.sin(t))**.75,math.sin(t))*r
            points.append((x,y,z*(1-.22*(1-y)/2)))
    faces.append(tuple(reversed(rings[0])))
    for a,b in zip(rings,rings[1:]):
        for i in range(steps):
            j=(i+1)%steps
            faces.append((a[i],a[j],b[0]) if len(b)==1 else (a[i],a[j],b[j],b[i]))
    return outward(fit(points,box),faces)

def apply(root,scene,item,keys,names,evidence):
    import bpy
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    if item['id']!='keyboard-mouse' or item['sourceBlend']!=evidence['sourceBlend']:raise ValueError('Reviewed keyboard source changed')
    objects=_curves['_objects'](scene,names);checked={};points={};changes=[]
    for spec in evidence['objects']:checked[spec['name']],points[spec['name']]=_curves['_checked'](objects,spec,keys)
    key_names=['keycap']+[f'keycap.{i:03d}' for i in range(1,14)]
    old=bounds([p for name in key_names for p in points[name]])
    targets=bottom_row(old['min'][0],old['max'][0],old['min'][1],old['max'][1],old['min'][2],old['max'][2])
    for name,target in zip(key_names,targets):
        obj=checked[name];faces=[tuple(p.vertices) for p in obj.data.polygons]
        _curves['_replace'](obj,(fit(points[name],target),faces),smooth_sides=False)
    for name in key_names[8:]:
        obj=checked[name];data=obj.data;names.pop(obj.name,None);bpy.data.objects.remove(obj,do_unlink=True)
        if data.users==0:bpy.data.meshes.remove(data)
    changes.append({'kind':'source-evidenced-construction','component':'keyboard bottom key row','construction':'eight measured modifier/spacebar keys replace fourteen identical tiles; all four upper rows remain original','originalKeys':14,'candidateKeys':8,'spacebarRatio':5,'rowBoundsM':old})
    mouse=checked['mouse'];box=bounds(points['mouse']);stats=_curves['_replace'](mouse,mouse_shell(box),smooth_sides=False)
    for face in mouse.data.polygons:face.use_smooth=len(face.vertices)<=4
    changes.append({'kind':'source-evidenced-construction','component':'mouse','construction':'rounded shaped palm shell retains the original mouse footprint and maximum height',**stats})
    mouse.data.calc_loop_triangles();world=[mouse.matrix_world@v.co for v in mouse.data.vertices]
    tree=BVHTree.FromPolygons(world,[tuple(f.vertices) for f in mouse.data.loop_triangles],all_triangles=True)
    cx=(box['min'][0]+box['max'][0])/2;cy=(box['min'][1]+box['max'][1])/2
    def surface(x,y):
        hit=tree.ray_cast(Vector((x,y,box['max'][2]+.01)),Vector((0,0,-1)),.1)
        if hit[0] is None:raise ValueError('Mouse control has no original shell support')
        return tuple(hit[0])
    ink=checked['keyboard_case'].data.materials[0]
    if keys.get(ink.name)!='ink-detail':raise ValueError('Mouse controls require the existing dark keyboard material')
    seam=[surface(cx,box['min'][1]+.017+i*.003) for i in range(16)]
    seam=[(x,y,z-.00015) for x,y,z in seam]
    geometries=[('detail_mouse_button_division',_garage['tube'](seam,.0004,8),'fine seated division between the two front mouse buttons')]
    x,y,z=surface(cx,cy-.012)
    wheel=_garage['tube']([(x-.003,y,z-.002),(x+.003,y,z-.002)],.0045,24)
    geometries.append(('detail_mouse_scroll_wheel',wheel,'recessed transverse scroll wheel using the existing dark key-bed material'))
    for name,mesh,description in geometries:
        b=bounds(mesh[0])
        if any(b[s][a]<box['min'][a]-1e-7 or b[s][a]>box['max'][a]+1e-7 for s in ('min','max') for a in range(3)):raise ValueError('Mouse control escaped the original device envelope')
        obj=_fixture['_add'](scene,names,name,mesh,ink,True)
        changes.append({'kind':'source-evidenced-construction','newComponent':name,'construction':description,'candidateVertices':len(obj.data.vertices),'boundsM':b,'materialKey':'ink-detail'})
    return changes
