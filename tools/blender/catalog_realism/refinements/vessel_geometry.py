"""Source-specific small vessel construction; imported only by four recipes.

Pure mesh plans are closed, bounded and independently testable. Native application
replaces only exact named components, retains their material objects and transforms,
and never touches artwork, flames, dynamic nodes or unrelated source assemblies.
"""
import math


def bounds(vertices):
    if not vertices or any(not math.isfinite(v) for point in vertices for v in point):
        raise ValueError('Finite nonempty source geometry required')
    return {'min': [min(p[a] for p in vertices) for a in range(3)],
            'max': [max(p[a] for p in vertices) for a in range(3)]}


def fit(vertices, lo, hi):
    box = bounds(vertices)
    if any(hi[a] <= lo[a] or box['max'][a] <= box['min'][a] for a in range(3)):
        raise ValueError('Three nonzero component extents required')
    return [tuple(lo[a]+(v[a]-box['min'][a])/(box['max'][a]-box['min'][a])*(hi[a]-lo[a]) for a in range(3)) for v in vertices]


def lathe(profile, lo, hi, segments=96):
    vertices, faces, rings = [], [], []
    for radius, z in profile:
        if radius == 0:
            rings.append([len(vertices)]); vertices.append((0,0,z))
        else:
            ring=[]
            for i in range(segments):
                angle=i*math.tau/segments;ring.append(len(vertices));vertices.append((radius*math.cos(angle),radius*math.sin(angle),z))
            rings.append(ring)
    for first,second in zip(rings,rings[1:]):
        for i in range(segments):
            j=(i+1)%segments
            if len(first)==1:faces.append((first[0],second[j],second[i]))
            elif len(second)==1:faces.append((first[i],first[j],second[0]))
            else:faces.append((first[i],first[j],second[j],second[i]))
    return fit(vertices,lo,hi),faces


def vessel_mesh(lo,hi):
    # Preserve the source 0.75 inner/outer radius and 0.20-height inner floor.
    # The small exterior foot and continuously rolled lip replace hard CAD edges.
    profile=[(0,0),(.94,0),(.978,.003),(.995,.012),(1,.025),(1,.97)]
    profile += [(.875+.125*math.cos(i*math.pi/12),.97+.03*math.sin(i*math.pi/12)) for i in range(1,13)]
    profile += [(.75,.225),(.747,.212),(.73,.2),(0,.2)]
    return lathe(profile,lo,hi)


def fire_bowl_mesh(lo,hi):
    # Authored outer radius .30 -> 1; inner floor .13 of shell height.
    # Circular progression replaces the original six hard radial profile steps.
    profile=[(0,0),(.3,0)]
    profile += [(.3+.7*math.sin(i*math.pi/48), (i/24)**1.2) for i in range(1,25)]
    profile += [(.955,1)]
    profile += [(.3+.655*math.sin(i*math.pi/48),.13+.87*(i/24)**1.2) for i in range(23,-1,-1)]
    profile += [(0,.13)]
    return lathe(profile,lo,hi)


def rim_mesh(lo,hi):
    vertices,faces=[],[];segments,sides=128,12
    thickness=(hi[2]-lo[2])/2
    major=min(hi[0]-lo[0],hi[1]-lo[1])/2-thickness
    for i in range(segments):
        a=i*math.tau/segments
        for j in range(sides):
            b=j*math.tau/sides;r=major+thickness*math.cos(b)
            vertices.append((r*math.cos(a),r*math.sin(a),thickness*math.sin(b)))
    for i in range(segments):
        for j in range(sides):faces.append((i*sides+j,((i+1)%segments)*sides+j,((i+1)%segments)*sides+(j+1)%sides,i*sides+(j+1)%sides))
    return fit(vertices,lo,hi),faces


def petal_mesh(original):
    """A rounded, cupped, thin closed petal replaces one authored four-point leaf."""
    if len(original)!=4:raise ValueError('Expected four authored petal vertices')
    base,tip=original[0],original[2]
    dx,dy=tip[0]-base[0],tip[1]-base[1];length=math.hypot(dx,dy)
    if length<1e-5:raise ValueError('Petal needs an authored radial direction')
    ux,uy=dx/length,dy/length
    half_width=math.dist(original[1],original[3])/2
    top,rows,faces=[],[],[];steps,cross=12,8
    for i in range(steps+1):
        t=i/steps;row=[]
        vs=[0] if i in (0,steps) else [2*j/cross-1 for j in range(cross+1)]
        for v in vs:
            side=half_width*math.sin(math.pi*t)**.62*v
            rise=.35*t+.20*math.sin(math.pi*t)+.12*v*v*math.sin(math.pi*t)
            row.append(len(top));top.append((base[0]+ux*length*t-uy*side,base[1]+uy*length*t+ux*side,base[2]+rise*length))
        rows.append(row)
    for first,second in zip(rows,rows[1:]):
        if len(first)==1:
            faces += [(first[0],second[j],second[j+1]) for j in range(cross)]
        elif len(second)==1:
            faces += [(first[j],second[0],first[j+1]) for j in range(cross)]
        else:faces += [(first[j],second[j],second[j+1],first[j+1]) for j in range(cross)]
    count=len(top);vertices=top+[(x,y,z-length*.035) for x,y,z in top]
    edge_count={}
    for face in faces:
        for a,b in zip(face,face[1:]+face[:1]):
            key=tuple(sorted((a,b)));edge_count.setdefault(key,[]).append((a,b))
    shell=faces+[tuple(i+count for i in reversed(face)) for face in faces]
    shell += [(b,a,a+count,b+count) for edges in edge_count.values() if len(edges)==1 for a,b in edges]
    box=bounds(original)
    return fit(vertices,box['min'],box['max']),shell


def _plate(xs,zs,occupied,lo,hi):
    vertices,faces,lookup=[],[],{}
    def vertex(x,y,z):
        key=(x,y,z)
        if key not in lookup:
            lookup[key]=len(vertices);vertices.append(key)
        return lookup[key]
    for i,j in sorted(occupied):
        # A narrowed neck joins the unchanged authored shaft.
        x0,x1=xs[i],xs[i+1];z0,z1=zs[j],zs[j+1]
        corners=[(x0*(.5+.5*z0),-.22,z0),(x1*(.5+.5*z0),-.22,z0),(x1*(.5+.5*z1),-.22,z1),(x0*(.5+.5*z1),-.22,z1),
                 (x0*(.5+.5*z0),.22,z0),(x1*(.5+.5*z0),.22,z0),(x1*(.5+.5*z1),.22,z1),(x0*(.5+.5*z1),.22,z1)]
        ids=[vertex(*p) for p in corners]
        faces += [tuple(ids[k] for k in face) for face in [(0,1,2,3),(4,7,6,5)]]
        for neighbor,face in [((i,j-1),(0,4,5,1)),((i+1,j),(1,5,6,2)),((i,j+1),(2,6,7,3)),((i-1,j),(3,7,4,0))]:
            if neighbor not in occupied:faces.append(tuple(ids[k] for k in face))
    # Avoid stretching the 4 mm plate to the original 20 mm block thickness.
    width,height=hi[0]-lo[0],hi[2]-lo[2];center=(lo[0]+hi[0])/2,(lo[1]+hi[1])/2
    result=[(center[0]+x*width/2,center[1]+y*min(.009,hi[1]-lo[1]),lo[2]+z*height) for x,y,z in vertices]
    return result,faces


def utensil_mesh(lo,hi,kind):
    if kind=='spoon':
        # Long axis becomes vertical Z; the petal cup forms a shallow concave
        # spoon face along Y, with a closed thin underside and rounded outline.
        original=[(0,0,0),(.4,.5,.1),(1,0,.2),(.4,-.5,.1)]
        vertices,faces=petal_mesh(original)
        transformed=[(y,-z,x) for x,y,z in vertices]
        target_lo=[lo[0],max(lo[1],(lo[1]+hi[1])/2-.004),lo[2]]
        target_hi=[hi[0],min(hi[1],(lo[1]+hi[1])/2+.004),hi[2]]
        return fit(transformed,target_lo,target_hi),[tuple(reversed(face)) for face in faces]
    xs=[-1,-.62,-.46,-.14,.14,.46,.62,1];zs=[0,.25,.45,.82,1]
    occupied={(i,j) for i in range(len(xs)-1) for j in range(len(zs)-1)}
    if kind=='slotted-turner':occupied -= {(1,2),(5,2)}
    elif kind=='fork':occupied -= {(1,2),(1,3),(5,2),(5,3)}
    elif kind!='turner':raise ValueError('Unknown authored utensil refinement')
    return _plate(xs,zs,occupied,lo,hi)


def validate_source(name,count,materials,box,spec):
    if name!=spec['name'] or count!=spec['vertices'] or materials!=spec['materials']:
        raise ValueError('Named source component/material topology changed: '+name)
    if any(abs(box[side][axis]-spec['bounds'][side][axis])>2e-6 for side in ('min','max') for axis in range(3)):
        raise ValueError('Named source component bounds changed: '+name)


def apply_refinement(scene,item,keys,names,specs):
    import bpy
    from mathutils import Vector
    candidates={names.get(obj.name):obj for obj in scene.objects if obj.type=='MESH' and obj.name in names}
    plans=[]
    # Validate and plan everything before mutating any source component.
    for spec in specs:
        name=spec['name'];obj=candidates.get(name)
        if obj is None or obj.data.shape_keys or obj.get('motion_role') or obj.get('shared_geometry'):
            raise ValueError('Missing or protected exact source component: '+name)
        points=[tuple(obj.matrix_world @ vertex.co) for vertex in obj.data.vertices]
        original=bounds(points);materials=[keys.get(mat.name) if mat else None for mat in obj.data.materials]
        validate_source(name,len(points),materials,original,spec)
        lo,hi=list(original['min']),list(original['max']);kind=spec['kind']
        if kind=='vessel':geometry=vessel_mesh(lo,hi)
        elif kind=='fire-bowl':geometry=fire_bowl_mesh(lo,hi)
        elif kind=='rim':geometry=rim_mesh(lo,hi)
        elif kind=='petal':geometry=petal_mesh(points)
        elif kind=='submerged-stem':
            bottom,top=lo[2],hi[2];lo[2]=spec['hiddenBaseZ']
            if not bottom < lo[2] < top:
                raise ValueError('Stem floor contact must stay inside its source height')
            geometry=([(x,y,lo[2]+(z-bottom)/(top-bottom)*(top-lo[2])) for x,y,z in points],
                      [tuple(p.vertices) for p in obj.data.polygons])
        elif kind=='flower-center':
            # Source center hovered above its petals. Seat the new rounded
            # center into their shared stem junction, preserving its top height.
            lo[2]=spec['seatedBaseZ']
            geometry=lathe([(0,0),(.7,0),(1,.12),(1,.45),(.93,.7),(.72,.9),(.38,.985),(0,1)],lo,hi,48)
        else:geometry=utensil_mesh(lo,hi,kind)
        box=bounds(geometry[0])
        if any(box['min'][a]<lo[a]-1e-7 or box['max'][a]>hi[a]+1e-7 for a in range(3)):
            raise ValueError('Refined component exceeds its measured source envelope: '+name)
        if len(geometry[0])>6000 or sum(len(f)-2 for f in geometry[1])>12000:
            raise ValueError('Refined component exceeds bounded mesh cost: '+name)
        plans.append((obj,spec,geometry,box))
    changes=[]
    for obj,spec,(vertices,faces),box in plans:
        inverse=obj.matrix_world.inverted();mesh=bpy.data.meshes.new(obj.data.name+' refined construction')
        mesh.from_pydata([inverse @ Vector(v) for v in vertices],[],faces)
        for material in obj.data.materials:mesh.materials.append(material)
        mesh.update()
        for polygon in mesh.polygons:
            heights=[vertices[i][2] for i in polygon.vertices]
            polygon.use_smooth=spec['kind'] in {'vessel','fire-bowl','rim','petal','flower-center','spoon','submerged-stem'} and max(heights)-min(heights)>1e-8
        if spec['kind']=='petal':
            uv=mesh.uv_layers.new(name='UVMap',do_init=False)
            for loop in uv.data:loop.uv=(0,0)
        elif spec['kind']=='submerged-stem':
            for old_layer in obj.data.uv_layers:
                layer=mesh.uv_layers.new(name=old_layer.name,do_init=False)
                for before,after in zip(old_layer.data,layer.data):after.uv=before.uv
                layer.active_render=old_layer.active_render
        old=obj.data;obj.data=mesh
        for modifier in list(obj.modifiers):obj.modifiers.remove(modifier)
        if spec['kind'] in {'turner','slotted-turner','fork'}:
            modifier=obj.modifiers.new('Soft carved utensil edges','BEVEL');modifier.width=.00045;modifier.segments=3
            modifier.affect='EDGES';modifier.limit_method='ANGLE';modifier.angle_limit=.35
        obj['catalog_refinement']=item['id']
        changes.append({'kind':'source-evidenced-construction','component':spec['name'],'construction':spec['kind'],
                        'sourceVertices':len(old.vertices),'candidateVertices':len(vertices),'candidateTriangles':sum(len(f)-2 for f in faces),
                        'boundsM':box,'preserved':['catalog dimensions','material keys and objects','source placement and transforms'],
                        **({'sourceBaseZ':spec['bounds']['min'][2],'seatedBaseZ':spec['seatedBaseZ']} if spec['kind']=='flower-center' else {})})
    return changes
