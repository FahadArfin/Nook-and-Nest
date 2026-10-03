"""Three exact reviewed defects; no catalog-wide material or geometry policy.

Source guards are embedded in the adjacent per-ID entrypoints. No runtime JSON
dependency is hidden from the refinement manifest. Original art pixels and all
material bindings remain intact; only its source-evidenced mesh UVs change.
"""
import hashlib
import math
import struct


def bounds(points):
    return {s: [fn(p[a] for p in points) for a in range(3)]
            for s, fn in (('min', min), ('max', max))}


def _inside(inner, outer, tolerance=2e-6):
    return all(inner['min'][a] >= outer['min'][a]-tolerance and
               inner['max'][a] <= outer['max'][a]+tolerance for a in range(3))


def art_uv(point, box):
    """U right, V up, square source texels: full width and centered crop."""
    width = box['max'][0]-box['min'][0]
    if width <= 0: raise ValueError('Nonzero art width required')
    return ((point[0]-box['min'][0])/width,
            .5+(point[2]-(box['min'][2]+box['max'][2])/2)/width)


def rounded_loop(x0, x1, y0, y1, radius, spacing=.008):
    if min(x1-x0,y1-y0) <= 2*radius or not 0 < spacing <= .016:
        raise ValueError('Nondegenerate bounded sewn perimeter required')
    anchors=[]
    n=max(4, math.ceil(math.pi*.5*radius/spacing))
    for cx,cy,start in ((x1-radius,y1-radius,0),(x0+radius,y1-radius,90),
                        (x0+radius,y0+radius,180),(x1-radius,y0+radius,270)):
        for i in range(n+1):
            angle=math.radians(start+i*90/n)
            anchors.append((cx+radius*math.cos(angle),cy+radius*math.sin(angle)))
    result=[]
    for a,b in zip(anchors,anchors[1:]+anchors[:1]):
        count=max(1,math.ceil(math.dist(a,b)/spacing))
        for i in range(count):result.append(tuple(a[k]+(b[k]-a[k])*i/count for k in range(2)))
    return result


def _cross(a,b):
    return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])


def _unit(v):
    length=math.sqrt(sum(x*x for x in v))
    if length < 1e-10: raise ValueError('Degenerate sewn section frame')
    return tuple(x/length for x in v)


def sewn_tube(centers, normals, radius, sides=8):
    if len(centers)<8 or len(centers)!=len(normals) or not .001<radius<.004:
        raise ValueError('Invalid continuous sewn cover construction')
    vertices=[];faces=[];n=len(centers)
    for i,center in enumerate(centers):
        tangent=_unit(tuple(centers[(i+1)%n][a]-centers[i-1][a] for a in range(3)))
        side=_unit(_cross(tangent,normals[i]));up=_unit(_cross(side,tangent))
        for j in range(sides):
            angle=j*math.tau/sides
            vertices.append(tuple(center[a]+radius*(math.cos(angle)*side[a]+math.sin(angle)*up[a]) for a in range(3)))
    for i in range(n):
        for j in range(sides):
            faces.append((i*sides+j,i*sides+(j+1)%sides,((i+1)%n)*sides+(j+1)%sides,((i+1)%n)*sides+j))
    return vertices,faces


def _box(role,lo,hi,key,bevel=.003):
    return {'role':role,'shape':'box','bounds':{'min':list(lo),'max':list(hi)},'materialKey':key,'bevel':bevel}


def loveseat_supports():
    # Original deck reaches z=.3571, backs start .4525, arms start .3696.
    # This continuous rail bridges those gaps and joins both rear arm ends.
    return [_box('upholstered-back-frame',(-.649,.373,.331),(.649,.428,.722),'linen',.008),
            _box('under-arm-mount',(-.711,-.382,.340),(-.616,.382,.389),'linen',.006),
            _box('under-arm-mount',(.616,-.382,.340),(.711,.382,.389),'linen',.006)]


def lift_construction():
    # Keep the original closed top at z=.407163..460 and both steel trestles.
    # The measured under-top frame supports a real shallow storage carcass.
    wood='wood-honey-textured';metal='modern-brushed-aluminum'
    rows=[_box('storage-floor',(-.403,-.245,.229),(.403,.245,.247),wood),
          _box('storage-side',(-.403,-.245,.245),(-.383,.245,.402),wood),
          _box('storage-side',(.383,-.245,.245),(.403,.245,.402),wood),
          _box('storage-back',(-.383,.225,.245),(.383,.245,.402),wood),
          _box('storage-front',(-.383,-.245,.245),(.383,-.225,.380),wood),
          _box('finger-pull-left',(-.383,-.245,.378),(-.080,-.225,.402),wood),
          _box('finger-pull-right',(.080,-.245,.378),(.383,-.225,.402),wood)]
    for sign in (-1,1):
        x=sign*.344
        rows.append(_box('top-mount',(x-.025,-.177,.398),(x+.025,.204,.409),'modern-brushed-aluminum',.0015))
        rows.append(_box('lower-lift-mount',(x-.022,-.180,.350),(x+.022,.215,.364),metal,.0015))
        for offset in (-.012,.012):
            rows.append({'role':'folded-lift-link','shape':'link','a':(x+offset,-.145,.358),
                         'b':(x+offset,.174,.400),'width':.011,'thickness':.004,'materialKey':metal,'bevel':.001})
        for y,z in ((-.145,.358),(.174,.400)):
            rows.append({'role':'hinge-pin','shape':'pin','center':(x,y,z),'length':.043,'radius':.006,
                         'materialKey':metal,'bevel':0})
        # Rear hinge barrels remain legible below the overhang in the closed state.
        rows.append(_box('rear-hinge-plate',(x-.030,.236,.374),(x+.030,.266,.400),metal,.0015))
        rows.append({'role':'hinge-pin','shape':'pin','center':(x,.254,.397),'length':.065,'radius':.008,
                     'materialKey':metal,'bevel':0})
    return rows


def part_geometry(part):
    if part['shape']=='box':
        lo,hi=part['bounds']['min'],part['bounds']['max']
        vertices=[(x,y,z) for z in (lo[2],hi[2]) for y in (lo[1],hi[1]) for x in (lo[0],hi[0])]
        return vertices,[(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)]
    if part['shape']=='pin':
        x,y,z=part['center'];n=32;r=part['radius'];half=part['length']/2
        vertices=[(x+dx,y+r*math.cos(i*math.tau/n),z+r*math.sin(i*math.tau/n)) for dx in (-half,half) for i in range(n)]
        faces=[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
        return vertices,faces+[tuple(reversed(range(n))),tuple(range(n,2*n))]
    a,b=part['a'],part['b'];direction=_unit(tuple(b[i]-a[i] for i in range(3)))
    side=(1,0,0);up=_unit(_cross(side,direction));half=part['thickness']/2;wide=part['width']/2
    vertices=[tuple(p[k]+sx*half*side[k]+sy*wide*up[k] for k in range(3)) for p in (a,b) for sy in (-1,1) for sx in (-1,1)]
    return vertices,[(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)]


def _geometry_hash(obj):
    h=hashlib.sha256()
    for v in obj.data.vertices:h.update(struct.pack('<3d',*(obj.matrix_world@v.co)))
    for p in obj.data.polygons:h.update(struct.pack('<I',len(p.vertices)));h.update(struct.pack('<'+'I'*len(p.vertices),*p.vertices))
    return h.hexdigest()


def _uv_hash(layer):
    return hashlib.sha256(b''.join(struct.pack('<2f',*v.uv) for v in layer.data)).hexdigest()


def _checked(scene,item,keys,names,specs,source_sha):
    if item['sourceBlend']['sha256']!=source_sha:raise ValueError('Reviewed editable source changed')
    objects={names.get(o.name,o.name):o for o in scene.objects if o.type=='MESH'};result={}
    for spec in specs:
        obj=objects.get(spec['name'])
        if obj is None or any(obj.get(k) for k in ('motion_role','shared_geometry','linked_bough')) or obj.modifiers or obj.data.shape_keys:
            raise ValueError('Expected static reviewed component: '+spec['name'])
        actual=[keys[m.name] for m in obj.data.materials]
        if actual!=spec['materials']:raise ValueError('Reviewed material role changed: '+spec['name'])
        points=[obj.matrix_world@v.co for v in obj.data.vertices];box=bounds(points)
        if spec.get('kind')=='trim':
            if len(points)!=spec['vertices']:raise ValueError('Reviewed sewn source topology changed')
        else:
            if any(abs(box[s][a]-spec['bounds'][s][a])>2e-6 for s in ('min','max') for a in range(3)):
                raise ValueError('Reviewed component envelope changed: '+spec['name'])
            if spec.get('kind')!='soft' and len(points)!=spec['vertices']:raise ValueError('Reviewed source vertex count changed')
        result[spec['name']]=obj
    return result


def _new_mesh(name, geometry, materials, bevel=0):
    import bpy
    import bmesh
    vertices,faces=geometry
    mesh=bpy.data.meshes.new(name+' editable mesh');mesh.from_pydata(vertices,[],faces);mesh.update()
    for material in materials:mesh.materials.append(material)
    bm=bmesh.new();bm.from_mesh(mesh)
    if bevel:
        bmesh.ops.bevel(bm,geom=list(bm.edges),offset=bevel,segments=3,affect='EDGES',clamp_overlap=True)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free();mesh.update()
    uv=mesh.uv_layers.new(name='UVMap',do_init=False)
    for face in mesh.polygons:
        dominant=max(range(3),key=lambda a:abs(face.normal[a]));axes=[a for a in range(3) if a!=dominant]
        face.use_smooth=len(face.vertices)==4 and bool(bevel==0)
        for loop in face.loop_indices:
            v=mesh.vertices[mesh.loops[loop].vertex_index].co;uv.data[loop].uv=tuple(v[a] for a in axes)
    uv.active_render=True
    return mesh


def _add(scene,names,name,part,material,overall):
    import bpy
    if name in names.values():raise ValueError('Reviewed detail already exists')
    geometry=part_geometry(part)
    if not _inside(bounds(geometry[0]),overall):raise ValueError('New construction exceeds original placement envelope')
    mesh=_new_mesh(name,geometry,[material],part.get('bevel',0))
    obj=bpy.data.objects.new(name,mesh);scene.collection.objects.link(obj);names[obj.name]=name
    obj['catalog_realism_added_detail']=True
    return {'kind':'source-evidenced-construction','newComponent':name,'construction':part['role'],
            'materialKey':part['materialKey'],'boundsM':bounds([tuple(v.co) for v in mesh.vertices]),
            'candidateVertices':len(mesh.vertices),'preserved':['all original components','overall source bounds','material keys and factors']}


def _art(objects,item):
    obj=objects['valley_art'];mesh=obj.data;box=bounds([obj.matrix_world@v.co for v in mesh.vertices])
    if len(mesh.uv_layers)!=1 or mesh.uv_layers[0].name!='UVMap':raise ValueError('Expected original artwork UVMap')
    uv=mesh.uv_layers[0];before_uv=_uv_hash(uv);before_geometry=_geometry_hash(obj);count=0
    transform=obj.matrix_world.to_3x3().inverted().transposed()
    for face in mesh.polygons:
        normal=transform@face.normal
        if normal.y >= -1e-6:continue
        for loop in face.loop_indices:
            point=obj.matrix_world@mesh.vertices[mesh.loops[loop].vertex_index].co
            uv.data[loop].uv=art_uv(point,box);count+=1
    if count<4 or _uv_hash(uv)==before_uv:raise ValueError('Artwork projection made no measured correction')
    after_geometry=_geometry_hash(obj)
    if before_geometry!=after_geometry:raise ValueError('Artwork geometry must remain exact')
    return [{'kind':'source-evidenced-artwork-orientation','component':'valley_art','materialKey':'artwork-landscape',
             'originalUvSha256':before_uv,'correctedUvSha256':_uv_hash(uv),'unchangedGeometrySha256':before_geometry,
             'imageSha256':'ac96dd16ec6bf784648f3d79245bfa6e6f1af863429f54caf002ce0adab5fb41',
             'correctedCorners':count,'projection':{'uAxis':'+world X','vAxis':'+world Z','widthM':box['max'][0]-box['min'][0],
             'vRange':[art_uv(box['min'],box)[1],art_uv(box['max'],box)[1]],'framing':'full width, centered vertical crop; square source pixels'},
             'sourceCause':'Generic Smart UV Project packed the artwork front island sideways; original image is upright.',
             'preserved':['original image bytes','texture reference, sampler and texCoord','geometry and normals','material factors','back-face chart']}]


def _seat_welt(obj,pad,back):
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    original_geometry=_geometry_hash(obj);old_vertices=len(obj.data.vertices)
    points=[pad.matrix_world@v.co for v in pad.data.vertices];box=bounds(points);pad.data.calc_loop_triangles()
    tree=BVHTree.FromPolygons(points,[tuple(t.vertices) for t in pad.data.loop_triangles],all_triangles=True)
    axis=2 if back else 1
    # Stay inside the cover's rolled edge; nearest fallback handles its rounded
    # corners. Every short segment is seated, including the long source runs.
    line=rounded_loop(box['min'][0]+.012,box['max'][0]-.012,box['min'][axis]+.012,box['max'][axis]-.012,.035,.008)
    radius=.0024;centers=[];normals=[];fallback=0;exposure=[]
    for x,q in line:
        origin=Vector((x,box['min'][1]-.15,q) if back else (x,q,box['max'][2]+.15))
        direction=Vector((0,1,0) if back else (0,0,-1))
        hit=tree.ray_cast(origin,direction,.8)
        if hit[0] is None:
            reference=Vector((x,box['min'][1]-.025,q) if back else (x,q,box['max'][2]+.025))
            hit=tree.find_nearest(reference);fallback+=1
        if hit[0] is None or hit[1].dot(-direction)<.03:raise ValueError('Sewn perimeter did not meet its own cover front')
        normal=hit[1].normalized();center=hit[0]+normal*(radius*.30)
        centers.append(tuple(center));normals.append(tuple(normal))
        exposure.append((center-hit[0]).dot(normal))
    # A cyclic tube with a measured normal offset replaces the malformed open
    # branch-style original welt. Existing object identity/material is retained.
    geometry=sewn_tube(centers,normals,radius)
    allowed={'min':[box['min'][a]-.004 for a in range(3)],'max':[box['max'][a]+.004 for a in range(3)]}
    if not _inside(bounds(geometry[0]),allowed):raise ValueError('Seated welt escaped its own cushion')
    old=obj.data;inverse=obj.matrix_world.inverted()
    local=([tuple(inverse@Vector(p)) for p in geometry[0]],geometry[1])
    obj.data=_new_mesh(obj.name,local,list(old.materials))
    for face in obj.data.polygons:face.use_smooth=True
    return {'kind':'source-evidenced-contact','component':obj.name,'matchedCover':pad.name,
            'construction':'complete closed sewn perimeter seated at every dense surface sample',
            'beforeGeometrySha256':original_geometry,'afterGeometrySha256':_geometry_hash(obj),
            'beforeVertices':old_vertices,'afterVertices':len(obj.data.vertices),'centerlineSamples':len(centers),
            'maximumProjectedPathSpacingM':.008,'sourceNominalRadiusM':radius,'centerSurfaceOffsetM':[min(exposure),max(exposure)],
            'cornerNearestFallbacks':fallback,'topologyChanged':True,'preserved':['original component identity and material slots','cover geometry and original cover UVs','nominal sewn radius','overall dimensions']}


def apply(root,scene,item,keys,names,specs,source_sha):
    objects=_checked(scene,item,keys,names,specs,source_sha)
    all_points=[obj.matrix_world@v.co for obj in scene.objects if obj.type=='MESH' for v in obj.data.vertices]
    overall=bounds(all_points)
    if item['id']=='landscape-painting':return _art(objects,item)
    if item['id']=='library-reading-loveseat':
        changes=[]
        for prefix,back in (('tailored back cushion',True),('separate seat cushion',False)):
            for suffix in ('','.001'):
                record=_seat_welt(objects[prefix+' sewn welt'+suffix],objects[prefix+suffix],back)
                record['component']=prefix+' sewn welt'+suffix;record['matchedCover']=prefix+suffix;changes.append(record)
        material=objects['upholstered seat deck'].data.materials[0]
        for i,part in enumerate(loveseat_supports()):
            changes.append(_add(scene,names,'detail_reading_'+part['role'].replace('-','_')+'_'+str(i+1),part,material,overall))
        return changes
    if item['id']=='lift-coffee-table':
        palette={keys[mat.name]:mat for obj in objects.values() for mat in obj.data.materials}
        return [_add(scene,names,'detail_lift_'+p['role'].replace('-','_')+'_'+str(i+1),p,palette[p['materialKey']],overall)
                for i,p in enumerate(lift_construction())]
    raise ValueError('No reviewed correction for this catalog ID')
