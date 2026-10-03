"""Measured laundry shells, cloth sacks and flexible connections; six exact IDs."""
import math
from pathlib import Path
import runpy

_dir=Path(__file__).parent
_curves=runpy.run_path(str(_dir/'curved_construction.py'))
_design=runpy.run_path(str(_dir/'designed_construction.py'))
_textile=runpy.run_path(str(_dir/'textile_turning.py'))
_shell=runpy.run_path(str(_dir/'silhouette_geometry.py'))
bounds=_curves['bounds'];fit=_curves['fit'];outward=_curves['outward']


def mix(a,b,t):return tuple(x+(y-x)*t for x,y in zip(a,b))


def tube(path,radius,sides=16,closed=False):
    """Continuous circular sections using an axis least aligned to the path."""
    if len(path)<3 or radius<=0:raise ValueError('Invalid tube')
    def unit(v):
        length=math.sqrt(sum(x*x for x in v))
        if length<1e-10:raise ValueError('Degenerate tube tangent')
        return tuple(x/length for x in v)
    def cross(a,b):return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
    directions=[unit(tuple(b-a for a,b in zip(path[max(0,i-1)],path[min(len(path)-1,i+1)]))) for i in range(len(path))]
    axis=min(range(3),key=lambda a:max(abs(d[a]) for d in directions))
    reference=tuple(float(a==axis) for a in range(3));vertices=[];faces=[]
    for i,p in enumerate(path):
        if closed:
            t=unit(tuple(b-a for a,b in zip(path[(i-1)%len(path)],path[(i+1)%len(path)])))
        else:t=directions[i]
        u=unit(cross(t,reference));v=cross(t,u)
        for j in range(sides):
            angle=2*math.pi*j/sides
            vertices.append(tuple(p[a]+radius*(math.cos(angle)*u[a]+math.sin(angle)*v[a]) for a in range(3)))
    for i in range(len(path) if closed else len(path)-1):
        for j in range(sides):faces.append((i*sides+j,i*sides+(j+1)%sides,((i+1)%len(path))*sides+(j+1)%sides,((i+1)%len(path))*sides+j))
    if not closed:faces.extend([tuple(reversed(range(sides))),tuple((len(path)-1)*sides+j for j in range(sides))])
    return outward(vertices,faces)


def rounded_ring(points):
    if len(points)!=28:raise ValueError('Expected measured 28-point rounded rectangle')
    b=bounds(points);cx=(b['min'][0]+b['max'][0])/2;cy=(b['min'][1]+b['max'][1])/2
    hx=(b['max'][0]-b['min'][0])/2;hy=(b['max'][1]-b['min'][1])/2
    rx=points[0][0]-points[6][0];ry=points[6][1]-points[0][1]
    if not 0<rx<=hx or not 0<ry<=hy:raise ValueError('Rounded corner measurement changed')
    result=[];z=sum(p[2] for p in points)/28
    centers=[(cx+hx-rx,cy+hy-ry),(cx-hx+rx,cy+hy-ry),(cx-hx+rx,cy-hy+ry),(cx+hx-rx,cy-hy+ry)]
    for q in range(4):
        c=centers[q]
        for j in range(20):
            a=(q+j/20)*math.pi/2;result.append((c[0]+rx*math.cos(a),c[1]+ry*math.sin(a),z))
        a=(q+1)*math.pi/2;start=(c[0]+rx*math.cos(a),c[1]+ry*math.sin(a),z)
        c2=centers[(q+1)%4];end=(c2[0]+rx*math.cos(a),c2[1]+ry*math.sin(a),z)
        result.extend(mix(start,end,j/8) for j in range(8))
    return result


def hollow_container(points,cloth=False):
    count=5 if cloth else 6
    if len(points)!=count*28+2:raise ValueError('Measured hollow shell topology changed')
    rings=[rounded_ring(points[i*28:(i+1)*28]) for i in range(count)]
    if cloth:
        # The source inner bottom was wider than its outer bottom. Keep the
        # outer footprint, with a real cloth wall and a closed bottom seam.
        t=(rings[-1][0][2]-rings[0][0][2])/(rings[1][0][2]-rings[0][0][2])
        floor=[mix(a,b,t) for a,b in zip(rings[0],rings[1])]
        cx=sum(p[0] for p in floor)/len(floor)
        rings[-1]=[(cx+(x-cx)*.984,y*.987,z) for x,y,z in floor]
    refined=[]
    for j in range(count-1):
        steps=(10 if cloth else 14) if j in (0,count-2) else 2
        for n in range(steps):refined.append([mix(a,b,n/steps) for a,b in zip(rings[j],rings[j+1])])
    refined.append(rings[-1])
    if cloth:
        b=bounds(points);cx=(b['min'][0]+b['max'][0])/2;z0=b['min'][2];height=b['max'][2]-z0
        for ring in refined:
            for j,(x,y,z) in enumerate(ring):
                t=(z-z0)/height;envelope=math.sin(math.pi*t)**2
                # Small inward folds only; suspension/rim and original bounds stay fixed.
                wave=(.006+.003*math.sin(t*15+2*math.pi*j/len(ring))) * envelope
                angle=math.atan2(y,(x-cx)*1.2)
                ring[j]=(x-wave*math.cos(angle),y-wave*math.sin(angle),z)
    vertices=[p for ring in refined for p in ring];n=len(rings[0]);faces=[]
    for j in range(len(refined)-1):
        for k in range(n):faces.append((j*n+k,j*n+(k+1)%n,(j+1)*n+(k+1)%n,(j+1)*n+k))
    for ring_index in (0,len(refined)-1):
        ring=refined[ring_index];center=tuple(sum(p[a] for p in ring)/n for a in range(3));idx=len(vertices);vertices.append(center)
        for k in range(n):faces.append((idx,ring_index*n+(k+1)%n,ring_index*n+k) if ring_index==0 else (idx,ring_index*n+k,ring_index*n+(k+1)%n))
    return outward(vertices,faces)


def spline_ring(points,subdivisions=8):
    out=[]
    for j,p1 in enumerate(points):
        p0=points[(j-1)%len(points)];p2=points[(j+1)%len(points)];p3=points[(j+2)%len(points)]
        for k in range(subdivisions):
            t=k/subdivisions
            out.append(tuple(.5*(2*p1[a]+(-p0[a]+p2[a])*t+(2*p0[a]-5*p1[a]+4*p2[a]-p3[a])*t*t+(-p0[a]+3*p1[a]-3*p2[a]+p3[a])*t*t*t) for a in range(3)))
    old=bounds(out);target=bounds(points)
    return [tuple(target['min'][a]+(p[a]-old['min'][a])/(old['max'][a]-old['min'][a])*(target['max'][a]-target['min'][a]) if old['max'][a]-old['min'][a]>1e-10 else target['min'][a] for a in range(3)) for p in out]


def iron_shell(points):
    if len(points) not in (22,33):raise ValueError('Measured iron shell topology changed')
    rings=[spline_ring(points[i:i+11]) for i in range(0,len(points),11)]
    vertices=[p for ring in rings for p in ring];n=len(rings[0]);faces=[]
    for j in range(len(rings)-1):
        for k in range(n):faces.append((j*n+k,j*n+(k+1)%n,(j+1)*n+(k+1)%n,(j+1)*n+k))
    faces.extend([tuple(reversed(range(n))),tuple((len(rings)-1)*n+k for k in range(n))])
    return outward(vertices,faces)


def centers(points,sides):
    if len(points)%sides:raise ValueError('Inspected sweep sections changed')
    return [tuple(sum(p[a] for p in points[i:i+sides])/sides for a in range(3)) for i in range(0,len(points),sides)]


def smooth_shade(points):
    if len(points)!=192:raise ValueError('Measured shade topology changed')
    b=bounds(points);cx=(b['min'][0]+b['max'][0])/2;cy=(b['min'][1]+b['max'][1])/2
    profile=[]
    for i in range(0,192,48):
        ring=points[i:i+48];profile.append((max(p[0] for p in ring)-cx,sum(p[2] for p in ring)/48))
    vertices=[];faces=[];n=128
    ratio=(b['max'][1]-b['min'][1])/(b['max'][0]-b['min'][0])
    for radius,z in profile:
        vertices.extend((cx+radius*math.cos(2*math.pi*j/n),cy+radius*ratio*math.sin(2*math.pi*j/n),z) for j in range(n))
    for i in range(4):
        for j in range(n):faces.append((i*n+j,i*n+(j+1)%n,((i+1)%4)*n+(j+1)%n,((i+1)%4)*n+j))
    return outward(vertices,faces)


def shade_hems(points):
    if len(points)!=784:raise ValueError('Measured paired bound hem topology changed')
    vertices=[];faces=[]
    for start in (0,392):
        # Original two curves each repeat their first of49 sections.
        path=centers(points[start:start+392],8)[:-1];b=bounds(path);cx=(b['min'][0]+b['max'][0])/2;cy=(b['min'][1]+b['max'][1])/2
        rx=(b['max'][0]-b['min'][0])/2;ry=(b['max'][1]-b['min'][1])/2;z=sum(p[2] for p in path)/len(path)
        radial=[(cx+rx*math.cos(2*math.pi*j/128),cy+ry*math.sin(2*math.pi*j/128),z) for j in range(128)]
        g=tube(radial,.0055,12,True);offset=len(vertices);vertices.extend(g[0]);faces.extend(tuple(i+offset for i in f) for f in g[1])
    return outward(fit(vertices,bounds(points)),faces)


def apply(root,scene,item,keys,names,evidence):
    import bpy
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    if item['sourceBlend']!=evidence['sourceBlend']:raise ValueError('Source differs from inspected laundry recipe')
    objects=_curves['_objects'](scene,names);checked={};changes=[]
    for spec in evidence['objects']:
        soft=spec['name']=='tailored_seat_cushion';trim=spec['name']=='seat_double_welt'
        checked[spec['name']]=_curves['_checked'](objects,spec,keys,exact_bounds=not(soft or trim),exact_count=not soft)[0]
    def points(obj):return [tuple(obj.matrix_world@v.co) for v in obj.data.vertices]
    def replace(name,g,description):
        if sum(len(f)-2 for f in g[1])>18000:raise ValueError('Laundry component detail exceeds budget')
        change=_textile['_replace'](checked[name],g)
        changes.append({'kind':'source-evidenced-construction','component':name,'construction':description,**change,'preserved':['catalog dimensions and material keys','unrelated parts and protected image/motion content']})
    if item['id']=='leather-executive-chair':
        g,details=_textile['_chair_welt'](checked['seat_double_welt'],checked['tailored_seat_cushion'])
        replace('seat_double_welt',g,'continuous round seat welt seated on the actual lofted cover');changes[-1].update(details)
    elif item['id']=='laundry-carry-basket':
        name='hollow flexible carry tub';replace(name,hollow_container(points(checked[name])),'smooth molded rounded corners with closed floor, inner walls and rolled rim')
    elif item['id']=='laundry-divided-hamper':
        bags=[]
        for name,obj in checked.items():
            if name.startswith('open cloth hamper bag'):
                replace(name,hollow_container(points(obj),True),'hanging cloth sack with restrained inward folds and a properly nested closed inner floor');bags.append(obj)
        for name,obj in checked.items():
            if not(name.startswith('stitched bag top hem') or name.startswith('vertical tailored seam')):continue
            source=points(obj);ends=centers(source,6);cx=sum(p[0] for p in ends)/2
            bag=min(bags,key=lambda b:abs(sum(p[0] for p in points(b))/len(b.data.vertices)-cx))
            bvh=BVHTree.FromPolygons([Vector(p) for p in points(bag)],[list(p.vertices) for p in bag.data.polygons],all_triangles=False)
            length=(Vector(ends[1])-Vector(ends[0])).length;path=[]
            for i in range(max(2,math.ceil(length/.008))+1):
                p=Vector(mix(ends[0],ends[1],i/max(2,math.ceil(length/.008))));hit,normal,_,distance=bvh.find_nearest(p)
                if hit is None or distance>.05:raise ValueError('Cloth hem left measured sack surface')
                path.append(tuple(hit+normal*.0006))
            replace(name,tube(path,.0013,10),'fine continuous sewn seam follows the actual cloth sack surface')
    elif item['id']=='laundry-garment-steamer':
        name='flexible reinforced steam hose';anchors=centers(points(checked[name]),10)
        path=_design['rounded_path'](anchors,cut=.06,spacing=.008)
        geometries={name:(tube(path,.014,20),'continuous smooth flexible hose retains the original inlet and head attachment regions')}
        for name,obj in checked.items():
            if not name.startswith('hose reinforcement rib'):continue
            old=bounds(points(obj));z=(old['min'][2]+old['max'][2])/2
            j=next((j for j in range(len(path)-1) if path[j][2]<=z<=path[j+1][2]),None)
            if j is None:raise ValueError('Reinforcement lies outside measured hose')
            t=(z-path[j][2])/(path[j+1][2]-path[j][2]);c=Vector(mix(path[j],path[j+1],t));direction=(Vector(path[j+1])-Vector(path[j])).normalized()
            u=direction.cross(Vector((1,0,0))).normalized();v=direction.cross(u)
            ring=[tuple(c+.0155*(math.cos(2*math.pi*k/24)*u+math.sin(2*math.pi*k/24)*v)) for k in range(24)]
            geometries[name]=(tube(ring,.0018,8,True),'closed reinforcement ring follows the smooth hose tangent without duplicated end caps')
        old=bounds([p for name in geometries for p in points(checked[name])]);new=bounds([p for g,_ in geometries.values() for p in g[0]])
        # Original rings define the overall front depth. Preserve that exact
        # envelope after smoothing; endpoint displacement remains under2mm.
        maximum_shift=0
        for name,(g,description) in geometries.items():
            vertices=[]
            for x,y,z in g[0]:
                target=old['min'][1]+(y-new['min'][1])/(new['max'][1]-new['min'][1])*(old['max'][1]-old['min'][1])
                maximum_shift=max(maximum_shift,abs(target-y));vertices.append((x,target,z))
            replace(name,(vertices,g[1]),description)
        if maximum_shift>.002:raise ValueError('Hose envelope calibration moved attachment by more than2mm')
        changes[-1]['measuredDepthCalibrationM']=maximum_shift
    elif item['id']=='laundry-steam-iron':
        for name in ('pointed metal soleplate','blue translucent tank','upper tank shoulder'):
            replace(name,iron_shell(points(checked[name])),'smooth measured pointed shell sections retain the original tank and soleplate envelope')
            for face in checked[name].data.polygons:face.use_smooth=len(face.vertices)==4
        name='open raised handle';anchors=centers(points(checked[name]),16)
        # Rear return previously ended20mm above the blue tank. Seat the heel
        # inside that tank while preserving the original grip height/front join.
        if not .088<anchors[-1][2]<.092:raise ValueError('Inspected handle heel changed')
        anchors[-1]=(anchors[-1][0],anchors[-1][1]-.014,.054)
        replace(name,tube(_design['rounded_path'](anchors,cut=.014,spacing=.003),.0118,24),'rounded open handle with rear heel seated inside the tank shoulder')
        # The source swivel stopped at the old floating heel. Connect its inlet
        # to the newly seated heel while leaving the free cable end unchanged.
        name='heel cord swivel';p=points(checked[name]);anchors=centers(p,10)
        anchors[0]=(0,.101,.059)
        g=tube(_design['rounded_path'](anchors,cut=.006,spacing=.002),.0059,16)
        box=bounds(p);box['min'][1]=min(box['min'][1],.097);box['min'][2]=min(box['min'][2],.053)
        replace(name,(fit(g[0],box),g[1]),'flexible heel strain relief now enters the seated handle and retains the original free-end envelope')
    elif item['id']=='linen-flush-light':
        replace('lined_linen_lampshade',smooth_shade(points(checked['lined_linen_lampshade'])),'smooth circular outer shade and inner lining with closed top and bottom edges')
        for face in checked['lined_linen_lampshade'].data.polygons:
            z=[(checked['lined_linen_lampshade'].matrix_world@checked['lined_linen_lampshade'].data.vertices[i].co)[2] for i in face.vertices]
            face.use_smooth=max(z)-min(z)>1e-8
        replace('bound_shade_hem',shade_hems(points(checked['bound_shade_hem'])),'two continuous rounded bound hems follow the circular shade edges')
    else:raise ValueError('Unsupported laundry refinement ID')
    bpy.context.view_layer.update()
    return changes
