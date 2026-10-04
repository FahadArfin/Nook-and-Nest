"""Four measured construction defects from catalog five-view review 504–539.

Only adjacent exact-ID entrypoints call this helper. Their embedded source
guards are the runtime evidence; the separate native probe is not a dependency.
"""
import hashlib
import math
import struct


def bounds(points):
    return {side: [fn(p[i] for p in points) for i in range(3)]
            for side, fn in (('min', min), ('max', max))}


def inside(inner, outer, tolerance=2e-6):
    return all(inner['min'][i] >= outer['min'][i]-tolerance and
               inner['max'][i] <= outer['max'][i]+tolerance for i in range(3))


def _box(role, lo, hi, material, bevel=.003):
    return {'role': role, 'shape': 'box', 'bounds': {'min': list(lo), 'max': list(hi)},
            'materialKey': material, 'bevel': bevel}


def arched_shell(box, spring, segments=64):
    """One manifold extrusion: rectangular lower case and elliptical arch."""
    lo, hi = box['min'], box['max']
    if segments < 16 or segments % 2 or not lo[2] < spring < hi[2]:
        raise ValueError('Invalid bounded arch')
    cx = (lo[0]+hi[0])/2; rx=(hi[0]-lo[0])/2; rz=hi[2]-spring
    profile=[(lo[0],lo[2]),(hi[0],lo[2])]
    profile += [(cx+rx*math.cos(i*math.pi/segments),spring+rz*math.sin(i*math.pi/segments)) for i in range(segments+1)]
    n=len(profile); verts=[(x,y,z) for y in (lo[1],hi[1]) for x,z in profile]
    faces=[tuple(range(n)),tuple(reversed(range(n,2*n)))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return verts,faces


def chair_supports():
    rows=[]
    for sign in (-1,1):
        rows.append({'role':'back-upright','shape':'beam','a':(sign*.222,.216,.381),
                     'b':(sign*.242,.190,.483),'width':.026,'depth':.027,
                     'materialKey':'modern-brushed-aluminum','bevel':.0015})
        rows.append(_box('rear-seat-mount',(sign*.222-.018,.201,.366),
                         (sign*.222+.018,.231,.401),'modern-recess-charcoal',.002))
        rows.append(_box('back-frame-socket',(sign*.242-.015,.175,.451),
                         (sign*.242+.015,.208,.496),'modern-recess-charcoal',.002))
    return rows


def sofa_supports():
    wood='wood-honey-textured'
    rows=[_box('rear-upright',(x-.0275,.360,.312),(x+.0275,.430,.715),wood,.004)
          for x in (-.941,.941)]
    rows += [_box('rear-upright',(-.0275,.378,.312),(.0275,.430,.715),wood,.004)]
    rows += [_box('back-rail',(-.969,.402,z),(.969,.430,z+.050),wood,.003)
             for z in (.470,.665)]
    return rows


def mirror_backing():
    # A carved crown is attached to the top rail. Its back plate captures all
    # seven existing ornament centers, leaving the original tips as relief.
    return {'min':[-.214,.010,1.067], 'max':[.214,.029,1.341]},1.130


def part_geometry(part):
    if part['shape']=='box':
        lo,hi=part['bounds']['min'],part['bounds']['max']
        points=[(x,y,z) for z in (lo[2],hi[2]) for y in (lo[1],hi[1]) for x in (lo[0],hi[0])]
    else:
        a,b=part['a'],part['b'];delta=[b[i]-a[i] for i in range(3)]
        length=math.hypot(delta[1],delta[2]);normal=(0,delta[2]/length,-delta[1]/length)
        points=[tuple(p[i]+sx*part['width']/2*(i==0)+sy*part['depth']/2*normal[i] for i in range(3))
                for p in (a,b) for sy in (-1,1) for sx in (-1,1)]
    return points,[(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)]


def _hash(obj):
    h=hashlib.sha256()
    for v in obj.data.vertices: h.update(struct.pack('<3d',*(obj.matrix_world@v.co)))
    for p in obj.data.polygons:
        h.update(struct.pack('<I',len(p.vertices)));h.update(struct.pack('<'+'I'*len(p.vertices),*p.vertices))
    return h.hexdigest()


def _checked(scene,item,keys,names,specs,sha):
    if item['sourceBlend']['sha256']!=sha: raise ValueError('Reviewed original source changed')
    lookup={names.get(o.name,o.name):o for o in scene.objects if o.type=='MESH'}
    result={}
    for spec in specs:
        obj=lookup.get(spec['name'])
        if obj is None or obj.modifiers or obj.data.shape_keys or any(obj.get(k) for k in ('motion_role','shared_geometry','linked_bough')):
            raise ValueError('Expected static reviewed component: '+spec['name'])
        if [keys[m.name] for m in obj.data.materials]!=spec['materials']:
            raise ValueError('Reviewed exact material role changed: '+spec['name'])
        box=bounds([obj.matrix_world@v.co for v in obj.data.vertices])
        if any(abs(box[s][i]-spec['bounds'][s][i])>2e-6 for s in ('min','max') for i in range(3)):
            raise ValueError('Reviewed component bounds changed: '+spec['name'])
        if spec.get('kind')!='soft' and len(obj.data.vertices)!=spec['vertices']:
            raise ValueError('Reviewed component topology changed: '+spec['name'])
        result[spec['name']]=obj
    return result


def _mesh(name,geometry,materials,bevel=0,fit=None):
    import bpy
    import bmesh
    points,faces=geometry
    mesh=bpy.data.meshes.new(name+' editable construction')
    mesh.from_pydata(points,[],faces);mesh.update()
    for mat in materials:mesh.materials.append(mat)
    bm=bmesh.new();bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    if bevel:
        edges=[e for e in bm.edges if e.is_manifold and e.calc_face_angle()>.5]
        bmesh.ops.bevel(bm,geom=edges,offset=bevel,segments=3,affect='EDGES',clamp_overlap=True)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free();mesh.update()
    if fit:
        current=bounds([v.co for v in mesh.vertices])
        for v in mesh.vertices:
            for i in range(3):v.co[i]=fit['min'][i]+(v.co[i]-current['min'][i])/(current['max'][i]-current['min'][i])*(fit['max'][i]-fit['min'][i])
        mesh.update()
    uv=mesh.uv_layers.new(name='UVMap',do_init=False)
    for face in mesh.polygons:
        axis=max(range(3),key=lambda i:abs(face.normal[i]));axes=[i for i in range(3) if i!=axis]
        # Broad caps remain planar. Small bevel faces are smooth; their boundary
        # against a flat cap retains a split normal at that cap.
        face.use_smooth=max(abs(v) for v in face.normal)<.9999
        for loop in face.loop_indices:
            v=mesh.vertices[mesh.loops[loop].vertex_index].co
            uv.data[loop].uv=(v[axes[0]],v[axes[1]])
    uv.active_render=True
    return mesh


def _add(scene,names,name,geometry,material,overall,bevel=.003):
    import bpy
    if name in names.values():raise ValueError('Reviewed detail already present')
    if not inside(bounds(geometry[0]),overall):raise ValueError('Reviewed construction exceeds placement envelope')
    mesh=_mesh(name,geometry,[material],bevel)
    obj=bpy.data.objects.new(name,mesh);scene.collection.objects.link(obj);names[obj.name]=name
    obj['catalog_realism_added_detail']=True
    return obj


def _clock(objects,scene,names,overall):
    import bpy
    from mathutils import Vector
    upper=objects['arched_upper_case'];lower=objects['arched_case_lower'];dial=objects['ivory_porcelain_dial']
    old=[{'component':names[o.name], 'geometrySha256':_hash(o),'vertices':len(o.data.vertices)} for o in (lower,upper)]
    box=bounds([o.matrix_world@v.co for o in (upper,lower) for v in o.data.vertices])
    old_upper=bounds([upper.matrix_world@v.co for v in upper.data.vertices]);spring=(old_upper['min'][2]+old_upper['max'][2])/2
    geometry=arched_shell(box,spring)
    # Author and bevel in world metres, then preserve the exact source transform.
    mesh=_mesh('joined arched clock case',geometry,list(upper.data.materials),.0008,fit=box)
    inverse=upper.matrix_world.inverted()
    for v in mesh.vertices:v.co=inverse@v.co
    mesh.update();upper.data=mesh
    lower_name=names.pop(lower.name);bpy.data.objects.remove(lower,do_unlink=True)
    changed=0;transform=dial.matrix_world.to_3x3().inverted().transposed()
    for face in dial.data.polygons:
        normal=(transform@face.normal).normalized()
        if abs(normal.y)>.9999:
            changed+=int(face.use_smooth);face.use_smooth=False
    if changed==0:raise ValueError('Expected original smoothly shaded porcelain caps')
    actual=bounds([upper.matrix_world@v.co for v in upper.data.vertices])
    if any(abs(actual[s][i]-box[s][i])>2e-6 for s in ('min','max') for i in range(3)):
        raise ValueError('Joined clock case changed its original envelope')
    return [{'kind':'source-evidenced-joined-clock-case','component':'arched_upper_case','mergedOriginalComponents':old,
             'removedOverlappingComponent':lower_name,'sourceCause':'Upper full-disc rear cap and lower box rear share exactly the same Y plane.',
             'afterGeometrySha256':_hash(upper),'candidateVertices':len(mesh.vertices),'archSegments':64,
             'planarDialCapsCorrected':changed,'boundsM':actual,'topologyChanged':True,
             'preserved':['whole-model dimensions','clock dial and numerals geometry','original material keys and factors','dial UVs']}]


def apply(root,scene,item,keys,names,specs,sha):
    objects=_checked(scene,item,keys,names,specs,sha)
    overall=bounds([o.matrix_world@v.co for o in scene.objects if o.type=='MESH' for v in o.data.vertices])
    if item['id']=='mantel-clock':return _clock(objects,scene,names,overall)
    palette={keys[m.name]:m for o in objects.values() for m in o.data.materials}
    if item['id']=='mirror':
        box,spring=mirror_backing()
        obj=_add(scene,names,'detail_mirror_carved_crown_backing',arched_shell(box,spring,48),palette['wood-honey-textured'],overall,.001)
        return [{'kind':'source-evidenced-connected-mirror-crown','newComponent':names[obj.name],
                 'sourceCause':'Seven original sun rays have no connection to the medallion or top frame.',
                 'construction':'Thin carved wood backing joins top rail, medallion and all seven original ray centers.',
                 'materialKey':'wood-honey-textured','candidateVertices':len(obj.data.vertices),'boundsM':bounds([v.co for v in obj.data.vertices]),
                 'preserved':['all original component geometry and UVs','material keys and factors','whole-model dimensions']}]
    plans={'mesh-dining-chair':chair_supports,'midcentury-sofa':sofa_supports}
    if item['id'] not in plans:raise ValueError('No reviewed construction for this catalog ID')
    additions=[]
    for i,part in enumerate(plans[item['id']]()):
        name='detail_'+item['id'].replace('-','_')+'_'+part['role'].replace('-','_')+'_'+str(i+1)
        obj=_add(scene,names,name,part_geometry(part),palette[part['materialKey']],overall,part['bevel'])
        additions.append({'name':name,'construction':part['role'],'materialKey':part['materialKey'],
                          'vertices':len(obj.data.vertices),'boundsM':bounds([v.co for v in obj.data.vertices])})
    return [{'kind':'source-evidenced-connected-back-frame','newComponents':additions,
             'sourceCause':'Reviewed original upper back had no structural connection to the existing seat frame.',
             'construction':'Two mounted metal uprights' if item['id']=='mesh-dining-chair' else 'Three wood uprights and two transverse back rails',
             'preserved':['all original component geometry and UVs','material keys and factors','whole-model dimensions']}]
