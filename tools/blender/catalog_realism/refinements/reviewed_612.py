"""Exact six-model construction follow-ups; no shared catalog policy changes."""
import hashlib
import math
from pathlib import Path
import runpy
import struct


def bounds(points):
    return {s:[fn(p[a] for p in points) for a in range(3)] for s,fn in (('min',min),('max',max))}


def fit(points,box):
    old=bounds(points)
    return [tuple(box['min'][a]+(p[a]-old['min'][a])/(old['max'][a]-old['min'][a])*(box['max'][a]-box['min'][a]) for a in range(3)) for p in points]


def surround_mesh(box,radius,segments=96):
    lo,hi=box['min'],box['max'];cx=(lo[0]+hi[0])/2;cy=(lo[1]+hi[1])/2
    hx=(hi[0]-lo[0])/2;hy=(hi[1]-lo[1])/2;v=[];f=[]
    if not 0<radius<min(hx,hy):raise ValueError('Fire pan aperture does not fit its source surround')
    for z,inner in ((lo[2],False),(hi[2],False),(hi[2],True),(lo[2],True)):
        for i in range(segments):
            a=i*math.tau/segments;c,s=math.cos(a),math.sin(a)
            r=radius if inner else min(hx/max(abs(c),1e-12),hy/max(abs(s),1e-12))
            v.append((cx+r*c,cy+r*s,z))
    for row in range(4):
        for i in range(segments):
            j=(i+1)%segments;a=row*segments;b=((row+1)%4)*segments
            f.append((a+i,a+j,b+j,b+i))
    # Exact extrema are stable even when trigonometric representations round.
    return fit(v,box),f


def firewood_mesh(box):
    """Four untapered split logs, stacked in contact, with restrained bark relief."""
    v=[];f=[];sides=21;longitudinal=9
    plans=[(-.19,.00,0,.49),(.19,.00,0,.49),(0,.14,math.pi/2,.29),(0,.26,.10,.43)]
    for n,(y,z,angle,length) in enumerate(plans):
        base=len(v);ca,sa=math.cos(angle),math.sin(angle)
        for row in range(longitudinal):
            t=row/(longitudinal-1);along=(t-.5)*length*2
            end=.975 if row in (0,longitudinal-1) else 1
            for j in range(sides):
                theta=math.pi*.75+math.pi*1.5*j/(sides-1)
                r=.09*end*(1+.045*math.sin(j*3.13+n)+.018*math.sin(t*11+j))
                across=r*math.cos(theta);height=r*math.sin(theta)
                v.append((along*ca-across*sa,y+along*sa+across*ca,z+height))
        for row in range(longitudinal-1):
            for j in range(sides):
                a=base+row*sides+j;b=base+row*sides+(j+1)%sides
                f.append((a,b,b+sides,a+sides))
        f.append(tuple(base+j for j in reversed(range(sides))))
        f.append(tuple(base+(longitudinal-1)*sides+j for j in range(sides)))
    return fit(v,box),f


def canopy_mesh(points):
    if len(points)!=196:raise ValueError('Expected four source 7 by 7 sewn gores')
    v=[];f=[];radial=16;angular=16
    for start in range(0,196,49):
        old=points[start:start+49];top=old[0][2]
        radius=math.hypot(old[42][0],old[42][1]);angle=math.atan2(old[42][1],old[42][0])
        drop=top-old[42][2];edge_sag=old[42][2]-old[45][2]
        rows=[[len(v)]];v.append((0,0,top))
        for row in range(1,radial+1):
            t=row/radial;ids=[]
            for j in range(angular+1):
                u=j/angular;a=angle+u*math.pi/4
                # Keep every original rib boundary and the scalloped outer hem.
                z=top-drop*t**.7-edge_sag*math.sin(math.pi*u)*t
                z-=.028*math.sin(math.pi*u)*math.sin(math.pi*t)
                ids.append(len(v));v.append((radius*t*math.cos(a),radius*t*math.sin(a),z))
            rows.append(ids)
        f += [(rows[0][0],rows[1][j],rows[1][j+1]) for j in range(angular)]
        for a,b in zip(rows[1:],rows[2:]):f += [(a[j],b[j],b[j+1],a[j+1]) for j in range(angular)]
    return v,f


def shade_mesh(z0,z1,r0,r1,thickness,segments=96):
    if min(r0,r1)<=thickness or z1<=z0:raise ValueError('Invalid thin lampshade shell')
    v=[];f=[]
    for r,z in ((r0,z0),(r1,z1),(r1-thickness,z1),(r0-thickness,z0)):
        v += [(r*math.cos(i*math.tau/segments),r*math.sin(i*math.tau/segments),z) for i in range(segments)]
    for row in range(4):
        for i in range(segments):
            j=(i+1)%segments;a=row*segments;b=((row+1)%4)*segments
            f.append((a+i,a+j,b+j,b+i))
    return v,f


def arch_back(box,spring,segments=48):
    lo,hi=box['min'],box['max'];cx=(lo[0]+hi[0])/2;rx=(hi[0]-lo[0])/2
    line=[(lo[0],lo[2]),(hi[0],lo[2])]+[(cx+rx*math.cos(i*math.pi/segments),spring+(hi[2]-spring)*math.sin(i*math.pi/segments)) for i in range(segments+1)]
    n=len(line);v=[(x,y,z) for y in (lo[1],hi[1]) for x,z in line]
    f=[tuple(range(n)),tuple(reversed(range(n,2*n)))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return v,f


def box_mesh(lo,hi):
    v=[(x,y,z) for z in (lo[2],hi[2]) for y in (lo[1],hi[1]) for x in (lo[0],hi[0])]
    return v,[(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)]


def bar_mesh(a,b,radius,sides=12):
    delta=[b[i]-a[i] for i in range(3)];length=math.sqrt(sum(x*x for x in delta));axis=[x/length for x in delta]
    ref=(0,0,1) if abs(axis[2])<.9 else (0,1,0)
    side=[axis[1]*ref[2]-axis[2]*ref[1],axis[2]*ref[0]-axis[0]*ref[2],axis[0]*ref[1]-axis[1]*ref[0]]
    scale=math.sqrt(sum(x*x for x in side));side=[x/scale for x in side]
    up=[axis[1]*side[2]-axis[2]*side[1],axis[2]*side[0]-axis[0]*side[2],axis[0]*side[1]-axis[1]*side[0]]
    v=[tuple(p[k]+radius*(math.cos(i*math.tau/sides)*side[k]+math.sin(i*math.tau/sides)*up[k]) for k in range(3)) for p in (a,b) for i in range(sides)]
    f=[tuple(reversed(range(sides))),tuple(range(sides,sides*2))]+[(i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides)]
    return v,f


def _hash(obj):
    h=hashlib.sha256()
    for vertex in obj.data.vertices:h.update(struct.pack('<3d',*(obj.matrix_world@vertex.co)))
    for p in obj.data.polygons:h.update(struct.pack('<I',len(p.vertices)));h.update(struct.pack('<'+'I'*len(p.vertices),*p.vertices))
    return h.hexdigest()


def _checked(scene,item,keys,names,specs,source_sha):
    if item['sourceBlend']['sha256']!=source_sha:raise ValueError('Reviewed source hash changed')
    lookup={names.get(o.name,o.name):o for o in scene.objects if o.type=='MESH'};result={}
    for spec in specs:
        obj=lookup.get(spec['name'])
        if obj is None or obj.modifiers or obj.data.shape_keys or any(obj.get(k) for k in ('motion_role','shared_geometry','linked_bough')):
            raise ValueError('Missing or protected reviewed component: '+spec['name'])
        if [keys[m.name] for m in obj.data.materials]!=spec['materials'] or len(obj.data.vertices)!=spec['vertices']:
            raise ValueError('Reviewed original material/topology mismatch: '+spec['name'])
        box=bounds([obj.matrix_world@v.co for v in obj.data.vertices])
        if any(abs(box[s][a]-spec['bounds'][s][a])>2e-6 for s in ('min','max') for a in range(3)):
            raise ValueError('Reviewed source bounds mismatch: '+spec['name'])
        result[spec['name']]=obj
    return result


def _mesh(name,geometry,materials,smooth=True,bevel=0):
    import bpy
    import bmesh
    v,f=geometry;mesh=bpy.data.meshes.new(name+' editable construction');mesh.from_pydata(v,[],f);mesh.update()
    for mat in materials:mesh.materials.append(mat)
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    if bevel:
        edges=[e for e in bm.edges if e.is_manifold and e.calc_face_angle()>.5]
        bmesh.ops.bevel(bm,geom=edges,offset=bevel,segments=3,affect='EDGES',clamp_overlap=True)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free();mesh.update()
    uv=mesh.uv_layers.new(name='UVMap',do_init=False)
    for p in mesh.polygons:
        p.use_smooth=smooth and len(p.vertices)<=4
        axis=max(range(3),key=lambda a:abs(p.normal[a]));axes=[a for a in range(3) if a!=axis]
        for loop in p.loop_indices:
            point=mesh.vertices[mesh.loops[loop].vertex_index].co;uv.data[loop].uv=tuple(point[a] for a in axes)
    uv.active_render=True
    return mesh


def _replace(obj,name,geometry,overall,construction,smooth=True,bevel=0):
    from mathutils import Vector
    box=bounds(geometry[0])
    if any(box['min'][a]<overall['min'][a]-2e-6 or box['max'][a]>overall['max'][a]+2e-6 for a in range(3)):
        raise ValueError('Reviewed replacement exceeds the model envelope: '+name)
    before=_hash(obj);old=len(obj.data.vertices);mesh=_mesh(name,geometry,list(obj.data.materials),smooth,bevel)
    inverse=obj.matrix_world.inverted()
    for v in mesh.vertices:v.co=inverse@v.co
    mesh.update();obj.data=mesh
    return {'kind':'source-evidenced-construction','component':name,'construction':construction,
            'beforeGeometrySha256':before,'afterGeometrySha256':_hash(obj),'originalVertices':old,
            'candidateVertices':len(mesh.vertices),'boundsM':bounds([obj.matrix_world@v.co for v in mesh.vertices]),
            'topologyChanged':True,'preserved':['original component identity and material keys','overall model bounds','all unrelated original components']}


def _add(scene,names,name,geometry,material,overall,smooth=True,bevel=0):
    import bpy
    if name in names.values():raise ValueError('Reviewed component already exists')
    box=bounds(geometry[0])
    if any(box['min'][a]<overall['min'][a]-2e-6 or box['max'][a]>overall['max'][a]+2e-6 for a in range(3)):
        raise ValueError('New reviewed component exceeds placement envelope')
    obj=bpy.data.objects.new(name,_mesh(name,geometry,[material],smooth,bevel));scene.collection.objects.link(obj);names[obj.name]=name
    obj['catalog_realism_added_detail']=True
    return {'component':name,'candidateVertices':len(obj.data.vertices),'boundsM':bounds([v.co for v in obj.data.vertices])}


def apply(root,scene,item,keys,names,specs,source_sha):
    objects=_checked(scene,item,keys,names,specs,source_sha)
    overall=bounds([o.matrix_world@v.co for o in scene.objects if o.type=='MESH' for v in o.data.vertices])
    palette={keys[m.name]:m for o in objects.values() for m in o.data.materials}
    vessel=runpy.run_path(str(Path(__file__).with_name('vessel_geometry.py')))
    records=[];mid=item['id']
    if mid in ('patio-fire-bowl','patio-fire-table'):
        obj=objects['split_firewood'];box=bounds([obj.matrix_world@v.co for v in obj.data.vertices])
        records.append(_replace(obj,'split_firewood',firewood_mesh(box),overall,'Four thick, untapered split logs with rounded bark and seated stack layers.'))
        if mid=='patio-fire-table':
            obj=objects['stone_surround'];box=bounds([obj.matrix_world@v.co for v in obj.data.vertices])
            records.append(_replace(obj,'stone_surround',surround_mesh(box,.252),overall,'Continuous stone surround with a true circular opening exposing the original recessed bowl.',False,.002))
            for name,fn in (('double_walled_spun_bowl','fire_bowl_mesh'),('rolled_bowl_lip','rim_mesh')):
                obj=objects[name];box=bounds([obj.matrix_world@v.co for v in obj.data.vertices])
                records.append(_replace(obj,name,vessel[fn](box['min'],box['max']),overall,'Smooth spun fire pan and rolled rim exposed through the corrected surround.'))
            # The old plinth stops 94 mm below the top. These closed apron walls
            # support its outer border while leaving the recessed fire pan clear.
            added=[]
            for n,(lo,hi) in enumerate([((-.514,-.334,.385),(-.485,.334,.501)),((.485,-.334,.385),(.514,.334,.501)),
                                       ((-.485,-.334,.385),(.485,-.305,.501)),((-.485,.305,.385),(.485,.334,.501))]):
                added.append(_add(scene,names,'detail_fire_table_apron_'+str(n+1),box_mesh(lo,hi),palette['powder-coated-charcoal'],overall,False,.003))
            records.append({'kind':'source-evidenced-fire-surround-support','newComponents':added,'sourceGapM':.49204936623573303-.3976900577545166,'construction':'Apron bridges the original plinth and stone top outside the fire pan.'})
        return records
    if mid=='pet-feeding-station':
        for name in ('open_food_bowl','open_food_bowl.001'):
            obj=objects[name];box=bounds([obj.matrix_world@v.co for v in obj.data.vertices])
            records.append(_replace(obj,name,vessel['vessel_mesh'](box['min'],box['max']),overall,'Smooth spun bowl with rolled lip, closed base, original 0.75 inner radius and 0.20 floor height.'))
        return records
    if mid=='patio-parasol':
        for name in ('curved_sewn_canopy_gore','curved_sewn_canopy_gore.001'):
            obj=objects[name];points=[tuple(obj.matrix_world@v.co) for v in obj.data.vertices]
            records.append(_replace(obj,name,canopy_mesh(points),overall,'Smooth sewn gores with 28 mm interior cloth sag; original rib boundaries, outer scallops, mast and mechanism remain exact.'))
        return records
    if mid=='pizza-oven-cart':
        added=[];mat=palette['terracotta']
        box={'min':[-.29280000925064087,.250,.903], 'max':[.29280000925064087,.2720000147819519,1.2128000259399414]}
        added.append(_add(scene,names,'detail_pizza_oven_closed_rear',arch_back(box,.9199999570846558),mat,overall,False,.001))
        for n,(x0,x1) in enumerate(((-.2928,-.2328),(.2328,.2928))):
            added.append(_add(scene,names,'detail_pizza_oven_sill_'+str(n+1),box_mesh((x0,-.248,.904),(x1,.272,.923)),mat,overall,False,.001))
        return [{'kind':'source-evidenced-closed-oven-chamber','newComponents':added,
                 'sourceCause':'Original barrel vault has no rear cap; its rectangular back stops below the arch and its springline sits above the baking stone.',
                 'preserved':['original oven mouth and baking stone','original material keys and factors','whole-model dimensions','cart and flue geometry']}]
    if mid=='pleated-table-lamp':
        obj=objects['shade_core'];old=bounds([obj.matrix_world@v.co for v in obj.data.vertices])
        records.append(_replace(obj,'shade_core',shade_mesh(old['min'][2],old['max'][2],.159,.114,.0015),overall,'Open conical lampshade liner, 1.5 mm thick; both circular openings remain unobstructed.'))
        added=[];gold=palette['warm-brass'];white=palette['warm-porcelain']
        for name,lo,hi,mat,profile in [
            ('stem',[-.010,-.010,.230],[.010,.010,.359],gold,[(0,0),(1,0),(1,1),(0,1)]),
            ('socket',[-.017,-.017,.352],[.017,.017,.389],gold,[(0,0),(.82,0),(1,.2),(1,.85),(.8,1),(0,1)]),
            ('bulb',[-.028,-.028,.383],[.028,.028,.452],white,[(0,0),(.30,0),(.40,.15),(.75,.32),(1,.58),(.95,.78),(.70,.94),(0,1)])]:
            added.append(_add(scene,names,'detail_pleated_lamp_'+name,vessel['lathe'](profile,lo,hi,48),mat,overall))
        z=.356;r=.149
        for n in range(3):
            a=n*math.tau/3;end=(r*math.cos(a),r*math.sin(a),z)
            added.append(_add(scene,names,'detail_pleated_lamp_spider_'+str(n+1),bar_mesh((0,0,z),end,.002),gold,overall))
        records.append({'kind':'source-evidenced-lamp-internals','newComponents':added,'construction':'Stem connects ceramic base to socket; three spider arms support the hollow shade and the bulb is visible below.',
                        'preserved':['all original linen pleats and bound hem','existing exact material keys and factors','overall envelope','no emission changes']})
        return records
    raise ValueError('No six-model reviewed correction for this ID')
