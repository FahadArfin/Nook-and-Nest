"""Original kitchen essentials, authored through official interactive Blender MCP.

MCP: runpy.run_path(__file__)['build']('kitchen-everyday-mug')
Then render the configured scene through render_viewport_to_path; review_views()
sets the rear/underside camera. Millimetre construction is converted to metres.
Only this module's tagged scene is replaced. Other open scenes are preserved.
"""
import bpy, bmesh, json, math, struct, sys
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).parent))
from studio_geometry import B, C, mesh, tube, ring, material as new_material, text

ROWS = json.loads((ROOT / 'src/kitchenEssentialsExpansion.json').read_text())
OWNER = 'Nook kitchen essentials authoring'


def material(name,color,rough=.6,metal=0,alpha=1,emission=0):
    # Keep material IDs deterministic across repeated MCP calls and source loads.
    m=bpy.data.materials.get(name)
    if m is None or m.get('authoring_owner')!=OWNER:
        m=new_material(name,color,rough,metal,alpha,emission)
        m['authoring_owner']=OWNER
    else:
        p=m.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(*color,alpha)
        p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
        p.inputs['Alpha'].default_value=alpha;p.inputs['Emission Color'].default_value=(*color,1)
        p.inputs['Emission Strength'].default_value=emission;m.diffuse_color=(*color,alpha)
    return m


def tube(name, points, radius, mat, s=8):
    # Parallel transport prevents the radial frame flipping at vertical tangents.
    pts=[Vector(p) for p in points];verts=[];normal=None
    for i,p in enumerate(pts):
        t=(pts[min(i+1,len(pts)-1)]-pts[max(0,i-1)]).normalized()
        if normal is None:
            axis=min([Vector((1,0,0)),Vector((0,1,0)),Vector((0,0,1))],key=lambda a:abs(a.dot(t)))
            normal=t.cross(axis).normalized()
        else:normal=(normal-t*normal.dot(t)).normalized()
        side=t.cross(normal).normalized()
        verts.extend([p+radius*(normal*math.cos(j*math.tau/s)+side*math.sin(j*math.tau/s)) for j in range(s)])
    faces=[(i*s+j,i*s+(j+1)%s,(i+1)*s+(j+1)%s,(i+1)*s+j) for i in range(len(pts)-1) for j in range(s)]
    faces += [tuple(reversed(range(s))),tuple(range((len(pts)-1)*s,len(pts)*s))]
    obj=mesh(name,verts,faces,mat)
    for p in obj.data.polygons:p.use_smooth=len(p.vertices)==4
    return obj


def lathe(name, profile, mat, steps=64, center=(0, 0, 0)):
    """Closed radial cross section: outer underside -> rim -> inner floor."""
    vs = [(center[0]+r*math.cos(i*math.tau/steps),
           center[1]+r*math.sin(i*math.tau/steps), center[2]+z)
          for r, z in profile for i in range(steps)]
    fs = [(j*steps+i, j*steps+(i+1)%steps,
           ((j+1)%len(profile))*steps+(i+1)%steps,
           ((j+1)%len(profile))*steps+i)
          for j in range(len(profile)) for i in range(steps)]
    obj = mesh(name, vs, fs, mat)
    bm=bmesh.new(); bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.001)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data); bm.free()
    for p in obj.data.polygons: p.use_smooth=True
    return obj


def rounded_loop(name, w, h, radius, z, mat, thickness, y=0):
    pts=[]
    for cx,cy,start in [(w/2-radius,h/2-radius,0),(-w/2+radius,h/2-radius,90),
                         (-w/2+radius,-h/2+radius,180),(w/2-radius,-h/2+radius,270)]:
        for i in range(9):
            a=math.radians(start+i*90/8)
            pts.append((cx+radius*math.cos(a),y+cy+radius*math.sin(a),z))
    return tube(name,pts+[pts[0]],thickness,mat)


def materials():
    return {
        'sage':material('sage-enamel',(.23,.34,.26),.48),
        'blue':material('slate-blue-glaze',(.13,.27,.34),.32),
        'clay':material('terracotta-glaze',(.47,.18,.105),.4),
        'cream':material('warm-ceramic',(.79,.75,.64),.42),
        'steel':material('brushed-steel',(.47,.52,.55),.32,.78),
        'dark':material('charcoal-details',(.022,.03,.033),.64),
        'rubber':material('rubber-gaskets',(.014,.019,.018),.94),
        'wood':material('oiled-maple',(.57,.33,.14),.72),
        'wood2':material('maple-lamella',(.66,.42,.21),.72),
        'endgrain':material('end-grain',(.40,.22,.09),.8),
        'glass':material('smoked-door-glass',(.14,.23,.24),.16,0,.24),
        'red':material('hot-water-marker',(.52,.06,.035),.45),
        'light':material('cool-blue-display',(.05,.45,.72),.4,0,1,.3),
    }


def ceramic(kind,M):
    if kind=='dinner-plate':
        lathe('ceramic plate with recessed well',[(0,4),(80,4),(84,1),(90,1),(92,5),
              (114,10),(131,19),(135,22),(134,25),(129,24),(112,16),(92,9),(0,9)],M['blue'],96)
        ring('contrasting glazed rim',(0,0,23),132.5,1,M['cream'],steps=96)
    elif kind=='cereal-bowl':
        lathe('hollow cereal bowl',[(0,3),(39,3),(40,0),(46,0),(48,5),(59,14),(70,35),
              (78,63),(80,71),(79,75),(75,75),(73,69),(65,38),(53,20),(40,10),(0,10)],M['sage'])
        ring('cream rim glaze',(0,0,73),77.5,1.4,M['cream'])
    else:
        lathe('hollow mug body',[(0,3),(28,3),(29,0),(35,0),(38,6),(42,24),(46,91),
              (47.5,101),(46,105),(43,105),(42,100),(39,26),(34,10),(0,10)],M['clay'])
        tube('rounded D handle',[(43,0,82),(60,0,84),(70,0,77),(73,0,66),(72,0,39),
             (66,0,26),(56,0,23),(43,0,30)],6,M['clay'],12)
        ring('unglazed foot',(0,0,2),33,1.5,M['cream'])


def cookware(kind,M):
    pan=kind=='frying-pan'; stock=kind=='stockpot'
    r=140 if pan else 130 if stock else 100
    h=64 if pan else 213 if stock else 137
    lower=r*(.76 if pan else .93)
    lathe('hollow formed stainless vessel',[(0,5),(lower,5),(lower+3,8),(r-3,h-6),
          (r,h-2),(r-1,h),(r-4,h),(r-7,h-5),(lower-3,13),(0,13)],M['steel'])
    C('bonded base disc',(0,0,4),lower-2,8,M['dark'],s=64)
    ring('rolled upper rim',(0,0,h-1),r-2,1.8,M['steel'],steps=64)
    if stock:
        for sign in [-1,1]:
            tube('welded side loop',[(sign*123,-42,175),(sign*151,-37,186),
                 (sign*157,-25,196),(sign*157,25,196),(sign*151,37,186),(sign*123,42,175)],5,M['steel'],10)
            for y in [-42,42]: C('handle rivet',(sign*125,y,175),4,6,M['steel'],axis='X',s=16)
        lathe('removable domed lid',[(0,220),(115,214),(129,213),(130,216),(123,220),
              (90,232),(30,237),(0,237)],M['steel'])
        tube('raised lid loop',[(-35,0,235),(-32,0,251),(-24,0,256),(24,0,256),
             (32,0,251),(35,0,235)],4,M['dark'],10)
        C('steam vent',(58,-12,234),2,2,M['dark'],s=12)
    else:
        length=340 if pan else 300
        z=h-20
        for y in [-20,20]:
            tube('forged handle shoulder',[(r-8,y,z),(r+22,y*.55,z+8),(r+48,y*.35,z+15)],4,M['steel'],8)
            C('flush internal rivet',(r-7,y,z),4,4,M['steel'],axis='X',s=16)
        grip=B('heat resistant long grip',((r+length)/2,0,z+19),(length-r,29,17),M['dark'],7)
        # True opening at the handle tip, separate from the solid grip.
        bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=6,depth=30,location=(length-15,0,z+19))
        cutter=bpy.context.object
        bpy.context.view_layer.objects.active=grip
        mod=grip.modifiers.new('hanging hole','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
        bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)


def board(kind,M):
    if kind=='cutting-board':
        # Laminated board: separate lamellae and a real concave routed groove.
        parts=[]
        for i in range(9): parts.append(B('maple lamella %02d'%i,(-200+i*50,0,11),(50,300,22),M['wood' if i%3 else 'wood2'],2))
        cutter=rounded_loop('juice groove router',420,270,15,22,M['dark'],3.5)
        for obj in parts:
            bpy.context.view_layer.objects.active=obj
            mod=obj.modifiers.new('routed juice groove','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
            bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(cutter,do_unlink=True)
        for sign in [-1,1]:
            # Inset gripping recess, carved through the short edge.
            cutter=B('finger grip router',(sign*225,0,7),(11,110,10),M['dark'],4)
            for obj in parts:
                if abs(obj.location.x-sign*200)>1:continue
                bpy.context.view_layer.objects.active=obj
                mod=obj.modifiers.new('finger recess','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
                bpy.ops.object.modifier_apply(modifier=mod.name)
            bpy.data.objects.remove(cutter,do_unlink=True)
    else:
        outline=[(-120,0),(120,0),(120,294),(45,316),(28,333),(28,410),(-28,410),(-28,333),(-45,316),(-120,294)]
        count=len(outline)
        grip=mesh('continuous board and shaped handle',[(x,y,z) for y in [-10.5,10.5] for x,z in outline],
                  [tuple(range(count)),tuple(reversed(range(count,2*count)))]+[(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)],M['wood'])
        bm=bmesh.new();bm.from_mesh(grip.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(grip.data);bm.free()
        bpy.context.view_layer.objects.active=grip
        bevel=grip.modifiers.new('rounded board edges','BEVEL');bevel.width=5;bevel.segments=3
        bpy.ops.object.modifier_apply(modifier=bevel.name)
        bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=12,depth=40,location=(0,0,385),rotation=(math.pi/2,0,0))
        cut=bpy.context.object;bpy.context.view_layer.objects.active=grip
        mod=grip.modifiers.new('hanging hole','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cut
        bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cut,do_unlink=True)
        for x in [-73,48]:B('laminated wood joint',(x,-10.55,147),(1.1,.15,282),M['endgrain'],0)
        # Deliberate fixed leaning pose; does not imply functional wall attachment.
        rot=Matrix.Rotation(math.radians(-11),4,'X')
        for o in list(bpy.context.scene.objects):o.matrix_world=rot@o.matrix_world


def cabinet_shell(w,d,h,M,color):
    B('left folded side',(-w/2+8,0,h/2),(16,d,h-24),color,7)
    B('right folded side',(w/2-8,0,h/2),(16,d,h-24),color,7)
    B('rear service panel',(0,d/2-7,h/2),(w-22,14,h-24),color,5)
    B('top folded cap',(0,0,h-10),(w,d,20),color,7)
    B('structural bottom',(0,0,18),(w-12,d-12,24),M['dark'],4)
    for x in [-w*.38,w*.38]:
        for y in [-d*.35,d*.35]:C('adjustable rubber foot',(x,y,7),13,14,M['rubber'],s=16)


def vents(y,z,width,M):
    for i in range(7):B('rear ventilation louvre',(0,y,z+i*9),(width,2,3),M['dark'],1)
    for x in [-width/2,width/2]:
        C('service panel screw',(x,y,z-10),2.5,2,M['steel'],axis='Y',s=12)


def dishwasher(M):
    cabinet_shell(550,500,438,M,M['sage'])
    B('inner stainless floor',(0,0,60),(500,435,10),M['steel'],5)
    # Recessed door: four frame rails and genuine transparent inner glazing.
    for x in [-255,255]:B('door upright',(x,-247,196),(30,20,310),M['sage'],6)
    for z in [52,343]:B('door cross rail',(0,-247,z),(510,20,36),M['sage'],6)
    B('smoked viewing glass',(0,-247,197),(474,4,251),M['glass'],4)
    B('recessed controls',(0,-245,389),(513,14,60),M['dark'],5)
    B('finger pull recess',(0,-253,336),(220,5,19),M['dark'],5)
    B('handle upper lip',(0,-258,349),(226,12,8),M['steel'],3)
    for x in [-210,-175,110,145,180,215]:C('push control',(x,-254,389),7,3,M['steel'],axis='Y',s=20)
    B('status window',(-15,-254,389),(105,2,31),M['dark'],3)
    text('display digits','1:20',(-15,-256,390),19,M['light'])
    # Basket floor, top rail and individual dish-separating tines.
    rounded_loop('basket top wire',444,376,15,227,M['steel'],3)
    rounded_loop('basket bottom wire',425,354,15,101,M['steel'],3)
    for x in range(-195,196,30):
        tube('basket wire',[(x,-183,226),(x,-174,101),(x,174,101),(x,183,226)],2.2,M['steel'])
        for y in [-110,25]:tube('plate tine',[(x,y,102),(x,y+10,165)],2,M['steel'])
    for y in [-160,-80,0,80,160]:tube('cross basket wire',[(-210,y,104),(210,y,104)],2,M['steel'])
    B('spray arm',(0,0,79),(365,26,13),M['dark'],6)
    C('spray arm hub',(0,0,79),25,18,M['steel'],s=24)
    vents(251,90,185,M)
    for x in [-105,-45]:
        C('rear hose collar',(x,254,50),15,10,M['dark'],axis='Y',s=20)
        C('rear hose coupling',(x,260,50),10,10,M['steel'],axis='Y',s=16)


def dispenser(M):
    cabinet_shell(320,340,1040,M,M['steel'])
    B('lower bottle door',(0,-170,327),(291,20,605),M['sage'],10)
    B('bottle door top finger recess',(0,-182,601),(95,3,17),M['dark'],5)
    B('bay rear',(0,100,771),(290,12,278),M['dark'],8)
    for x in [-141,141]:B('bay side frame',(x,-65,770),(17,210,282),M['dark'],5)
    B('overhead controls',(0,-142,960),(293,70,146),M['dark'],9)
    B('drip tray',(0,-91,638),(274,155,18),M['dark'],6)
    for x in range(-120,121,12):B('removable drip grate',(x,-93,650),(5,136,5),M['steel'],2)
    for x,mat in [(-83,M['red']),(0,M['cream']),(83,M['light'])]:
        B('temperature button',(x,-181,967),(43,5,30),mat,7)
        C('dispensing nozzle',(x,-118,891),9,25,M['steel'],s=24)
        C('nozzle recessed outlet',(x,-118,877),5.5,1,M['dark'],s=16)
    vents(171,115,230,M)
    for z in [930,948,966]:B('upper rear vent',(0,171,z),(240,2,4),M['dark'],1)


def freezer(M):
    # Insulated walls leave a real open interior beneath the separate closed lid.
    cabinet_shell(820,546,770,M,M['cream'])
    # Remove only the cap just made by this module so the cavity is genuine.
    cap=next(o for o in bpy.context.scene.objects if o.name.startswith('top folded cap'))
    bpy.data.objects.remove(cap,do_unlink=True)
    for x in [-383,383]:B('insulated inner side',(x,0,418),(32,489,675),M['cream'],9)
    for y in [-247,247]:B('insulated inner end',(0,y,418),(770,32,675),M['cream'],9)
    B('inner floor',(0,0,96),(753,461,35),M['cream'],8)
    B('front outer panel',(0,-268,393),(800,16,724),M['cream'],9)
    rounded_loop('lid perimeter gasket',795,521,14,774,M['rubber'],5)
    lid=B('separate insulated hinged lid',(0,0,808),(820,546,66),M['cream'],12)
    lid['construction_role']='closed removable lid'
    B('front recessed lid handle',(0,-279,800),(205,12,30),M['dark'],8)
    B('lid handle lip',(0,-283,821),(211,20,12),M['cream'],5)
    for x in [-250,250]:
        B('rear hinge leaf',(x,280,766),(67,15,65),M['steel'],3)
        C('hinge barrel',(x,282,798),9,70,M['steel'],axis='X',s=20)
    B('thermostat inset',(-310,-279,111),(106,4,69),M['dark'],5)
    C('temperature dial',(-324,-284,111),20,8,M['cream'],axis='Y',s=32)
    B('dial index',(-324,-289,120),(3,2,12),M['dark'],1)
    for x in [-290,-275]:C('status indicator',(x,-283,112),3,3,M['sage'],axis='Y',s=12)
    C('drain plug',(325,-280,81),12,6,M['cream'],axis='Y',s=24)
    vents(275,90,210,M)
    # Editable lift-out wire basket is retained inside the source and export.
    rounded_loop('basket rim',300,408,12,716,M['steel'],3,y=0)
    for x in range(-140,141,28):tube('basket rung',[(x,-199,715),(x,-186,544),(x,186,544),(x,199,715)],2,M['steel'])
    for y in [-180,-90,0,90,180]:tube('basket base wire',[(-145,y,546),(145,y,546)],2,M['steel'])


def rail(M):
    C('600 mm hanging rail',(0,0,333),7,600,M['steel'],axis='X',s=24)
    for x in [-263,263]:
        C('wall fixing plate',(x,37,333),21,6,M['steel'],axis='Y',s=32)
        C('stand off',(x,19,333),9,32,M['steel'],axis='Y',s=24)
        for z in [321,345]:C('wall screw',(x,32,z),2,2,M['dark'],axis='Y',s=12)
    for x in [-215,-75,80,215]:
        tube('S hook',[(x,8,337),(x,2,349),(x,-9,347),(x,-15,337),(x,-7,321),
             (x,-3,306),(x,-10,297),(x,-20,300)],2.3,M['steel'],8)
    # Ladle cup: hollow hemisphere rotated to face the viewer.
    tube('ladle handle',[(-215,-19,303),(-215,-22,116),(-215,-39,79)],5,M['steel'])
    cup=lathe('hollow ladle cup',[(0,0),(17,3),(31,13),(36,26),(35,31),(32,31),(29,18),(16,8),(0,5)],M['steel'],48)
    cup.rotation_euler.x=math.pi/3;cup.location=(-215,-30,46)
    tube('turner neck',[(-75,-19,303),(-75,-21,112)],5,M['wood'])
    # Slotted turner head, with actual air between ribs.
    for x in [-103,-89,-75,-61,-47]:B('turner slot rib',(x,-24,67),(7,5,83),M['steel'],3)
    for z in [26,107]:B('turner head bridge',(-75,-24,z),(62,5,9),M['steel'],3)
    tube('whisk handle',[(80,-20,303),(80,-20,181)],6,M['wood'])
    for a in [0,math.pi/3,2*math.pi/3]:
        pts=[(80+math.cos(a)*r,-20+math.sin(a)*r,z) for r,z in [(0,181),(20,137),(28,77),(17,41),(0,34),(-17,41),(-28,77),(-20,137),(0,181)]]
        tube('balloon whisk wire',pts,1.4,M['steel'],6)
    tube('cup hanger',[(215,-20,303),(215,-23,245)],3,M['steel'])
    lathe('hanging utensil cup',[(0,126),(31,126),(35,130),(38,237),(36,241),(32,240),(29,134),(0,134)],M['sage'],48,center=(215,-25,0))


def own_scene():
    existing=next((s for s in bpy.data.scenes if s.get('authoring_owner')==OWNER),None)
    if existing:
        # Owned scene only: users and other tasks keep their scene/data untouched.
        bpy.context.window.scene=existing
        for o in list(existing.objects):
            data=o.data;bpy.data.objects.remove(o,do_unlink=True)
            if data and data.users==0 and isinstance(data,bpy.types.Mesh):bpy.data.meshes.remove(data)
        for me in list(bpy.data.meshes):
            if me.users==0 and me.materials and all(m and m.get('authoring_owner')==OWNER for m in me.materials):
                bpy.data.meshes.remove(me)
        for m in list(bpy.data.materials):
            if m.get('authoring_owner')==OWNER and m.users==0:bpy.data.materials.remove(m)
        return existing
    s=bpy.data.scenes.new('Kitchen essentials');s['authoring_owner']=OWNER
    bpy.context.window.scene=s
    return s


def setup_render(row):
    s=bpy.context.scene;w,d,h=[v/1000 for v in row[3:6]];size=max(w,d,h)
    s.render.engine='CYCLES';s.cycles.samples=32;s.cycles.use_denoising=True
    s.render.resolution_x=640;s.render.resolution_y=640;s.render.resolution_percentage=100
    s.render.image_settings.file_format='PNG';s.render.film_transparent=False
    s.world=bpy.data.worlds.new('Kitchen studio world');s.world.use_nodes=True
    s.world.node_tree.nodes['Background'].inputs[0].default_value=(.22,.25,.28,1)
    s.world.node_tree.nodes['Background'].inputs[1].default_value=.55
    s.view_settings.view_transform='AgX'
    ground=material('review-ground',(.20,.22,.21),.95)
    ground['authoring_owner']=OWNER
    B('review ground',(0,0,-.012),(size*200,size*200,.02),ground,0)
    for name,pos,power,area in [('Key',(-2,-3,4),500,3),('Fill',(3,-1,2),220,3),('Rim',(0,3,3),400,2)]:
        data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=area
        o=bpy.data.objects.new(name,data);s.collection.objects.link(o);o.location=pos
        o.rotation_euler=(Vector((0,0,h/2))-o.location).to_track_quat('-Z','Y').to_euler()
    data=bpy.data.cameras.new('Review camera');o=bpy.data.objects.new('Review camera',data);s.collection.objects.link(o);s.camera=o
    data.type='ORTHO';data.ortho_scale=size*1.58;data.clip_start=.001;data.clip_end=100
    set_view('front')


def set_view(view='front'):
    s=bpy.context.scene;w,d,h=s['nominal_dimensions_m'];size=max(w,d,h)
    target=Vector((0,0,h*.43))
    direction=Vector((1.3,-1.8,1.35) if view=='front' else (-1.5,1.8,1.25) if view=='rear' else (1,-1,-.65))
    s.camera.location=target+direction*size*2
    s.camera.rotation_euler=(target-s.camera.location).to_track_quat('-Z','Y').to_euler()
    floor=next((o for o in s.objects if o.name.startswith('review ground')),None)
    if floor:floor.hide_render=view=='underside'
    return {'view':view,'id':s['catalog_id']}


def build(catalog_id):
    row=next(r for r in ROWS if r[0]==catalog_id);s=own_scene();M=materials()
    for m in M.values():m['authoring_owner']=OWNER
    kind=catalog_id.removeprefix('kitchen-')
    if kind in ['dinner-plate','cereal-bowl','everyday-mug']:ceramic(kind,M)
    elif kind in ['saucepan','stockpot','frying-pan']:cookware(kind,M)
    elif kind in ['cutting-board','handled-board']:board(kind,M)
    else:{'counter-dishwasher':dishwasher,'water-dispenser':dispenser,'chest-freezer':freezer,'utensil-rail':rail}[kind](M)
    objects=[o for o in s.objects if o.type=='MESH'];bpy.context.view_layer.update()
    points=[o.matrix_world@v.co for o in objects for v in o.data.vertices]
    lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)])
    center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z));scale=Vector([row[3+i]/(hi[i]-lo[i])/1000 for i in range(3)])
    for o in objects:
        transform=o.matrix_world.copy()
        for v in o.data.vertices:
            p=transform@v.co-center;v.co=Vector([p[i]*scale[i] for i in range(3)])
        o.matrix_world.identity();o['catalog_id']=catalog_id
        # Pack a stable UV layer for future editable materials; no external images.
        if not o.data.uv_layers:o.data.uv_layers.new(name='UVMap')
        for polygon in o.data.polygons:
            axis=max(range(3),key=lambda i:abs(polygon.normal[i]));axes=[i for i in range(3) if i!=axis]
            for li in polygon.loop_indices:
                v=o.data.vertices[o.data.loops[li].vertex_index].co
                o.data.uv_layers.active.data[li].uv=(v[axes[0]],v[axes[1]])
    s.unit_settings.system='METRIC';s['catalog_id']=catalog_id
    s['nominal_dimensions_m']=[v/1000 for v in row[3:6]]
    s['construction']='Original individually editable kitchen essentials; fixed display poses'
    blend=ROOT/'assets-source/blender'/f'{catalog_id}.blend'
    # Save only the owned model scene and its dependencies, preserving startup Scene.
    bpy.data.libraries.write(str(blend),{s},fake_user=True,compress=True)
    triangles=sum(len(p.vertices)-2 for o in objects for p in o.data.polygons)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
    bpy.context.object.name=catalog_id+' authored assembly'
    out=ROOT/'public/models/furniture'/f'{catalog_id}.glb'
    bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,use_active_scene=True,export_extras=True,export_yup=True,export_apply=True)
    statfile=ROOT/'assets-source/kitchen-essentials-audit.json'
    stats=json.loads(statfile.read_text()) if statfile.exists() else {}
    glb=out.read_bytes();document=json.loads(glb[20:20+struct.unpack_from('<I',glb,12)[0]])
    stats[catalog_id]={'dimensionsMm':row[3:6],'triangles':triangles,'editableParts':len(objects),'glbBytes':len(glb),'materials':len(document['materials']),'textures':0}
    statfile.write_text(json.dumps(stats,indent=2)+'\n')
    setup_render(row)
    return stats[catalog_id]
