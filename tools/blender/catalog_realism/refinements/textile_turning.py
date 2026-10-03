"""Five isolated reviewed silhouette and textile corrections, in original bounds."""
import math
from pathlib import Path
import runpy

_curves=runpy.run_path(str(Path(__file__).with_name('curved_construction.py')))
bounds=_curves['bounds'];fit=_curves['fit'];outward=_curves['outward']
components=_curves['components'];resample_closed=_curves['resample_closed']


def lathe(profile,box,segments=128):
    vertices=[];faces=[];rings=[]
    cx,cy=[(box['min'][a]+box['max'][a])/2 for a in (0,1)]
    rx,ry=[(box['max'][a]-box['min'][a])/2 for a in (0,1)]
    for radius,height in profile:
        z=box['min'][2]+height*(box['max'][2]-box['min'][2])
        if abs(radius)<1e-10:
            rings.append([len(vertices)]);vertices.append((cx,cy,z))
        else:
            ring=[]
            for i in range(segments):
                angle=math.tau*i/segments;ring.append(len(vertices))
                vertices.append((cx+rx*radius*math.cos(angle),cy+ry*radius*math.sin(angle),z))
            rings.append(ring)
    for a,b in zip(rings,rings[1:]):
        if len(a)==len(b)==1:raise ValueError('Degenerate turned profile')
        for i in range(segments):
            j=(i+1)%segments
            if len(a)==1:faces.append((a[0],b[j],b[i]))
            elif len(b)==1:faces.append((a[i],a[j],b[0]))
            else:faces.append((a[i],a[j],b[j],b[i]))
    return outward(vertices,faces)


def recover_profile(points,box):
    """Recover measured concentric stations; reject an arbitrary mesh."""
    cx,cy=[(box['min'][a]+box['max'][a])/2 for a in (0,1)]
    rx,ry=[(box['max'][a]-box['min'][a])/2 for a in (0,1)]
    groups=[]
    for x,y,z in sorted(points,key=lambda p:p[2]):
        radius=math.hypot((x-cx)/rx,(y-cy)/ry)
        if radius<1e-7:continue
        if not groups or abs(z-groups[-1][0])>2e-6:groups.append([z,[]])
        groups[-1][1].append(radius)
    if not 3<=len(groups)<=16:raise ValueError('Expected bounded authored radial stations')
    profile=[(0,0)]
    for z,radii in groups:
        if len(radii)!=32 or max(radii)-min(radii)>2e-5:
            raise ValueError('Original station is not an authored 32-sided circular/elliptical ring')
        radius=sum(radii)/len(radii)
        if abs(radius-1)<2e-6:radius=1
        t=(z-box['min'][2])/(box['max'][2]-box['min'][2])
        if abs(t)<1e-6:t=0
        if abs(t-1)<1e-6:t=1
        profile.append((radius,t))
    profile.append((0,1));return profile


def flame(box,index):
    vertices=[(0,0,0)];rings=[[0]];faces=[];segments=24
    bend=(-1,1,-.7)[index]
    for j in range(1,17):
        t=j/18
        radius=math.sin(math.pi*t)**.78*(1-.66*t)
        cx=bend*.28*t*t
        rings.append(list(range(len(vertices),len(vertices)+segments)))
        vertices += [(cx+radius*math.cos(i*math.tau/segments),radius*math.sin(i*math.tau/segments),t) for i in range(segments)]
    rings.append([len(vertices)]);vertices.append((bend*.42,.03,1))
    for a,b in zip(rings,rings[1:]):
        for i in range(segments):
            j=(i+1)%segments
            if len(a)==1:faces.append((a[0],b[j],b[i]))
            elif len(b)==1:faces.append((a[i],a[j],b[0]))
            else:faces.append((a[i],a[j],b[j],b[i]))
    return outward(fit(vertices,box),faces)


def welt_centerline(points,edges):
    if len(points)!=192:raise ValueError('Expected 24 original eight-vertex seam sections')
    short=[(a,b) for a,b in edges if math.dist(points[a],points[b])<.007]
    groups=components(len(points),short)
    if len(groups)!=24 or any(len(g)!=8 for g in groups):raise ValueError('Unexpected original seam sections')
    owner={v:i for i,g in enumerate(groups) for v in g};adjacent=[set() for g in groups];spans={}
    for a,b in edges:
        i,j=owner[a],owner[b]
        if i!=j:
            adjacent[i].add(j);adjacent[j].add(i);key=tuple(sorted((i,j)));spans[key]=spans.get(key,0)+1
    if any(len(row)!=2 for row in adjacent) or any(count!=8 for count in spans.values()):
        raise ValueError('Original seam must be one cyclic quad strip')
    order=[0];previous=None;current=0
    while True:
        following=min(v for v in adjacent[current] if v!=previous)
        if following==0:break
        if following in order:raise ValueError('Disconnected original seam cycle')
        order.append(following);previous,current=current,following
    if len(order)!=24:raise ValueError('Incomplete seam loop')
    centers=[tuple(sum(points[i][a] for i in groups[j])/8 for a in range(3)) for j in order]
    radius=sum(math.dist(points[i],center) for j,center in zip(order,centers) for i in groups[j])/192
    if not .001<radius<.004:raise ValueError('Unexpected original seam thickness')
    return centers,radius


def checker_surface(x,y):
    ax=math.pi*(x+.75)/1.5;ay=math.pi*(y+.75)/1.5
    height=.039+.001*math.sin(ax)**2*math.sin(ay)**2
    dx=.001*math.pi/1.5*math.sin(2*ax)*math.sin(ay)**2
    dy=.001*math.pi/1.5*math.sin(2*ay)*math.sin(ax)**2
    length=math.sqrt(1+dx*dx+dy*dy)
    return height,(-dx/length,-dy/length,1/length)


def checker_panel(row,col,segments=8):
    if row not in range(4) or col not in range(4):raise ValueError('Four by four original checker pattern required')
    vertices=[];faces=[]
    for bottom in (False,True):
        for j in range(segments+1):
            y=-.75+(row+j/segments)*.375
            for i in range(segments+1):
                x=-.75+(col+i/segments)*.375
                z=.024 if bottom else checker_surface(x,y)[0]
                vertices.append((x,y,z))
    count=(segments+1)**2
    for j in range(segments):
        for i in range(segments):
            a=j*(segments+1)+i;face=(a,a+1,a+segments+2,a+segments+1)
            faces += [face,tuple(v+count for v in reversed(face))]
    border=list(range(segments+1))+[j*(segments+1)+segments for j in range(1,segments+1)]
    border += [segments*(segments+1)+i for i in range(segments-1,-1,-1)]+[j*(segments+1) for j in range(segments-1,0,-1)]
    faces += [(a,a+count,b+count,b) for a,b in zip(border,border[1:]+border[:1])]
    return outward(vertices,faces)


def yarn_fringe(box):
    vertices=[];faces=[];sides=6;stations=8
    for strand in range(7):
        offset=len(vertices);phase=strand*.71
        for j in range(stations):
            t=j/(stations-1);x=(strand-3)*.0044+.0007*math.sin(t*math.pi+phase)*math.sin(math.pi*t)
            z=.016+.004*math.sin(math.pi*t+phase);r=.00185*(1-.25*t)
            for k in range(sides):
                a=k*math.tau/sides;vertices.append((x+r*math.cos(a),t,z+r*math.sin(a)))
        for j in range(stations-1):
            for k in range(sides):
                a=offset+j*sides+k;b=offset+j*sides+(k+1)%sides
                faces.append((a,b,b+sides,a+sides))
        faces += [tuple(reversed(range(offset,offset+sides))),tuple(range(offset+(stations-1)*sides,offset+stations*sides))]
    return outward(fit(vertices,box),faces)


def _replace(obj,geometry,smooth=True):
    evidence=_curves['_replace'](obj,geometry,smooth_sides=False)
    for face in obj.data.polygons:
        face.use_smooth=smooth and len(face.vertices)==4
    return evidence


def _continuous_cloth_normals(obj):
    from mathutils import Vector
    mesh=obj.data;world=[obj.matrix_world@v.co for v in mesh.vertices]
    normals=[(0,0,1)]*len(mesh.loops)
    for face in mesh.polygons:
        top=all(world[i].z>.03 for i in face.vertices);face.use_smooth=top
        for loop in face.loop_indices:
            p=world[mesh.loops[loop].vertex_index]
            normals[loop]=tuple((obj.matrix_world.to_3x3().transposed()@Vector(checker_surface(p.x,p.y)[1])).normalized()) if top else tuple(face.normal)
    mesh.normals_split_custom_set(normals);mesh.update()


def _chair_welt(obj,pad):
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    points=[tuple(obj.matrix_world@v.co) for v in obj.data.vertices]
    centers,radius=welt_centerline(points,[tuple(e.vertices) for e in obj.data.edges])
    centers=resample_closed(centers,.008)
    pad.data.calc_loop_triangles();world=[pad.matrix_world@v.co for v in pad.data.vertices]
    box=bounds(world);tree=BVHTree.FromPolygons(world,[tuple(p.vertices) for p in pad.data.loop_triangles],all_triangles=True)
    seated=[];normals=[];largest=0
    for center in centers:
        hit=tree.ray_cast(Vector((center[0],center[1],box['max'][2]+.05)),Vector((0,0,-1)),.3)
        if hit[0] is None or hit[1].z<.12 or (hit[0]-Vector(center)).length>.05:
            raise ValueError('Exact seat seam cannot be seated on its reviewed cover')
        normal=hit[1].normalized();seated.append(hit[0]+normal*radius*.25);normals.append(normal)
        largest=max(largest,(seated[-1]-Vector(center)).length)
    vertices=[];faces=[];count=len(seated)
    for i,p in enumerate(seated):
        tangent=(seated[(i+1)%count]-seated[i-1]).normalized()
        side=tangent.cross(normals[i]).normalized();up=side.cross(tangent).normalized()
        for j in range(8):
            angle=j*math.tau/8;v=p+radius*(math.cos(angle)*side+math.sin(angle)*up)
            if any(v[a]<box['min'][a]-.003 or v[a]>box['max'][a]+.003 for a in range(3)):
                raise ValueError('Seated piping escaped the original cover envelope')
            vertices.append(tuple(v))
    for i in range(count):
        for j in range(8):faces.append((i*8+j,((i+1)%count)*8+j,((i+1)%count)*8+(j+1)%8,i*8+(j+1)%8))
    return outward(vertices,faces),{'seatedSections':count,'maximumSampleSpacingM':.008,'sectionRadiusM':radius,
                                    'surfaceOffsetM':radius*.25,'maximumCenterDisplacementM':largest}


def apply(root,scene,item,keys,names,specs):
    objects=_curves['_objects'](scene,names);checked={};changes=[]
    for spec in specs:
        soft=spec['kind']=='cover';trim=spec['kind']=='welt'
        checked[spec['name']]=_curves['_checked'](objects,spec,keys,exact_bounds=not(soft or trim),exact_count=not soft)[0]
    def replace(spec,geometry,construction,smooth=True,extra=None):
        obj=checked[spec['name']]
        changes.append({'kind':'source-evidenced-construction','component':spec['name'],'construction':construction,
                        **_replace(obj,geometry,smooth),**(extra or {}),
                        'preserved':['original material keys and factors','original named component and unrelated geometry','overall catalog dimensions']})
    if item['id']=='candle-trio':
        for i,spec in enumerate(specs):
            if spec['kind']!='flame':continue
            geometry=flame(spec['bounds'],i)
            replace(spec,geometry,'closed bent teardrop flame in the original glowing-wick envelope')
            for face in checked[spec['name']].data.polygons:face.use_smooth=True
    elif item['id'] in ('cantilever-dining-chair','cantilever-lounge-chair'):
        spec=next(s for s in specs if s['kind']=='welt');pad=next(s for s in specs if s['kind']=='cover')
        geometry,evidence=_chair_welt(checked[spec['name']],checked[pad['name']])
        replace(spec,geometry,'continuous round seat piping seated on the existing lofted cover',extra=evidence)
    elif item['id']=='ceramic-oval-dining-table':
        top=next(s for s in specs if s['name']=='shaped_slab_top')
        for spec in specs:
            obj=checked[spec['name']];points=[tuple(obj.matrix_world@v.co) for v in obj.data.vertices]
            profile=recover_profile(points,spec['bounds']);target={s:list(spec['bounds'][s]) for s in ('min','max')};extra={'radialSegments':128}
            if spec['name']=='sculpted_center_pedestal':
                target['max'][2]=top['bounds']['min'][2]+.003
                extra.update({'originalTopGapM':top['bounds']['min'][2]-spec['bounds']['max'][2],'topContactOverlapM':.003})
            replace(spec,lathe(profile,target),'smooth measured radial stations; existing turned outline retained',extra=extra)
            # Horizontal planar top/base caps stay flat; rounded radial strips
            # interpolate normals only along the original eased contour.
            for face in obj.data.polygons:
                zs=[(obj.matrix_world@obj.data.vertices[i].co).z for i in face.vertices]
                face.use_smooth=max(zs)-min(zs)>1e-8
    elif item['id']=='checker-rug':
        for spec in specs:
            if spec['kind']=='patch':
                i=spec['patternIndex'];replace(spec,checker_panel(i//4,i%4),'contiguous cloth checker surface with identical shared edge heights',extra={'backingOverlapM':.0015})
                _continuous_cloth_normals(checked[spec['name']])
            elif spec['kind']=='fringe':
                replace(spec,yarn_fringe(spec['bounds']),'seven curved closed yarn strands replace the rectangular fringe slab')
    else:raise ValueError('Unsupported reviewed textile/turning recipe')
    return changes
