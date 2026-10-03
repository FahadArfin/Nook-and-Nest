"""Exact reviewed lamp, handle, hose, chair seam and saw-guard repairs."""
import math
from pathlib import Path
import runpy

_dir=Path(__file__).parent
_curves=runpy.run_path(str(_dir/'curved_construction.py'))
_design=runpy.run_path(str(_dir/'designed_construction.py'))
_textile=runpy.run_path(str(_dir/'textile_turning.py'))
_shell=runpy.run_path(str(_dir/'silhouette_geometry.py'))
bounds=_curves['bounds'];fit=_curves['fit'];outward=_curves['outward']


def tube(path,radius,sides=20):
    # All inspected paths predominantly lie in XZ. A fixed Y reference has no
    # vertical-axis branch and remains stable through their bend directions.
    cross=_design['cross'];unit=_design['unit'];vertices=[];faces=[]
    for i,p in enumerate(path):
        a=path[max(0,i-1)];b=path[min(len(path)-1,i+1)]
        direction=unit(tuple(b[k]-a[k] for k in range(3)))
        if abs(direction[1])>.3:raise ValueError('Reviewed XZ tube left its bounded plane')
        side=unit(cross((0,1,0),direction));normal=cross(direction,side)
        for j in range(sides):
            angle=j*math.tau/sides
            vertices.append(tuple(p[k]+radius*(math.cos(angle)*side[k]+math.sin(angle)*normal[k]) for k in range(3)))
    for i in range(len(path)-1):
        for j in range(sides):faces.append((i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j))
    faces += [tuple(reversed(range(sides))),tuple(range((len(path)-1)*sides,len(path)*sides))]
    return outward(vertices,faces)


def original_centers(points):
    if len(points)!=32:raise ValueError('Expected four original eight-sided path stations')
    return [tuple(sum(p[a] for p in points[j:j+8])/8 for a in range(3)) for j in range(0,32,8)]


def handle(points):
    centers=original_centers(points);box=bounds(points)
    middle_y=sum(p[1] for p in centers)/4
    centers=[(p[0],middle_y,p[2]) for p in centers]
    path=_design['rounded_path'](centers,cut=.013,spacing=.004)
    vertices,faces=tube(path,.008,24)
    return outward(fit(vertices,box),faces)


def hose(points):
    centers=original_centers(points);end=centers[-1]
    # Meet the existing horizontal brass socket with a horizontal final tangent.
    centers.insert(-1,(end[0]+.020,end[1],end[2]))
    path=_design['rounded_path'](centers,cut=.036,spacing=.004)
    return tube(path,.0053,20)


def solve3(matrix,values):
    rows=[list(row)+[value] for row,value in zip(matrix,values)]
    for col in range(3):
        pivot=max(range(col,3),key=lambda i:abs(rows[i][col]))
        rows[col],rows[pivot]=rows[pivot],rows[col]
        if abs(rows[col][col])<1e-9:raise ValueError('Degenerate authored arc')
        d=rows[col][col];rows[col]=[v/d for v in rows[col]]
        for row in range(3):
            if row==col:continue
            d=rows[row][col];rows[row]=[a-d*b for a,b in zip(rows[row],rows[col])]
    return [row[-1] for row in rows]


def lamp_profile(kind):
    # The shared lathe closes the contour itself; repeating the first station
    # would introduce a ring of zero-area quads at the shade mouth.
    if kind=='shade':return [(.99,0),(1,.025),(.432,.98),(.425,1),(.407,1),(.414,.98),(.98,.025),(.972,0)]
    if kind=='hem':return [(.975,0),(1,.13),(1,.87),(.975,1),(.9,1),(.89,.87),(.89,.13),(.9,0)]
    raise ValueError('Unknown inspected lamp shell')


def guard(points,faces,span,steps=112):
    if len(points)!=116 or len(faces)!=114:raise ValueError('Expected four measured 29-station guard arcs')
    samples=(0,14,28);matrix=[(1,math.cos(span*j/28),math.sin(span*j/28)) for j in samples]
    result=[]
    for ring in range(4):
        coeffs=[solve3(matrix,[points[ring*29+j][a] for j in samples]) for a in range(3)]
        def at(t):return tuple(c+a*math.cos(t)+b*math.sin(t) for c,a,b in coeffs)
        if max(math.dist(points[ring*29+j],at(span*j/28)) for j in range(29))>2e-6:
            raise ValueError('Guard arc differs from the inspected affine circular profile')
        result.extend(at(span*j/steps) for j in range(steps+1))
    n=steps+1;polygons=[]
    for j in range(steps):
        polygons += [(j,j+1,n+j+1,n+j),(2*n+j,3*n+j,3*n+j+1,2*n+j+1),
                     (j,2*n+j,2*n+j+1,j+1),(n+j,n+j+1,3*n+j+1,3*n+j)]
    polygons += [(0,n,3*n,2*n),(steps,2*n+steps,3*n+steps,n+steps)]
    return outward(fit(result,bounds(points)),polygons)


def apply(root,scene,item,keys,names,evidence):
    import bpy
    from mathutils import Vector
    if item['sourceBlend']!=evidence['sourceBlend']:raise ValueError('Reviewed utility source changed')
    objects=_curves['_objects'](scene,names);checked={};changes=[]
    for spec in evidence['objects']:
        soft=spec['name']=='tailored_seat_cushion'
        trim=spec['name']=='seat_double_welt'
        checked[spec['name']]=_curves['_checked'](objects,spec,keys,exact_bounds=not(soft or trim),exact_count=not soft)[0]
    def points(obj):return [tuple(obj.matrix_world@v.co) for v in obj.data.vertices]
    def replace(name,geometry,description):
        if sum(len(f)-2 for f in geometry[1])>10000:raise ValueError('Isolated repair exceeds component budget')
        obj=checked[name]
        change=_textile['_replace'](obj,geometry)
        changes.append({'kind':'source-evidenced-construction','component':name,'construction':description,**change,
                        'preserved':['catalog dimensions and material keys','unrelated geometry and motion']})
        return obj
    if item['id'] in ('food-processor','countertop-blender'):
        name='loop_jug_handle';replace(name,handle(points(checked[name])),'continuous rounded handle with stable untapered cross section in the original bounds')
    elif item['id']=='gaming-chair':
        geometry,detail=_textile['_chair_welt'](checked['seat_double_welt'],checked['tailored_seat_cushion'])
        replace('seat_double_welt',geometry,'continuous round piping seated against the existing tailored cushion')
        changes[-1].update(detail)
    elif item['id']=='garage-air-hose-reel':
        name='Stowed reel lead';replace(name,hose(points(checked[name])),'rounded flexible lead with a horizontal tangent into the existing brass quick coupler')
    elif item['id']=='garage-circular-saw':
        for name,span in [('Upper blade guard',math.pi),('Retracted lower blade guard',math.pi*1.14)]:
            obj=checked[name];geometry=guard(points(obj),[tuple(f.vertices) for f in obj.data.polygons],span)
            obj=replace(name,geometry,'smooth measured guard arcs retain the existing blade, carbide teeth, shoe and arbor')
            for face in obj.data.polygons:
                ys=[(obj.matrix_world@obj.data.vertices[i].co).y for i in face.vertices]
                face.use_smooth=max(ys)-min(ys)>1e-6
            bevel=obj.modifiers.new('Reviewed guard edge radius','BEVEL');bevel.width=.00045;bevel.segments=2;bevel.limit_method='ANGLE'
    elif item['id']=='floor-lamp':
        name='floor_lamp_bell_shade';box=bounds(points(checked[name]))
        profile=lamp_profile('shade')
        obj=replace(name,_shell['lathe'](profile,box,96),'open thin-wall tapered shade with retained outer envelope')
        name='floor_lamp_shade_rim';rimbox=bounds(points(checked[name]))
        profile=lamp_profile('hem')
        replace(name,_shell['lathe'](profile,rimbox,96),'closed rolled annular hem replaces the solid underside cap')
        material_map={keys[m.name]:m for o in scene.objects if o.type=='MESH' for m in o.data.materials if m}
        cx,cy=[(box['min'][a]+box['max'][a])/2 for a in (0,1)]
        def add(name,geometry,key):
            vertices,faces=geometry;mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.materials.append(material_map[key]);mesh.update()
            for face in mesh.polygons:face.use_smooth=len(face.vertices)==4
            obj=bpy.data.objects.new(name,mesh);scene.collection.objects.link(obj)
            changes.append({'kind':'source-evidenced-construction','component':name,'construction':'interior fitting seated on the existing offset support arm','materialKey':key,'candidateVertices':len(vertices)})
        socket={'min':[cx-.019,cy-.019,1.240],'max':[cx+.019,cy+.019,1.294]}
        add('Reviewed shade socket',_shell['lathe']([(0,0),(1,0),(1,.92),(.88,1),(0,1)],socket,48),'aged-bronze')
        bulb={'min':[cx-.032,cy-.032,1.281],'max':[cx+.032,cy+.032,1.385]}
        add('Reviewed shade bulb',_shell['lathe']([(0,0),(.45,0),(.48,.22),(.83,.4),(1,.64),(.96,.79),(.7,.94),(0,1)],bulb,48),'linen-textured')
    else:raise ValueError('Unsupported reviewed utility repair')
    bpy.context.view_layer.update()
    return changes
