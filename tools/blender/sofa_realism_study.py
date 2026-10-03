"""An original, measured oak-frame sofa study with physically shaped upholstery.

This is a design interpretation of exposed-frame Danish sofas, not a replica.
All coordinates are metres; X is width, -Y is the front, and Z is up.  The
catalog envelope is 2.000 x 0.850 x 0.780 m with a floor-centred origin.  Build
creates isolated scenes and never deletes or changes any existing datablock.

Usage from Blender: runtime = build(repository_root, materials=optional_dict).
The returned master/browser scenes are independent. The master retains named
cover shape keys and editable sewn-welt curves. Browser meshes retain actual
folds, crown and boxing; fine textile relief belongs to tiled PBR maps.
"""

import hashlib
import math
from pathlib import Path
import uuid

import bpy
from mathutils import Matrix, Vector

WOOD = 'wood-honey-textured'
FABRIC = 'upholstery-textured'
THREAD = 'tailored-tone-on-tone-stitch'
BRASS = 'joinery-aged-brass'
RUNTIME_KEY = 'nook.sofa.realism.study'


def _board_uv_cut(name,uv_faces):
    """Pick a repeatable individual board cut without rotating its grain.

    Authoring UVs remain metres. The scan covers 1.83 m; short members fit
    inside its central 10-90% region rather than all sampling the wrapped
    centre/border stripe. Long rails retain physical scale and tile naturally.
    Name hashes use the unsuffixed construction name, so both mesh densities
    and every build choose the same cut; Python's random hash is never used.
    """
    digest=hashlib.sha256(name.encode('utf-8')).digest()
    phases=(int.from_bytes(digest[:4],'big')/0xffffffff,
            int.from_bytes(digest[4:8],'big')/0xffffffff)
    flat=[co for face in uv_faces for co in face]
    minimum=[min(co[axis] for co in flat) for axis in (0,1)]
    maximum=[max(co[axis] for co in flat) for axis in (0,1)]
    low,high=1.83*.10,1.83*.90
    offsets=[]
    for axis,phase in enumerate(phases):
        extent=maximum[axis]-minimum[axis]
        if extent<=high-low:
            start=low+phase*(high-low-extent)
        else:
            # A rail can be longer than the photographed board tile; never
            # shrink its grain to force it into the atlas.
            start=low+phase*(1.83*.60)
        offsets.append(start-minimum[axis])
    return [[(u+offsets[0],v+offsets[1]) for u,v in face] for face in uv_faces],offsets


def _material(key, rgba, roughness):
    material = bpy.data.materials.new('Realism study ' + key)
    material.use_nodes = True
    material['material_key'] = key
    material.diffuse_color = rgba
    node = material.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value = rgba
    node.inputs['Roughness'].default_value = roughness
    node.inputs['Metallic'].default_value = .55 if key == BRASS else 0
    if 'Sheen Weight' in node.inputs:
        node.inputs['Sheen Weight'].default_value = 0
    return material


def _mesh(scene, name, vertices, faces, material, uv_faces=None):
    data = bpy.data.meshes.new(name + ' editable mesh')
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    data.materials.append(material)
    obj['material_key'] = material['material_key']
    obj['uv_units'] = 'metres'
    layer = data.uv_layers.new(name='UVMap')
    if uv_faces:
        for polygon, coords in zip(data.polygons, uv_faces):
            for loop, co in zip(polygon.loop_indices, coords):
                layer.data[loop].uv = co
    for polygon in data.polygons:
        polygon.use_smooth = True
    return obj


def _rounded_perimeter(width, depth, radius, steps):
    """A continuous rounded rectangle, starting at its front-right corner."""
    # Four equal straight-side sample groups plus rounded corners.  Explicit
    # edge/corner samples avoid the stretched poles of a superellipsoid.
    hx, hy = width / 2, depth / 2
    radius = min(radius, hx * .8, hy * .8)
    points = []
    corners = ((hx-radius, -hy+radius, -90),
               (hx-radius, hy-radius, 0),
               (-hx+radius, hy-radius, 90),
               (-hx+radius, -hy+radius, 180))
    straight_steps, arc_steps = steps // 4, max(4, steps // 8)
    for index, (cx, cy, angle) in enumerate(corners):
        for step in range(arc_steps):
            a = math.radians(angle + 90 * step / arc_steps)
            points.append((cx + radius * math.cos(a), cy + radius * math.sin(a)))
        a = math.radians(angle + 90)
        p = (cx + radius * math.cos(a), cy + radius * math.sin(a))
        nx, ny, na = corners[(index + 1) % 4]
        q = (nx + radius * math.cos(math.radians(na)),
             ny + radius * math.sin(math.radians(na)))
        for step in range(straight_steps):
            t = step / straight_steps
            points.append((p[0] * (1-t) + q[0] * t, p[1] * (1-t) + q[1] * t))
    return points


def _cover_position(x, y, width, depth, thickness, ring, side, index, sculpt):
    """Sewn cover with a broad crown, restrained corner pulls and boxed edge."""
    hx, hy = width/2, depth/2
    edge = max(abs(x)/hx, abs(y)/hy)
    if side == 'top':
        # Broad, almost flat sitting area. The final 60 mm roll into the seam.
        # Smooth separable panels avoid the diagonal normal crease caused by
        # using max(abs(x), abs(y)) as a square-shaped dome profile.
        panel=(1-(x/hx)**6)*(1-(y/hy)**6)
        soft=(1-(x/hx)**4)*(1-(y/hy)**4)
        crown=soft*(.014 if index<3 else (.023,.020,.024)[index-3])
        z=thickness*(.30+.20*panel)+crown
        if index>=3:
            # A sewn back pillow has a broad lumbar belly, not a rigid panel.
            z+=.009*math.exp(-((y+depth*.14)/.12)**2)*(1-(x/hx)**4)*(1-(y/hy)**6)
        if sculpt:
            # Two diagonal tension valleys at each sewn corner. Their 2-6 mm
            # depth is local: the cushion never becomes a uniformly noisy blob.
            for sx, sy in ((-1,-1), (1,-1), (-1,1), (1,1)):
                a, b = hx - sx*x, hy - sy*y
                reach = math.exp(-((a+b)/.155)**2)
                groove = math.exp(-((a-.70*b-.016)/.012)**2)
                neighbour = math.exp(-((a-.70*b+.020)/.017)**2)
                z += reach * (-.0062*groove + .0020*neighbour)
            z -= .0022 * math.exp(-((x-width*.08)/.16)**2 - ((y+depth*.10)/.15)**2)
            z += .0014 * math.sin(x*8 + index*.8) * math.sin(y*9+.5) * (1-edge**3)
            # A few shallow, directional tucks emerge from the lower/front
            # seam. Position and angle vary per cushion, so the row is not a
            # row of identically moulded pads. No noise is added to broad faces.
            distance=y+hy
            for number,anchor in enumerate((-.37,.11,.36)):
                shifted=width*(anchor+.018*math.sin(index*1.9+number))
                line=x-shifted-(.12 if number%2 else -.18)*distance
                reach=math.exp(-(distance/(.078 if index<3 else .105))**2)
                valley=math.exp(-(line/.013)**2)
                shoulder=math.exp(-((line-.020)/.019)**2)
                depth_m=(.0040 if index<3 else .0048)*(1 if number!=1 else .60)
                z+=reach*(-depth_m*valley+.0013*shoulder)
            if index<3:
                # A lightly settled sitting area keeps the front roll plump.
                z-=.0030*math.exp(-((x+.018*math.sin(index))/.19)**2-((y+.015)/.17)**2)
    elif side == 'bottom':
        # A genuinely flat support-contact patch, then a small turned-under hem.
        z = -thickness * (.50 - .18*edge**8)
    else:
        z = thickness * ring
        if sculpt:
            x += .0011*math.sin(y*24+index)*math.sin((ring+.34)*math.pi/.68)
            y += .0010*math.sin(x*23+index*.7)*math.sin((ring+.34)*math.pi/.68)
            front=math.exp(-((y+hy)/.030)**2)
            vertical=math.sin((ring+.32)*math.pi/.62)
            for number,anchor in enumerate((-.37,.11,.36)):
                shifted=width*(anchor+.018*math.sin(index*1.9+number))
                y+=front*.0032*math.exp(-((x-shifted)/.016)**2)*vertical
    return (x, y, z)


def _cushion(scene, name, dimensions, matrix, material, index, master):
    width, depth, thickness = dimensions
    outline = _rounded_perimeter(width, depth, .052 if index<3 else .058,
                                 80 if master else 64)
    count = len(outline)
    radial = 20 if master else 15
    vertices, shaped, faces, uv_faces = [], [], [], []

    def add(x, y, ring, side):
        vertices.append(_cover_position(x,y,width,depth,thickness,ring,side,index,False))
        shaped.append(_cover_position(x,y,width,depth,thickness,ring,side,index,True))
        return len(vertices)-1

    def face(ids, uvs):
        faces.append(ids); uv_faces.append(uvs)

    top_rings, bottom_rings = [], []
    for side, rings in (('top',top_rings), ('bottom',bottom_rings)):
        for step in range(1, radial+1):
            scale = step/radial
            rings.append([add(x*scale,y*scale,0,side) for x,y in outline])
        centre = add(0,0,0,side)
        for j in range(count):
            q=(j+1)%count
            ids=[centre,rings[0][j],rings[0][q]]
            if side=='bottom':ids.reverse()
            face(ids,[(vertices[v][0],vertices[v][1]) for v in ids])
        for inner,outer in zip(rings[:-1],rings[1:]):
            for j in range(count):
                q=(j+1)%count
                ids=[inner[j],outer[j],outer[q],inner[q]]
                if side=='bottom':ids.reverse()
                face(ids,[(vertices[v][0],vertices[v][1]) for v in ids])
    # Five vertical rings form the separate boxing panel; there is a gently
    # inflated belly between the two actual sewn seams.
    side_rings=[bottom_rings[-1]]
    for step in range(1,5):
        t=step/5
        swell=1 + .007*math.sin(t*math.pi)
        side_rings.append([add(x*swell,y*swell,-.32+.62*t,'side') for x,y in outline])
    side_rings.append(top_rings[-1])
    distances=[0.0]
    for j in range(1,count+1):
        a,b=outline[j-1],outline[j%count]
        distances.append(distances[-1]+math.hypot(a[0]-b[0],a[1]-b[1]))
    for lower,upper in zip(side_rings[:-1],side_rings[1:]):
        for j in range(count):
            q=(j+1)%count
            ids=[lower[j],lower[q],upper[q],upper[j]]
            face(ids,[(distances[j],vertices[lower[j]][2]),
                      (distances[j+1],vertices[lower[q]][2]),
                      (distances[j+1],vertices[upper[q]][2]),
                      (distances[j],vertices[upper[j]][2])])
    obj=_mesh(scene,name,vertices if master else shaped,faces,material,uv_faces)
    obj.matrix_world=matrix
    obj['construction']='Crowned face panels, sewn boxing, compressed corner seams'
    if master:
        obj.shape_key_add(name='Unloaded sewn cover')
        key=obj.shape_key_add(name='Foam compression and corner tension')
        for point,co in zip(key.data,shaped):point.co=co
        key.value=1
    return obj, outline


def _welt(scene,name,outline,dimensions,matrix,material,master,index,upper=True):
    width,depth,thickness=dimensions
    path=[Vector(_cover_position(x,y,width,depth,thickness,0,
                                 'top' if upper else 'bottom',index,True))
          for x,y in outline]
    if not master:
        # Explicit tubes avoid relying on a depsgraph from the user's current
        # scene. The new browser scene need never be made active during build.
        vertices=[];faces=[];uv_faces=[];count=len(outline);sides=6
        distance=0.;distances=[]
        for j,centre in enumerate(path):
            if j:distance+=(path[j-1]-centre).length
            distances.append(distance)
            previous=path[(j-1)%count]
            following=path[(j+1)%count]
            tangent=(following-previous).normalized()
            outward=Vector((tangent.y,-tangent.x,0)).normalized()
            up=tangent.cross(outward).normalized()
            for k in range(sides):
                angle=k*math.tau/sides
                vertices.append(centre+.00175*(outward*math.cos(angle)+up*math.sin(angle)))
        perimeter=distance+(path[-1]-path[0]).length
        for j in range(count):
            for k in range(sides):
                q=(j+1)%count;r=(k+1)%sides
                ids=[j*sides+k,q*sides+k,q*sides+r,j*sides+r]
                faces.append(ids)
                v0=distances[j];v1=distances[q] if q else perimeter
                uv_faces.append([(k*.00175*math.tau/sides,v0),(k*.00175*math.tau/sides,v1),
                                 ((k+1)*.00175*math.tau/sides,v1),((k+1)*.00175*math.tau/sides,v0)])
        obj=_mesh(scene,name,vertices,faces,material,uv_faces)
        obj.matrix_world=matrix
        return obj
    curve=bpy.data.curves.new(name+' editable seam','CURVE')
    curve.dimensions='3D';curve.resolution_u=1
    curve.bevel_depth=.00175;curve.bevel_resolution=1
    spline=curve.splines.new('POLY');spline.points.add(len(outline)-1)
    for point,co in zip(spline.points,path):
        point.co=(*co,1)
    spline.use_cyclic_u=True
    obj=bpy.data.objects.new(name,curve);scene.collection.objects.link(obj)
    curve.materials.append(material);obj.matrix_world=matrix
    obj['material_key']=material['material_key'];obj['uv_units']='metres'
    return obj


def _beam(scene,name,start,end,width,depth,material,top_scale=1,bottom_scale=1,radius=.006):
    start,end=Vector(start),Vector(end);direction=end-start;length=direction.length
    outline=_rounded_perimeter(width,depth,radius,16)
    count=len(outline);vertices=[];faces=[];uv_faces=[]
    rings=((0,bottom_scale),(.006,bottom_scale),
           (max(.006,length-.006),top_scale),(length,top_scale))
    for z,scale in rings:
        vertices += [(x*scale,y*scale,z) for x,y in outline]
    for level in range(len(rings)-1):
        for j in range(count):
            q=(j+1)%count
            ids=[level*count+j,level*count+q,(level+1)*count+q,(level+1)*count+j]
            faces.append(ids)
            # Cross-section direction is U, grain runs along V.
            a,b=outline[j],outline[q]
            across=0 if abs(a[1]-b[1])<abs(a[0]-b[0]) else 1
            uv_faces.append([(vertices[v][across],vertices[v][2]) for v in ids])
    for level,reverse in ((0,True),(len(rings)-1,False)):
        centre=len(vertices);vertices.append((0,0,rings[level][0]))
        for j in range(count):
            ids=[centre,level*count+j,level*count+(j+1)%count]
            if reverse:ids.reverse()
            faces.append(ids);uv_faces.append([(vertices[v][0],vertices[v][1]) for v in ids])
    if material['material_key']==WOOD:
        uv_faces,uv_offset=_board_uv_cut(name,uv_faces)
    else:uv_offset=None
    obj=_mesh(scene,name,vertices,faces,material,uv_faces)
    obj.matrix_world=Matrix.Translation(start) @ direction.to_track_quat('Z','Y').to_matrix().to_4x4()
    obj['grain_axis']='V';obj['construction']='Solid oak rounded arrises and face-grain UV'
    if uv_offset:obj['wood_uv_offset_m']=uv_offset
    # Caps retain sharp shoulder normals while longitudinal arrises are smooth.
    for polygon in obj.data.polygons[(len(rings)-1)*count:]:polygon.use_smooth=False
    return obj


def _arm(scene,name,side,material):
    # A palm-shaped arm with a softly flared, rounded nose and a narrower heel.
    outline=_rounded_perimeter(.090,.813,.037,32)
    vertices=[];faces=[];uv_faces=[];count=len(outline)
    perimeter=[0.]
    for j in range(count):
        perimeter.append(perimeter[-1]+math.dist(outline[j],outline[(j+1)%count]))
    for z,scale in ((-.022,.88),(-.018,1),(.015,1),(.022,.88)):
        for x,y in outline:
            waist=1-.15*math.exp(-((y-.08)/.21)**2)
            vertices.append((x*scale*waist,y,z))
    for level in range(3):
        for j in range(count):
            ids=[level*count+j,level*count+(j+1)%count,(level+1)*count+(j+1)%count,(level+1)*count+j]
            faces.append(ids)
            # The rolled edge is a separate physical strip. Planar XY on its
            # vertical middle band collapses two rows onto identical UVs. Use
            # thickness across U and distance around the perimeter along V:
            # grain follows each long side and wraps continuously over the
            # rounded nose. Top and underside retain their face-grain XY UVs.
            uv_faces.append([(vertices[ids[0]][2],perimeter[j]),
                             (vertices[ids[1]][2],perimeter[j+1]),
                             (vertices[ids[2]][2],perimeter[j+1]),
                             (vertices[ids[3]][2],perimeter[j])])
    for level,reverse in ((0,True),(3,False)):
        centre=len(vertices);vertices.append((0,0,(-.023 if level==0 else .024)))
        for j in range(count):
            ids=[centre,level*count+j,level*count+(j+1)%count]
            if reverse:ids.reverse()
            faces.append(ids);uv_faces.append([(vertices[v][0],vertices[v][1]) for v in ids])
    uv_faces,uv_offset=_board_uv_cut(name,uv_faces)
    obj=_mesh(scene,name,vertices,faces,material,uv_faces)
    obj.location=(side*.9495,-.0185,.557)
    obj['grain_axis']='V';obj['construction']='Sculpted oak palm rest with rolled arrises'
    obj['wood_uv_offset_m']=uv_offset
    return obj


def _plug(scene,name,location,normal,material,radius=.007):
    normal=Vector(normal);matrix=Matrix.Translation(Vector(location)) @ normal.to_track_quat('Z','Y').to_matrix().to_4x4()
    n=16;vertices=[(0,0,.0012)];vertices += [(radius*math.cos(i*math.tau/n),radius*math.sin(i*math.tau/n),0) for i in range(n)]
    faces=[(0,1+i,1+(i+1)%n) for i in range(n)]
    uv_faces,uv_offset=_board_uv_cut(name,[[vertices[v][:2] for v in f] for f in faces])
    obj=_mesh(scene,name,vertices,faces,material,uv_faces);obj.matrix_world=matrix
    obj['wood_uv_offset_m']=uv_offset
    return obj


def _family(scene,materials,master):
    parts=[];wood=materials[WOOD];fabric=materials[FABRIC];thread=materials[THREAD]
    for side in (-1,1):
        word='Left' if side<0 else 'Right'
        parts.append(_beam(scene,word+' front splayed tapered leg',(side*.953,-.379,.018),(side*.903,-.306,.535),.048,.052,wood,bottom_scale=.74))
        parts.append(_beam(scene,word+' rear splayed tapered leg',(side*.949,.380,.018),(side*.906,.289,.550),.047,.052,wood,bottom_scale=.77))
        # The feet include a very small brass glide to make floor contact exact.
        for y in (-.379,.380):
            parts.append(_beam(scene,word+' recessed foot glide '+str(y),(side*(.953 if y<0 else .949),y,0),(side*(.953 if y<0 else .949),y,.020),.027,.030,materials[BRASS],radius=.004))
        parts.append(_arm(scene,word+' sculpted oak arm',side,wood))
        parts.append(_beam(scene,word+' side apron',(side*.907,-.337,.278),(side*.907,.329,.278),.055,.057,wood))
        parts.append(_beam(scene,word+' back rising stile',(side*.904,.327,.303),(side*.904,.391,.708),.039,.043,wood,top_scale=.91))
        for y in (-.310,.286):
            parts.append(_plug(scene,word+' visible pegged arm joint '+str(y),(side*.950,y,.560),(side,0,0),wood))
    parts.append(_beam(scene,'Front deep shouldered seat rail',(-.925,-.336,.276),(.925,-.336,.276),.060,.060,wood))
    parts.append(_beam(scene,'Rear lower seat rail',(-.925,.321,.278),(.925,.321,.278),.054,.059,wood))
    parts.append(_beam(scene,'Crowned upper back rail',(-.923,.396,.696),(.923,.396,.696),.043,.052,wood))
    parts.append(_beam(scene,'Lower back rail',(-.913,.339,.375),(.913,.339,.375),.036,.042,wood))
    for index in range(17):
        x=-.837+index*(1.674/16)
        parts.append(_beam(scene,f'Individual back spindle {index+1:02d}',(x,.340,.380),(x,.391,.680),.026,.023,wood,radius=.0035))
    # Slats finish behind the front apron, making their end grain invisible from
    # the hero view. Cushion support is at 303 mm, exactly the foam bottom.
    for index in range(12):
        x=-.826+index*(1.652/11)
        parts.append(_beam(scene,f'Recessed seat support slat {index+1:02d}',(x,-.317,.292),(x,.310,.292),.067,.022,wood,radius=.003))
    for index in range(3):
        x=(index-1)*.601
        dimensions=(.592,.558,.138)
        matrix=Matrix.Translation((x, -.076+(index-1)*.0015,.372)) @ Matrix.Rotation(math.radians((index-1)*.25),4,'Z')
        obj,outline=_cushion(scene,f'Seat {index+1} tailored boxed cushion',dimensions,matrix,fabric,index,master)
        parts.append(obj)
        for upper in (True,False):parts.append(_welt(scene,f'Seat {index+1} '+('upper' if upper else 'lower')+' sewn welt',outline,dimensions,matrix,thread,master,index,upper))
        # Back pillows lean 12 degrees behind vertical. A 2 mm handed variation
        # is visible only as a relaxed seam line, not as a crooked assembly.
        dimensions=(.592,.363,.147)
        matrix=Matrix.Translation((x+(index-1)*.001,.267+(index%2)*.0025,.584+(index%2)*.0015)) @ Matrix.Rotation(math.radians((77.4,78.5,77.8)[index]),4,'X')
        obj,outline=_cushion(scene,f'Back {index+1} inclined tailored cushion',dimensions,matrix,fabric,index+3,master)
        parts.append(obj)
        for upper in (True,False):parts.append(_welt(scene,f'Back {index+1} '+('front' if upper else 'rear')+' sewn welt',outline,dimensions,matrix,thread,master,index+3,upper))
    return parts


def _bounds(parts,scene):
    """Measure evaluated shape keys/curve bevels in this exact isolated scene."""
    points=[]
    layer=scene.view_layers[0]
    window=bpy.context.window
    old_scene=window.scene if window else None
    old_layer=window.view_layer if window else None
    try:
        # In an interactive MCP call Blender may keep the original window's
        # evaluated graph despite a scene-only context override. Select the
        # owned scene explicitly, and restore the user's exact scene/layer.
        if window:
            window.scene=scene
            window.view_layer=layer
        layer.update()
        graph=bpy.context.evaluated_depsgraph_get()
        for obj in parts:
            evaluated=obj.evaluated_get(graph)
            mesh=evaluated.to_mesh()
            try:points.extend(evaluated.matrix_world@v.co for v in mesh.vertices)
            finally:evaluated.to_mesh_clear()
    finally:
        if window:
            window.scene=old_scene
            window.view_layer=old_layer
    lo=Vector([min(p[i] for p in points) for i in range(3)])
    hi=Vector([max(p[i] for p in points) for i in range(3)])
    return lo,hi


def scale_uv(parts,fabric_repeat_m=(.270079,.275700),wood_repeat_m=(1.83,1.83)):
    """Optional metre-to-tile conversion. Do not use with Mapping-node scale.

    Defaults are the measured native scan extents, not an invented wood scale.
    The paired sofa_realism_materials helper already applies these in Mapping
    nodes, so that workflow intentionally leaves this function unused.
    """
    for obj in parts:
        if obj.type!='MESH' or not obj.data.uv_layers:continue
        if obj.get('uv_units')!='metres':raise ValueError('UV coordinates already scaled: '+obj.name)
        key=obj['material_key']
        repeat=wood_repeat_m if key==WOOD else fabric_repeat_m
        su,sv=(repeat,repeat) if isinstance(repeat,(int,float)) else repeat
        for uv in obj.data.uv_layers.active.data:uv.uv=(uv.uv.x/su,uv.uv.y/sv)
        obj['uv_units']='texture tiles'


def build(root_path,materials=None):
    """Build two independent, editable scenes; leave any existing scene intact."""
    root=Path(root_path).resolve()
    if not (root/'package.json').is_file():raise ValueError('Expected repository root')
    tag=uuid.uuid4().hex[:8]
    if materials is None:
        materials={WOOD:_material(WOOD,(.37,.21,.096,1),.48),
                   FABRIC:_material(FABRIC,(.105,.145,.081,1),.86),
                   THREAD:_material(THREAD,(.090,.122,.065,1),.88),
                   BRASS:_material(BRASS,(.21,.14,.062,1),.48)}
    if set(materials)!=set((WOOD,FABRIC,THREAD,BRASS)):raise ValueError('Expected exactly the four canonical materials')
    scenes=[];families=[];normalization=[]
    for is_master in (True,False):
        scene=bpy.data.scenes.new(('Sofa realism editable master ' if is_master else 'Sofa realism browser ')+tag)
        scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
        parts=_family(scene,materials,is_master)
        lo,hi=_bounds(parts,scene);size=hi-lo
        factors=Vector((2/size.x,.85/size.y,.78/size.z))
        centre=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
        # Parent scale preserves a true affine normalization for rotated parts.
        # Assigning a non-uniformly scaled world matrix to a tilted cushion
        # would decompose its shear and drift the requested millimetre envelope.
        parent=bpy.data.objects.new('Measured envelope '+tag+(' master' if is_master else ' browser'),None)
        scene.collection.objects.link(parent)
        parent['realism_study_owner']=tag
        parent.location=(-centre.x*factors.x,-centre.y*factors.y,-centre.z*factors.z)
        parent.scale=factors
        for obj in parts:
            transform=obj.matrix_world.copy()
            obj.parent=parent
            obj.matrix_parent_inverse=Matrix.Identity(4)
            obj.matrix_basis=transform
            obj['realism_study_owner']=tag
        measured_lo,measured_hi=_bounds(parts,scene)
        measured_size=measured_hi-measured_lo
        if any(abs(measured_size[i]-target)>1e-5 for i,target in enumerate((2,.85,.78))):
            raise ValueError('Evaluated normalization failed: '+str({
                'scene':scene.name,'beforeLo':list(lo),'beforeHi':list(hi),
                'scale':list(factors),'afterLo':list(measured_lo),
                'afterHi':list(measured_hi),'afterSize':list(measured_size)}))
        scene['catalog_id']='slat-day-sofa';scene['dimensions_m']=[2,.85,.78]
        scene['design_note']='Original measured interpretation; CH293 construction research, not a manufacturer replica'
        scene['source_material_keys']=[WOOD,FABRIC,THREAD,BRASS]
        scenes.append(scene);families.append(parts);normalization.append(list(factors))
    runtime={'owner':tag,'root':str(root),'masterScene':scenes[0],
             'browserScene':scenes[1],'masterParts':families[0],
             'browserParts':families[1],'materials':materials,
             'normalization':normalization,'catalogId':'slat-day-sofa',
             'dimensionsM':[2,.85,.78],
             'sourceNotes':['Three crowned seat cushions and three separately inclined back pillows',
                            'Real corner-tension displacement, boxed covers and separate sewn welts',
                            'Palm-shaped arm rests, tapered splayed legs, pegged joinery and recessed support slats']}
    bpy.app.driver_namespace[RUNTIME_KEY]=runtime
    return runtime
