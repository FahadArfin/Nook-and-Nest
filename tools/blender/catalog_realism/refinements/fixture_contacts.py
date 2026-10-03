"""Exact reviewed support, optical-face and dispensing-space refinements.

Pure geometry is independently testable. Native mutation is limited to the
named source components supplied by the three per-model entrypoints.
"""
import math
from pathlib import Path
import runpy

_curves = runpy.run_path(str(Path(__file__).with_name('curved_construction.py')))
bounds = _curves['bounds']
validate_source = _curves['validate_source']
outward = _curves['outward']


def _cross(a,b):
    return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])


def _unit(a):
    length=math.sqrt(sum(v*v for v in a))
    if length < 1e-12:raise ValueError('Nondegenerate construction axis required')
    return tuple(v/length for v in a)


def closed_tube(path,radius,sides=16):
    if len(path)<2 or radius<=0 or sides<8:raise ValueError('Invalid support tube')
    vertices=[];faces=[]
    for i,point in enumerate(path):
        before,after=path[max(i-1,0)],path[min(i+1,len(path)-1)]
        tangent=_unit(tuple(after[a]-before[a] for a in range(3)))
        axis=(0,0,1) if abs(tangent[2])<.9 else (0,1,0)
        side=_unit(_cross(tangent,axis));up=_cross(tangent,side)
        for j in range(sides):
            angle=math.tau*j/sides
            vertices.append(tuple(point[a]+radius*(math.cos(angle)*side[a]+math.sin(angle)*up[a]) for a in range(3)))
    for i in range(len(path)-1):
        for j in range(sides):faces.append((i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j))
    faces += [tuple(reversed(range(sides))),tuple(range((len(path)-1)*sides,len(path)*sides))]
    return outward(vertices,faces)


def stool_paths():
    result=[]
    # Both ends are buried in the original pan/back, without changing either.
    for x in (-.14,.14):
        controls=[(x,.126,.309),(x,.151,.341),(x,.186,.418),(x,.168,.490)]
        path=[]
        for i in range(25):
            t=i/24
            path.append(tuple((1-t)**3*controls[0][a]+3*(1-t)**2*t*controls[1][a]+3*(1-t)*t*t*controls[2][a]+t**3*controls[3][a] for a in range(3)))
        result.append({'role':'back-mount','path':path,'geometry':closed_tube(path,.009)})
    cy=-.00790957361459732;z=.14058493077754974
    # Source modern_models.py:ring used rx=ry=.33*w before independent X/Y
    # normalization. Recover its normalized centerline from the original tube.
    rx=.17473456263542175/(.33*.42+.015)*(.33*.42)
    ry=(.1602436751127243+.17606282234191895)/2/(.33*.42+.015)*(.33*.42)
    for x in (-.18156012892723083,.18156012892723083):
        for y in (-.18263129889965057,.16681215167045593):
            angle=math.atan2((y-cy)/ry,x/rx)
            path=[(rx*math.cos(angle),cy+ry*math.sin(angle),z),(x,y,z)]
            result.append({'role':'footrest-brace','path':path,'geometry':closed_tube(path,.008)})
    return result


def planar_caps(vertices,faces):
    box=bounds(vertices);result=[]
    for i,face in enumerate(faces):
        ys=[vertices[j][1] for j in face]
        if max(ys)-min(ys)<=1e-7 and min(abs(ys[0]-box[s][1]) for s in ('min','max'))<=1e-7:
            result.append(i)
    return result


def _rounded_xz(x0,x1,z0,z1,radius):
    points=[]
    for cx,cz,start in [(x1-radius,z1-radius,0),(x0+radius,z1-radius,90),
                        (x0+radius,z0+radius,180),(x1-radius,z0+radius,270)]:
        for i in range(9):
            angle=math.radians(start+i*90/8)
            point=(cx+radius*math.cos(angle),cz+radius*math.sin(angle))
            if not points or math.dist(point,points[-1])>1e-10:points.append(point)
    if math.dist(points[0],points[-1])<1e-10:points.pop()
    return points


def coffee_plan():
    # The native source already owns the tray, its slots and crossbars. This
    # cavity exposes them without moving the controls, hopper or steam wand.
    cavity=_curves['extrude'](_rounded_xz(-.106,.106,.025,.241,.008),-.235,-.065)
    head=_curves['extrude'](_rounded_xz(-.067,.067,.202,.255,.008),-.203,-.055)
    rails=[_curves['extrude'](_rounded_xz(x-.00275,x+.00275,.033,.049,.001),-.163,-.063)
           for x in (-.101,.1002)]
    return {'cutter':cavity,'head':head,'grilleRails':rails,
            'cupClearanceM':.14404365420341492-.049,
            'recessDepthM':-.065-(-.1804884970188141),'probe':(0,-.3,.11)}


def spout_sleeve(lo,hi):
    cx,cy=(lo[0]+hi[0])/2,(lo[1]+hi[1])/2
    rx,ry=(hi[0]-lo[0])/2,(hi[1]-lo[1])/2
    vertices=[];faces=[];n=64
    for z,factor in [(lo[2],1),(hi[2],1),(lo[2],.60),(hi[2],.60)]:
        vertices += [(cx+rx*factor*math.cos(j*math.tau/n),cy+ry*factor*math.sin(j*math.tau/n),z) for j in range(n)]
    for i in range(n):
        j=(i+1)%n
        faces += [(i,j,n+j,n+i),(2*n+j,2*n+i,3*n+i,3*n+j),
                  (j,i,2*n+i,2*n+j),(n+i,n+j,3*n+j,3*n+i)]
    return outward(vertices,faces)


def _uv(mesh):
    uv=mesh.uv_layers.new(name='UVMap',do_init=False)
    for face in mesh.polygons:
        axes=[i for i in range(3) if i!=max(range(3),key=lambda a:abs(face.normal[a]))]
        for loop in face.loop_indices:
            p=mesh.vertices[mesh.loops[loop].vertex_index].co
            uv.data[loop].uv=tuple(p[a] for a in axes)
    uv.active_render=True


def _add(scene,names,name,geometry,material,smooth=True):
    import bpy
    if name in names.values():raise ValueError('Reviewed detail already exists: '+name)
    vertices,faces=geometry
    mesh=bpy.data.meshes.new(name+' editable mesh');mesh.from_pydata(vertices,[],faces)
    mesh.materials.append(material);mesh.update();_uv(mesh)
    if smooth:
        for p in mesh.polygons:p.use_smooth=len(p.vertices)==4
    obj=bpy.data.objects.new(name,mesh);scene.collection.objects.link(obj)
    names[obj.name]=name;obj['catalog_realism_added_detail']=True
    return obj


def _checked(scene,keys,names,specs):
    objects=_curves['_objects'](scene,names);result={}
    for spec in specs:
        # Original soft covers have already received the frozen loft treatment.
        soft=spec.get('kind')=='soft-contact'
        result[spec['name']]=_curves['_checked'](objects,spec,keys,exact_bounds=not soft,exact_count=not soft)[0]
    return result


def apply_stool(scene,item,keys,names,specs):
    if item['id']!='bar-stool':raise ValueError('Wrong stool source')
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    objects=_checked(scene,keys,names,specs)
    material=objects['aluminum_foot'].data.materials[0]
    supports=stool_paths();changes=[]
    for i,row in enumerate(supports):
        # A measured nearest-surface check proves both endpoints are seated,
        # rather than accepting a bounding-box-only claim of contact.
        targets=(['structural_seat_pan','tailored_back_cushion'] if row['role']=='back-mount'
                 else ['footrest','aluminum_foot'+('' if i==2 else '.'+str(i-2).zfill(3))])
        distances=[]
        for point,name in zip((row['path'][0],row['path'][-1]),targets):
            obj=objects[name];obj.data.calc_loop_triangles()
            tree=BVHTree.FromPolygons([obj.matrix_world@v.co for v in obj.data.vertices],[tuple(t.vertices) for t in obj.data.loop_triangles],all_triangles=True)
            hit=tree.find_nearest(Vector(point))
            if hit[0] is None or hit[3]>.026 or (Vector(point)-hit[0]).dot(hit[1])>1e-5:
                raise ValueError('Reviewed stool mount must end inside its original component: '+name)
            # The cap is intentionally inside each original solid, within one
            # local source section radius; the visible tube crosses its skin.
            distances.append(hit[3])
        name='detail_stool_'+row['role'].replace('-','_')+'_'+str(i+1)
        obj=_add(scene,names,name,row['geometry'],material)
        changes.append({'kind':'source-evidenced-construction','newComponent':name,'construction':row['role'],
                        'materialKey':'modern-brushed-aluminum','sourceComponents':targets,
                        'attachmentCentersM':[row['path'][0],row['path'][-1]],'endpointSurfaceDistancesM':distances,'endpointsInsideOriginals':True,
                        'candidateVertices':len(obj.data.vertices),'boundsM':bounds(row['geometry'][0]),
                        'preserved':['all original components, material slots, UVs and overall dimensions']})
    return changes


def apply_mirror(scene,item,keys,names,specs):
    if item['id']!='bath-mirror-pill':raise ValueError('Wrong optical panel source')
    objects=_checked(scene,keys,names,specs);changes=[]
    for spec in specs:
        obj=objects[spec['name']];mesh=obj.data
        vertices=[tuple(obj.matrix_world@v.co) for v in mesh.vertices]
        selected=planar_caps(vertices,[tuple(p.vertices) for p in mesh.polygons])
        if len(selected)<2:raise ValueError('Original mirror needs two proven planar end faces')
        was_smooth=sum(mesh.polygons[i].use_smooth for i in selected)
        if not was_smooth:raise ValueError('Reviewed optical shading defect is no longer present')
        custom=mesh.has_custom_normals
        normals=[tuple(n.vector) for n in mesh.corner_normals] if custom else None
        for i in selected:
            face=mesh.polygons[i];face.use_smooth=False
            if normals is not None:
                for loop in face.loop_indices:normals[loop]=tuple(face.normal)
        mesh.update()
        if normals is not None:mesh.normals_split_custom_set(normals)
        changes.append({'kind':'source-evidenced-optical-face','component':spec['name'],
                        'construction':'planar reflective caps use planar normals; rounded perimeter remains smooth',
                        'flattenedCapPolygons':len(selected),'previouslySmoothedCaps':was_smooth,
                        'customNormalsPreservedOutsideCaps':bool(custom),
                        'preserved':['all positions, topology, UVs, material factors and exact silhouette']})
    return changes


def apply_coffee(scene,item,keys,names,specs):
    if item['id']!='bean-coffee-machine':raise ValueError('Wrong coffee appliance source')
    import bpy
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    objects=_checked(scene,keys,names,specs);body=objects['coffee_machine_body'];plan=coffee_plan()
    old_box=bounds([tuple(body.matrix_world@v.co) for v in body.data.vertices]);old_count=len(body.data.vertices)
    cutter=_add(scene,{},'temporary_owned_dispensing_cut',plan['cutter'],body.data.materials[0],False)
    modifier=body.modifiers.new('Reviewed dispensing recess','BOOLEAN');modifier.operation='DIFFERENCE';modifier.solver='EXACT';modifier.object=cutter
    try:
        bpy.context.view_layer.update()
        evaluated=body.evaluated_get(bpy.context.evaluated_depsgraph_get())
        mesh=bpy.data.meshes.new_from_object(evaluated,preserve_all_data_layers=True,depsgraph=bpy.context.evaluated_depsgraph_get())
        actual=bounds([tuple(body.matrix_world@v.co) for v in mesh.vertices])
        if any(abs(actual[s][a]-old_box[s][a])>2e-6 for s in ('min','max') for a in range(3)):
            bpy.data.meshes.remove(mesh);raise ValueError('Dispensing recess changed the original outer case bounds')
        if len(mesh.vertices)<=old_count:
            bpy.data.meshes.remove(mesh);raise ValueError('Dispensing boolean did not construct the reviewed recess')
        mesh.calc_loop_triangles()
        tree=BVHTree.FromPolygons([body.matrix_world@v.co for v in mesh.vertices],[tuple(t.vertices) for t in mesh.loop_triangles],all_triangles=True)
        hit=tree.ray_cast(Vector(plan['probe']),Vector((0,1,0)),.5)
        if hit[0] is None or abs(hit[0].y-(-.065))>2e-6:
            bpy.data.meshes.remove(mesh);raise ValueError('Cup opening lacks the measured recessed back wall')
        body.data=mesh
        for m in list(body.modifiers):body.modifiers.remove(m)
    finally:
        if modifier in list(body.modifiers):body.modifiers.remove(modifier)
        cutter_mesh=cutter.data;bpy.data.objects.remove(cutter,do_unlink=True)
        if cutter_mesh.users==0:bpy.data.meshes.remove(cutter_mesh)
    changes=[{'kind':'source-evidenced-construction','component':'coffee_machine_body',
              'construction':'real recessed cup bay exposes original tray and grille',
              'sourceVertices':old_count,'candidateVertices':len(body.data.vertices),
              'recessDepthM':plan['recessDepthM'],'cupClearanceM':plan['cupClearanceM'],
              'measuredBackWallY':hit[0].y,'boundsM':actual,
              'preserved':['original outer case bounds and material','display, hopper, steam wand, tray and grille components'] }]
    spouts=[s for s in specs if s.get('kind')=='spout']
    for spec in spouts:
        obj=objects[spec['name']]
        geometry=spout_sleeve(spec['bounds']['min'],spec['bounds']['max'])
        evidence=_curves['_replace'](obj,geometry,smooth_sides=False)
        for face in obj.data.polygons:face.use_smooth=abs(face.normal.z)<.99
        changes.append({'kind':'source-evidenced-construction','component':spec['name'],
                        'construction':'closed nickel tube walls with visible outlet bore',**evidence,
                        'preserved':['original outlet bounds, material key and attachment height']})
    head=_add(scene,names,'detail_coffee_connected_dispensing_head',plan['head'],objects[spouts[0]['name']].data.materials[0],False)
    changes.append({'kind':'source-evidenced-construction','newComponent':names[head.name],
                    'construction':'dispensing head embeds both outlet tops and meets recessed case',
                    'materialKey':'brushed-nickel-hardware','boundsM':bounds(plan['head'][0]),
                    'sourceComponents':['coffee_machine_body']+[s['name'] for s in spouts]})
    for i,geometry in enumerate(plan['grilleRails']):
        rail=_add(scene,names,'detail_coffee_grille_bearing_rail_'+str(i+1),geometry,objects[spouts[0]['name']].data.materials[0],False)
        changes.append({'kind':'source-evidenced-contact','newComponent':names[rail.name],
                        'construction':'two side bearings seat existing grille bars into the tray and rear case',
                        'boundsM':bounds(geometry[0]),'trayOverlapM':.035516224801540375-.033,
                        'rearCaseOverlapM':.002,'originalGrilleBars':'unchanged'})
    return changes
