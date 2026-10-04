"""Bounded curve/contact repairs for the reviewed guitar and arched bed only."""
import math


def bounds(vertices):
    if not vertices or any(not math.isfinite(c) for v in vertices for c in v):
        raise ValueError('Finite nonempty geometry required')
    return {s:[fn(v[a] for v in vertices) for a in range(3)] for s,fn in [('min',min),('max',max)]}


def validate_source(name,count,materials,box,spec):
    if name!=spec['name'] or count!=spec['vertices'] or materials!=spec['materials']:
        raise ValueError('Exact reviewed source role changed: '+name)
    if any(abs(box[s][a]-spec['bounds'][s][a])>2e-6 for s in ('min','max') for a in range(3)):
        raise ValueError('Reviewed source bounds changed: '+name)


def fit(vertices,box):
    old=bounds(vertices)
    return [tuple(box['min'][a]+(v[a]-old['min'][a])/(old['max'][a]-old['min'][a])*(box['max'][a]-box['min'][a]) for a in range(3)) for v in vertices]


def outward(vertices,faces):
    volume=0
    for f in faces:
        a=vertices[f[0]]
        for i in range(1,len(f)-1):
            b,c=vertices[f[i]],vertices[f[i+1]]
            volume+=a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0])
    return vertices,faces if volume>0 else [tuple(reversed(f)) for f in faces]


def guitar_outline():
    # Same authored bout/waist anchors as household_lighting_office.py:guitar.
    side=[(0,105),(82,110),(156,146),(200,208),(206,280),(172,345),(125,378),(136,430),(178,482),(175,542),(138,580),(66,596),(0,594)]
    anchors=side+[(-x,z) for x,z in reversed(side[1:-1])]
    points=[]
    for i,b in enumerate(anchors):
        a,c,d=anchors[i-1],anchors[(i+1)%len(anchors)],anchors[(i+2)%len(anchors)]
        for j in range(12):
            t=j/12
            points.append(tuple(.5*((2*b[k])+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t) for k in range(2)))
    lo=[min(p[a] for p in points) for a in range(2)];hi=[max(p[a] for p in points) for a in range(2)]
    return [(-206+(x-lo[0])/(hi[0]-lo[0])*412,105+(z-lo[1])/(hi[1]-lo[1])*491) for x,z in points]


# Original 48 mm cutter center/radii after the source's measured normalization.
GUITAR_HOLE=(0.,453*(.6065486669540405-.10685840994119644)/491,
             48*.20631740987300873/206,48*(.6065486669540405-.10685840994119644)/491)


def planar_outline(box):
    return [(box['min'][0]+(x+206)/412*(box['max'][0]-box['min'][0]),
             box['min'][2]+(z-105)/491*(box['max'][2]-box['min'][2])) for x,z in guitar_outline()]


def triangulate(outline):
    def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    indices=list(range(len(outline)));result=[]
    area=sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(outline,outline[1:]+outline[:1]))
    if area<0:indices.reverse()
    while len(indices)>3:
        for k,b in enumerate(indices):
            a,c=indices[k-1],indices[(k+1)%len(indices)]
            if cross(outline[a],outline[b],outline[c])<=1e-13:continue
            if any(cross(outline[a],outline[b],outline[p])>=-1e-13 and cross(outline[b],outline[c],outline[p])>=-1e-13 and cross(outline[c],outline[a],outline[p])>=-1e-13 for p in indices if p not in (a,b,c) and outline[p] not in (outline[a],outline[b],outline[c])):continue
            result.append((a,b,c));indices.pop(k);break
        else:raise ValueError('Reviewed outline cannot be triangulated without degenerate faces')
    result.append(tuple(indices));return result


def extrude(outline,y0,y1):
    n=len(outline);verts=[(x,y,z) for y in (y0,y1) for x,z in outline]
    caps=triangulate(outline)
    faces=[tuple(reversed(f)) for f in caps]+[tuple(i+n for i in f) for f in caps]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return outward(verts,faces)


def guitar_mesh(kind,box):
    outline=planar_outline(box);n=len(outline);y0,y1=box['min'][1],box['max'][1]
    if kind=='back':return extrude(outline,y0,y1)
    if kind=='binding':
        # Continuous round binding follows the same smooth silhouette, not straight chords.
        verts=[];faces=[];radius=.0019
        for i,(x,z) in enumerate(outline):
            before,after=outline[i-1],outline[(i+1)%n]
            dx,dz=after[0]-before[0],after[1]-before[1];length=math.hypot(dx,dz)
            for j in range(8):
                angle=j*math.tau/8
                verts.append((x+radius*dz/length*math.cos(angle),(y0+y1)/2+radius*math.sin(angle),z-radius*dx/length*math.cos(angle)))
        for i in range(n):
            for j in range(8):faces.append((i*8+j,((i+1)%n)*8+j,((i+1)%n)*8+(j+1)%8,i*8+(j+1)%8))
        return outward(fit(verts,box),faces)
    if kind not in ('sides','soundboard'):raise ValueError('Unknown guitar component')
    cx,cz,rx,rz=GUITAR_HOLE
    if kind=='soundboard':
        # The lower bout is not star-shaped about the sound hole. Bridge the
        # rightmost hole point to the visible upper-bout vertex and ear-clip the
        # weakly simple contour; never stretch a radial triangle over the waist.
        inner=[(cx+rx*math.cos(i*math.tau/96),cz+rz*math.sin(i*math.tau/96)) for i in range(96)]
        bridge=min((i for i,(x,z) in enumerate(outline) if x>cx),key=lambda i:abs(outline[i][1]-cz))
        route=list(range(bridge+1))+[n]+[n+i for i in range(95,0,-1)]+[n,bridge]+list(range(bridge+1,n))
        planar=outline+inner;count=len(planar)
        caps=[tuple(route[i] for i in face) for face in triangulate([planar[i] for i in route])]
        verts=[(x,y,z) for y in (y0,y1) for x,z in planar]
        faces=[tuple(reversed(f)) for f in caps]+[tuple(i+count for i in f) for f in caps]
        for offset,length,reverse in [(0,n,False),(n,len(inner),True)]:
            for i in range(length):
                a,b=offset+i,offset+(i+1)%length
                face=(a,b,b+count,a+count)
                faces.append(tuple(reversed(face)) if reverse else face)
        return outward(verts,faces)
    else:
        inner=[(x+(cx-x)*.008,z+(cz-z)*.008) for x,z in outline]
    verts=[(x,y,z) for y,ring in [(y0,outline),(y1,outline),(y0,inner),(y1,inner)] for x,z in ring]
    faces=[]
    for i in range(n):
        j=(i+1)%n
        faces += [(i,j,n+j,n+i),(2*n+j,2*n+i,3*n+i,3*n+j),(j,i,2*n+i,2*n+j),(n+i,n+j,3*n+j,3*n+i)]
    return outward(verts,faces)


def crown_panels(specs,stem):
    specs=sorted(specs,key=lambda s:s['bounds']['min'][0]);ellipses=[]
    for spec in specs:
        lo,hi=spec['bounds']['min'],spec['bounds']['max']
        ellipses.append(((lo[0]+hi[0])/2,(lo[2]+hi[2])/2,(hi[0]-lo[0])/2,(hi[2]-lo[2])/2))
    cuts=[specs[0]['bounds']['min'][0]]+[(a[0]+b[0])/2 for a,b in zip(ellipses,ellipses[1:])]+[specs[-1]['bounds']['max'][0]]
    floor=stem['max'][2]-.03
    def top(x):
        return max([stem['max'][2]-.012]+[cz+rz*math.sqrt(max(0,1-((x-cx)/rx)**2)) for cx,cz,rx,rz in ellipses if abs(x-cx)<=rx])
    panels=[]
    for i,spec in enumerate(specs):
        x0,x1=cuts[i:i+2]
        xs=sorted(set([x0+(x1-x0)*j/64 for j in range(65)]+[e[0] for e in ellipses if x0<e[0]<x1]))
        outline=[(x0,floor),(x1,floor)]+[(x,top(x)) for x in reversed(xs)]
        panels.append(extrude(outline,spec['bounds']['min'][1],spec['bounds']['max'][1]))
    return panels


def resample_closed(points,spacing):
    if len(points)<3 or spacing<=0:raise ValueError('Closed nondegenerate path required')
    result=[]
    for a,b in zip(points,points[1:]+points[:1]):
        count=max(1,math.ceil(math.dist(a,b)/spacing))
        result += [tuple(a[k]+(b[k]-a[k])*j/count for k in range(3)) for j in range(count)]
    return result


def components(count,edges):
    adjacent=[set() for _ in range(count)]
    for a,b in edges:adjacent[a].add(b);adjacent[b].add(a)
    unseen=set(range(count));result=[]
    while unseen:
        pending=[min(unseen)];group=set()
        while pending:
            current=pending.pop()
            if current in group:continue
            group.add(current);pending.extend(adjacent[current]-group)
        unseen-=group;result.append(sorted(group))
    return result


def tuft_shift(source_back,headboard_front):
    shift=headboard_front+.002-source_back
    if not .08<shift<.13:raise ValueError('Unexpected source tuft contact distance')
    return shift


def material_slot_keys(keys,face_indices):
    if any(not isinstance(i,int) or i<0 or i>=len(keys) or keys[i] is None for i in face_indices):
        raise ValueError('Reviewed source faces use an empty or invalid material slot')
    return [key for key in keys if key is not None]


def authored_trim_loop(points):
    """Recover Geometry.tube's nominal closed path despite its branch-style jitter.

    This exact source used 25 six-sided rings, 7% asymmetric radial jitter and an
    80% radius taper. Averaged ring centers are consequently not bit-identical
    at closure. Bound that known centroid error; do not accept an actual gap.
    """
    if len(points)!=150:raise ValueError('Expected 25 authored six-sided rings')
    centers=[tuple(sum(p[a] for p in points[k:k+6])/6 for a in range(3)) for k in range(0,150,6)]
    radii=[sum(math.dist(p,centers[k//6]) for p in points[k:k+6])/6 for k in range(0,150,6)]
    radius=radii[0]
    if not .0015<radius<.0035 or not .17<radii[-1]/radius<.24:
        raise ValueError('Reviewed piping differs from its nominal radius and authored taper')
    if math.dist(centers[0],centers[-1])>radius*.14:
        raise ValueError('Pillow loop closure exceeds the authored radial-jitter centroid bound')
    return centers[:-1],radius


def _objects(scene,names):
    return {names.get(o.name):o for o in scene.objects if o.type=='MESH' and o.name in names}


def _checked(objects,spec,keys,exact_bounds=True,exact_count=True):
    obj=objects.get(spec['name'])
    if obj is None or obj.data.shape_keys or obj.get('motion_role') or obj.get('shared_geometry'):
        raise ValueError('Missing or protected reviewed component: '+spec['name'])
    points=[tuple(obj.matrix_world @ v.co) for v in obj.data.vertices]
    actual=bounds(points)
    validate_source(spec['name'],len(points) if exact_count else spec['vertices'],
                    material_slot_keys([keys.get(m.name) if m else None for m in obj.data.materials],
                                       [p.material_index for p in obj.data.polygons]),
                    actual if exact_bounds else spec['bounds'],spec)
    if not exact_bounds and any(actual[s][a]<spec['bounds']['min'][a]-.04 or actual[s][a]>spec['bounds']['max'][a]+.04 for s in ('min','max') for a in range(3)):
        raise ValueError('Previously refined trim escaped its source envelope')
    return obj,points


def _replace(obj,geometry,*,smooth_sides=True):
    import bpy
    from mathutils import Vector
    vertices,faces=geometry;old=obj.data;inverse=obj.matrix_world.inverted()
    mesh=bpy.data.meshes.new(old.name+' reviewed curves')
    mesh.from_pydata([inverse @ Vector(v) for v in vertices],[],faces)
    for material in old.materials:
        if material:mesh.materials.append(material)
    mesh.update()
    # Existing channels have no bound baseline images for these exact roles.
    # Keep a well-conditioned metric UV0 before the material stage adds RealismUV.
    uv=mesh.uv_layers.new(name='UVMap',do_init=False)
    for polygon in mesh.polygons:
        a,b,c=[Vector(vertices[i]) for i in polygon.vertices[:3]]
        normal=(b-a).cross(c-a).normalized();axes=[i for i in range(3) if i!=max(range(3),key=lambda j:abs(normal[j]))]
        for loop in polygon.loop_indices:uv.data[loop].uv=tuple(vertices[mesh.loops[loop].vertex_index][i] for i in axes)
        polygon.use_smooth=smooth_sides and abs(normal.y)<.999
    obj.data=mesh
    for modifier in list(obj.modifiers):obj.modifiers.remove(modifier)
    return {'sourceVertices':len(old.vertices),'candidateVertices':len(vertices),
            'candidateTriangles':sum(len(f)-2 for f in faces),'boundsM':bounds(vertices)}


def apply_guitar(scene,item,keys,names,specs):
    if item['id']!='acoustic-guitar-on-stand':raise ValueError('Wrong guitar refinement catalog ID')
    objects=_objects(scene,names);plans=[]
    for spec in specs:
        obj,points=_checked(objects,spec,keys)
        plans.append((obj,spec,guitar_mesh(spec['kind'],bounds(points))))
    changes=[]
    for obj,spec,geometry in plans:
        evidence=_replace(obj,geometry,smooth_sides=True)
        if spec['kind']=='binding':
            for face in obj.data.polygons:face.use_smooth=True
        changes.append({'kind':'source-evidenced-construction','component':spec['name'],
                        'construction':'smooth authored dreadnought '+spec['kind'],**evidence,
                        'preserved':['original material slots and factors','sound-hole center and radii','rosette, neck, bridge, strings and stand','model dimensions']})
    return changes


def _pillow_trim_plan(obj,pillows):
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    if obj.data.uv_layers:raise ValueError('Reviewed combined trim unexpectedly has a bound source UV layer')
    points=[tuple(obj.matrix_world @ v.co) for v in obj.data.vertices]
    groups=components(len(points),[tuple(e.vertices) for e in obj.data.edges])
    if len(groups)!=4 or any(len(g)!=150 for g in groups):raise ValueError('Expected four authored six-sided trim loops')
    targets=[]
    for pillow in pillows:
        pillow.data.calc_loop_triangles()
        world=[pillow.matrix_world @ v.co for v in pillow.data.vertices]
        targets.append((bounds(world),BVHTree.FromPolygons(world,[tuple(f.vertices) for f in pillow.data.loop_triangles],all_triangles=True)))
    vertices=[];faces=[];seated=0;largest=0;used=set()
    for group in groups:
        box=bounds([points[i] for i in group]);center=[(box['min'][a]+box['max'][a])/2 for a in range(3)]
        matching=[i for i,(b,_) in enumerate(targets) if all(b['min'][a]<=center[a]<=b['max'][a] for a in (0,1)) and box['max'][0]-box['min'][0]<.65]
        offset=len(vertices)
        if not matching:
            lookup={original:offset+i for i,original in enumerate(group)}
            vertices += [points[i] for i in group]
            faces += [tuple(lookup[i] for i in p.vertices) for p in obj.data.polygons if all(i in lookup for i in p.vertices)]
            continue
        if len(matching)!=1 or matching[0] in used:raise ValueError('Pillow trim matched ambiguously')
        used.add(matching[0]);pillow_box,tree=targets[matching[0]]
        centers,radius=authored_trim_loop([points[i] for i in group])
        sampled=resample_closed(centers,.008);surface=[];normals=[]
        for point in sampled:
            hit=tree.ray_cast(Vector((point[0],point[1],pillow_box['max'][2]+.05)),Vector((0,0,-1)),.3)
            if hit[0] is None:hit=tree.find_nearest(Vector(point))
            if hit[0] is None or hit[1].z<.1 or (hit[0]-Vector(point)).length>.065:
                raise ValueError('Exact pillow piping cannot be seated on its cover')
            normal=hit[1].normalized();surface.append(hit[0]+normal*radius*.3);normals.append(normal)
            largest=max(largest,(surface[-1]-Vector(point)).length)
        count=len(surface)
        for i,point in enumerate(surface):
            tangent=(surface[(i+1)%count]-surface[i-1]).normalized()
            side=tangent.cross(normals[i]).normalized();up=side.cross(tangent).normalized()
            for j in range(6):
                angle=j*math.tau/6;v=point+radius*(math.cos(angle)*side+math.sin(angle)*up)
                if any(v[a]<pillow_box['min'][a]-.004 or v[a]>pillow_box['max'][a]+.004 for a in range(3)):
                    raise ValueError('Seated pillow piping escaped the cover envelope')
                vertices.append(tuple(v))
        new_faces=[]
        for i in range(count):
            for j in range(6):new_faces.append((i*6+j,((i+1)%count)*6+j,((i+1)%count)*6+(j+1)%6,i*6+(j+1)%6))
        _,new_faces=outward(vertices[offset:],new_faces)
        faces += [tuple(offset+i for i in face) for face in new_faces];seated+=1
    if seated!=2:raise ValueError('Both reviewed pillow loops must be seated')
    return (vertices,faces),{'seatedPillowLoops':seated,'maximumCenterDisplacementM':largest,'maximumSampleSpacingM':.008,
                            'sectionRadius':'Even sewn section retains the measured first-ring thickness; removes source branch-style 80% taper.'}


def apply_bed(scene,item,keys,names,specs):
    if item['id']!='arched-bed':raise ValueError('Wrong arched bed refinement catalog ID')
    from mathutils import Vector
    objects=_objects(scene,names);checked={}
    for spec in specs:
        checked[spec['name']]=_checked(objects,spec,keys,exact_bounds=spec['kind'] not in ('pillow','trim'),exact_count=spec['kind']!='pillow')
    stem=next(s for s in specs if s['kind']=='stem');arches=[s for s in specs if s['kind']=='crown']
    panels=crown_panels(arches,stem['bounds'])
    trim=next(s for s in specs if s['kind']=='trim');trim_obj=checked[trim['name']][0]
    geometry,evidence=_pillow_trim_plan(trim_obj,[checked[s['name']][0] for s in specs if s['kind']=='pillow'])
    changes=[]
    for spec,panel in zip(arches,panels):
        obj=checked[spec['name']][0]
        changes.append({'kind':'source-evidenced-construction','component':spec['name'],
                        'construction':'closed scalloped crown panel without intersecting circular caps',**_replace(obj,panel),
                        'preserved':['original crown height and combined span','original upholstery material']})
    for spec in [s for s in specs if s['kind']=='tuft']:
        obj,points=checked[spec['name']];shift=tuft_shift(spec['bounds']['max'][1],stem['bounds']['min'][1])
        inverse=obj.matrix_world.inverted()
        for vertex,p in zip(obj.data.vertices,points):vertex.co=inverse @ Vector((p[0],p[1]+shift,p[2]))
        obj.data.update()
        changes.append({'kind':'source-evidenced-contact','component':spec['name'],'translationM':[0,shift,0],
                        'contactOverlapM':.002,'preserved':['tuft topology, UVs, size and material','unchanged headboard stem']})
    changes.append({'kind':'source-evidenced-contact','component':trim['name'],'construction':'two pillow loops seated continuously on lofted covers',
                    **_replace(trim_obj,geometry),**evidence,'preserved':['two non-pillow loops unchanged','original seam material and nominal section radius']})
    for polygon in trim_obj.data.polygons:polygon.use_smooth=True
    return changes
