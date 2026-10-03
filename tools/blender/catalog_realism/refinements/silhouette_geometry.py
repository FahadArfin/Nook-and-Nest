"""Exact-source mirror and lamp silhouette corrections for four reviewed IDs."""
import math


def bounds(points):
    if not points or any(not math.isfinite(v) for p in points for v in p):
        raise ValueError('Finite source points required')
    return {'min':[min(p[a] for p in points) for a in range(3)],
            'max':[max(p[a] for p in points) for a in range(3)]}


def fit(points, box):
    old=bounds(points)
    return [tuple(box['min'][a]+(p[a]-old['min'][a])/(old['max'][a]-old['min'][a])*
                  (box['max'][a]-box['min'][a]) for a in range(3)) for p in points]


def outward(points, faces):
    volume=0
    for face in faces:
        a=points[face[0]]
        for k in range(1,len(face)-1):
            b,c=points[face[k]],points[face[k+1]]
            volume += a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0])
    if abs(volume)<1e-12:raise ValueError('A closed manufactured shell needs positive volume')
    return faces if volume>0 else [tuple(reversed(face)) for face in faces]


def lathe(profile, box, segments=96):
    vertices, rings, faces=[],[],[]
    for r,z in profile:
        if abs(r)<1e-10:
            rings.append([len(vertices)]);vertices.append((0,0,z))
        else:
            rings.append(list(range(len(vertices),len(vertices)+segments)))
            vertices += [(r*math.cos(i*math.tau/segments),r*math.sin(i*math.tau/segments),z) for i in range(segments)]
    for first,second in zip(rings,rings[1:]+rings[:1]):
        if len(first)==len(second)==1:continue
        for i in range(segments):
            j=(i+1)%segments
            if len(first)==1:faces.append((first[0],second[j],second[i]))
            elif len(second)==1:faces.append((first[i],first[j],second[0]))
            else:faces.append((first[i],first[j],second[j],second[i]))
    vertices=fit(vertices,box)
    return vertices,outward(vertices,faces)


def dome(box):
    profile=[(math.cos(i*math.pi/48),math.sin(i*math.pi/48)) for i in range(25)]
    profile += [(.97*math.cos(i*math.pi/48),.025+.95*math.sin(i*math.pi/48)) for i in range(24,-1,-1)]
    return lathe(profile,box,64)


def arched_panel(box, segments=64):
    lo,hi=box['min'],box['max'];cx=(lo[0]+hi[0])/2;r=(hi[0]-lo[0])/2;cz=hi[2]-r
    if cz<=lo[2]:raise ValueError('Arched panel requires straight side rails')
    outline=[(lo[0],lo[2]),(hi[0],lo[2])]
    outline += [(cx+r*math.cos(i*math.pi/segments),cz+r*math.sin(i*math.pi/segments)) for i in range(segments+1)]
    n=len(outline);vertices=[(x,y,z) for y in (lo[1],hi[1]) for x,z in outline]
    faces=[tuple(range(n)),tuple(range(n,2*n))]
    # Flat caps have opposite winding; the volume check orients the full shell.
    faces[1]=tuple(reversed(faces[1]))
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    # Cap 0 must oppose the boundary of the connecting side strip.
    faces[0]=tuple(reversed(faces[0]));faces[1]=tuple(reversed(faces[1]))
    return vertices,outward(vertices,faces)


def arc_tube(box, shade_box):
    lo,hi=box['min'],box['max'];radius=(hi[1]-lo[1])/2
    left=lo[0]+radius;end=(shade_box['min'][0]+shade_box['max'][0])/2
    shoulder=lo[2]+(hi[2]-lo[2])*.71
    rz=hi[2]-radius-shoulder
    end_z=shade_box['max'][2]-.005
    phase=math.asin(max(.25,min(.95,(end_z-shoulder)/rz)))
    rx=(end-left)/(1+math.cos(phase));cx=left+rx
    centers=[(left,0,lo[2]),(left,0,shoulder)]
    centers += [(cx+rx*math.cos(math.pi+(phase-math.pi)*i/64),0,
                 shoulder+rz*math.sin(math.pi+(phase-math.pi)*i/64)) for i in range(1,65)]
    vertices,faces=[],[];sides=16
    for i,p in enumerate(centers):
        before=centers[max(0,i-1)];after=centers[min(len(centers)-1,i+1)]
        dx,dz=after[0]-before[0],after[2]-before[2];length=math.hypot(dx,dz)
        for j in range(sides):
            a=j*math.tau/sides
            vertices.append((p[0]+radius*dz/length*math.cos(a),radius*math.sin(a),p[2]-radius*dx/length*math.cos(a)))
    for i in range(len(centers)-1):
        for j in range(sides):faces.append((i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j))
    faces += [tuple(reversed(range(sides))),tuple((len(centers)-1)*sides+j for j in range(sides))]
    vertices=fit(vertices,box)
    return vertices,outward(vertices,faces)


def apply(root,scene,item,keys,names,evidence):
    import bpy
    from mathutils import Vector
    if item['sourceBlend']!=evidence['sourceBlend']:
        raise ValueError('Source blend differs from the inspected silhouette evidence')
    objects={names.get(o.name):o for o in scene.objects if o.type=='MESH'}
    expected={o['name']:o for o in evidence['objects']}
    for name,spec in expected.items():
        obj=objects.get(name)
        if obj is None or len(obj.data.vertices)!=spec['vertices'] or obj.data.shape_keys or obj.get('motion_role') or obj.get('shared_geometry'):
            raise ValueError('Exact static source geometry changed: '+name)
        if [keys[m.name] for m in obj.data.materials if m]!=spec['materials']:
            raise ValueError('Exact source material slots changed: '+name)
        box=bounds([tuple(obj.matrix_world@v.co) for v in obj.data.vertices])
        if any(abs(box[side][a]-spec['bounds'][side][a])>2e-6 for side in ('min','max') for a in range(3)):
            raise ValueError('Exact source bounds changed: '+name)
    def box_for(*parts):
        return bounds([tuple(objects[name].matrix_world@v.co) for name in parts for v in objects[name].data.vertices])
    plans=[]
    if item['id']=='arch-wall-mirror':
        for parts in [('arch_mirror_frame','arch_mirror_crown'),('arch_mirror_glass','arch_mirror_glass_crown')]:
            plans.append((parts,arched_panel(box_for(*parts)),'continuous arched panel; remove overlapping full discs'))
    elif item['id']=='apartment-lamp-opal':
        plans.append((('opal glass dome',),dome(box_for('opal glass dome')),'smooth closed hollow opal dome'))
    elif item['id']=='articulated-task-lamp':
        # Exact source profile has four 48-vertex rings, with an open top rim.
        obj=objects['spun_task_shade'];pts=[tuple(obj.matrix_world@v.co) for v in obj.data.vertices];box=box_for('spun_task_shade')
        cx=(box['min'][0]+box['max'][0])/2;profile=[]
        for offset in range(0,192,48):
            ring=pts[offset:offset+48]
            if max(p[2] for p in ring)-min(p[2] for p in ring)>1e-6:raise ValueError('Expected four radial shade profile rings')
            profile.append((max(abs(p[0]-cx) for p in ring),sum(p[2] for p in ring)/48))
        plans.append((('spun_task_shade',),lathe(profile,box),'smooth spun shell with closed top and bottom rims'))
    elif item['id']=='arc-reading-lamp':
        parts=tuple('arc_stem'+(f'.{i:03d}' if i else '') for i in range(4))
        shade=box_for('wide_shade')
        plans.append((parts,arc_tube(box_for(*parts),shade),'continuous curved tubular arc seated into shade'))
        plans.append((('wide_shade',),lathe([(1,0),(1,1),(.985,1),(.985,0)],shade),'smooth hollow cylindrical shade'))
        obj=objects['diffuser'];pts=[tuple(obj.matrix_world@v.co) for v in obj.data.vertices];old=box_for('diffuser')
        dz=shade['min'][2]+.004-old['max'][2]
        plans.append((('diffuser',),([(x,y,z+dz) for x,y,z in pts],[tuple(p.vertices) for p in obj.data.polygons]),'seat luminous diffuser into lower shade opening'))
    else:raise ValueError('Unsupported exact silhouette recipe')
    changes=[]
    for parts,(vertices,faces),detail in plans:
        if len(vertices)>7000 or sum(len(f)-2 for f in faces)>14000:raise ValueError('Silhouette correction exceeds bounded cost')
        target=objects[parts[0]];before=box_for(*parts);old_count=sum(len(objects[n].data.vertices) for n in parts)
        mesh=bpy.data.meshes.new(parts[0]+' refined silhouette');inverse=target.matrix_world.inverted()
        mesh.from_pydata([inverse@Vector(v) for v in vertices],[],faces)
        for material in target.data.materials:mesh.materials.append(material)
        mesh.update()
        for face in mesh.polygons:
            # Flat mirror faces must never inherit curved crown normals.
            face.use_smooth=len(face.vertices)<=4 and max(vertices[i][2] for i in face.vertices)-min(vertices[i][2] for i in face.vertices)>1e-8
        target.data=mesh
        for modifier in list(target.modifiers):target.modifiers.remove(modifier)
        target['catalog_refinement']=detail
        for name in parts[1:]:
            obj=objects[name];names.pop(obj.name,None);bpy.data.objects.remove(obj,do_unlink=True)
        changes.append({'kind':'source-evidenced-silhouette','component':parts[0],'replacedComponents':list(parts),'construction':detail,
                        'sourceVertices':old_count,'candidateVertices':len(vertices),'candidateTriangles':sum(len(f)-2 for f in faces),
                        'beforeBoundsM':before,'afterBoundsM':bounds(vertices),'preserved':['source dimensions','material keys and images','unrelated construction']})
    bpy.context.view_layer.update()
    return changes
