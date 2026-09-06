"""Original brick-style Skyline R34 display study. Editable parts and GLB export."""
import bpy,math,json
from mathutils import Vector
from pathlib import Path
R=Path(__file__).resolve().parents[2]/'assets-source'/'skyline-brick-study';R.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
def mat(n,c,r=.4,metal=0):
 m=bpy.data.materials.new(n);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=r;p.inputs['Metallic'].default_value=metal;return m
silver=mat('Body - silver grey ABS',(.48,.52,.55),.34,.18);blue=mat('Livery - electric blue',(.006,.085,.40),.32);black=mat('Chassis - graphite',(.022,.026,.032),.52);rubber=mat('Tires - dark rubber',(.009,.012,.015),.85);rim=mat('Rims - satin alloy',(.56,.60,.63),.27,.65);red=mat('Rear lenses - ruby',(.55,.007,.012),.23);amber=mat('Indicators - amber',(.8,.20,.005),.26);lens=mat('Headlights - pale clear blue',(.56,.74,.85),.2);gold=mat('Axle pins - tan',(.48,.34,.12),.45)
parts=[]
def finish(o,n,m):o.name=n;o.data.materials.append(m);parts.append(o);return o
def box(n,p,d,m,bevel=.0008):
 bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.dimensions=d;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  b=o.modifiers.new('Molded edge radius','BEVEL');b.width=bevel;b.segments=2
  o.modifiers.new('Corner normals','WEIGHTED_NORMAL')
 return finish(o,n,m)
def cyl(n,p,r,depth,m,axis='Z',verts=24):
 bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=depth,location=p);o=bpy.context.object
 if axis=='Y':o.rotation_euler.x=math.pi/2
 if axis=='X':o.rotation_euler.y=math.pi/2
 for f in o.data.polygons:f.use_smooth=len(f.vertices)==4
 return finish(o,n,m)
def torus(n,p,major,minor,m,axis='Y'):
 bpy.ops.mesh.primitive_torus_add(major_segments=48,minor_segments=10,major_radius=major,minor_radius=minor,location=p);o=bpy.context.object
 if axis=='Y':o.rotation_euler.x=math.pi/2
 if axis=='X':o.rotation_euler.y=math.pi/2
 for f in o.data.polygons:f.use_smooth=True
 return finish(o,n,m)
def panel(n,vs,fs,m):
 me=bpy.data.meshes.new(n);me.from_pydata(vs,[],fs);o=bpy.data.objects.new(n,me);bpy.context.collection.objects.link(o);return finish(o,n,m)
def strut(n,a,b,width,m):
 a,b=Vector(a),Vector(b);o=box(n,(a+b)/2,(width,width,(b-a).length),m,width*.2);o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o
# Beam holes are actual through-holes, not painted circles.
def beam(n,p,length,m):
 o=box(n,p,(length,.010,.010),m,.002)
 bpy.context.view_layer.objects.active=o
 for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
 cutters=[]
 for i in range(int((length-.008)/.012)+1):
  x=p[0]-length/2+.005+i*.012
  if x>p[0]+length/2-.004:break
  c=cyl('temporary hole cutter',(x,p[1],p[2]),.003,.016,black,'Y',16);cutters.append(c);parts.remove(c)
 bpy.ops.object.select_all(action='DESELECT')
 for c in cutters:c.select_set(True)
 bpy.context.view_layer.objects.active=cutters[0];bpy.ops.object.join();c=bpy.context.object
 bpy.context.view_layer.objects.active=o;mod=o.modifiers.new('Real pin holes','BOOLEAN');mod.operation='DIFFERENCE';mod.object=c;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(c,do_unlink=True)
 return o
box('Rigid chassis',(0,0,.024),(.36,.126,.012),black)
for y in [-.055,.055]:beam('Longitudinal liftarm',(0,y,.032),.30,black)
# Wheels, tire shoulder rings, individual tread blocks, six open alloy spokes.
for x in [-.13,.13]:
 cyl('Axle',(x,0,.033),.003,.174,gold,'Y')
 for side in [-1,1]:
  y=side*.078
  for dy in [-.006,0,.006]:torus('Tire rounded shoulder',(x,y+dy,.033),.025,.007,rubber)
  for i in range(56):
   a=2*math.pi*i/56;o=box('Molded tread block',(x+.0315*math.sin(a),y,.033+.0315*math.cos(a)),(.003,.018,.0013),rubber,.0002);o.rotation_euler.y=a
  yf=y+side*.014
  torus('Alloy rim lip',(x,yf,.033),.022,.0018,rim)
  cyl('Dark brake rotor',(x,yf-side*.003,.033),.019,.0015,black,'Y',40)
  for i in range(6):
   a=2*math.pi*i/6
   strut('Six spoke wheel',(x+.004*math.sin(a),yf,.033+.004*math.cos(a)),(x+.020*math.sin(a),yf,.033+.020*math.cos(a)),.0042,rim)
  cyl('Hex axle center',(x,yf+side*.001,.033),.0045,.002,gold,'Y',6)
# Three-dimensional curved fender panels, open underneath the wheels.
for x in [-.13,.13]:
 for side in [-1,1]:
  vs=[];fs=[]
  for i in range(37):
   a=math.pi*i/36
   for y,r in [(side*.075,.035),(side*.085,.035),(side*.085,.042),(side*.075,.042)]:vs.append((x+r*math.cos(a),y,.033+r*math.sin(a)))
  for i in range(36):
   for j in range(4):k=i*4+j;fs.append((k,i*4+(j+1)%4,(i+1)*4+(j+1)%4,k+4))
  panel('Molded wheel arch',vs,fs,silver)
# Segmented hood and rear deck with visible tile joins.
for x0,x1,z,name in [(-.20,-.075,.075,'Hood'),(.092,.199,.077,'Rear deck')]:
 for i in range(4):
  x=x0+(x1-x0)*(i+.5)/4
  for j in range(4):
   y=-.059+j*.0395;box(name+' silver panel',(x,y,z),((x1-x0)/4-.001,.038,.005),silver)
  for side in [-1,1]:box(name+' blue race stripe',(x,side*.027,z+.0027),((x1-x0)/4-.001,.014,.0006),blue,.0001)
# Body side modules and diagonal blue livery patches.
for side in [-1,1]:
 y=side*.076
 box('Door lower panel',(0,y,.058),(.158,.011,.029),silver)
 box('Rocker skirt',(0,side*.084,.030),(.19,.013,.010),silver)
 for x in [-.187,.19]:box('Bumper side block',(x,y,.052),(.028,.016,.028),silver)
 for i in range(7):
  x=-.08+i*.024
  panel('Angular blue side graphic',[(x,side*.082,.044),(x+.020,side*.082,.048),(x+.031,side*.082,.065),(x+.011,side*.082,.063)],[(0,1,2,3)],blue)
  box('Blue skirt tile',(x,side*.091,.030),(.017,.0006,.005),blue,.0001)
 beam('Door shoulder liftarm',(0,side*.077,.078),.145,silver)
 box('Door handle',(.050,side*.084,.073),(.015,.003,.003),black)
 # Open side windows and separately authored structural pillars.
 strut('A pillar',(-.083,side*.070,.080),(-.029,side*.061,.120),.007,silver)
 strut('B pillar',(.055,side*.062,.119),(.068,side*.074,.080),.006,black)
 strut('C pillar',(.076,side*.061,.118),(.118,side*.073,.081),.009,silver)
 beam('Roof perforated side rail',(.024,side*.061,.121),.108,silver)
 box('Side mirror',(-.064,side*.091,.085),(.017,.014,.009),silver)
 box('Mirror glass',(-.058,side*.099,.085),(.010,.001,.006),rim)
# Roof remains partly open like the reference, exposing the cage and seats.
for x in [-.027,.022,.075]:box('Roof cross plate',(x,0,.122),(.011,.128,.004),silver)
for side in [-1,1]:
 strut('Internal roll cage',( .071,side*.049,.058),(-.014,side*.049,.115),.005,black)
 box('Blue racing seat cushion',(.021,side*.033,.042),(.039,.028,.008),blue)
 ob=box('Bucket seat back',(.045,side*.033,.067),(.009,.032,.045),black,.003);ob.rotation_euler.y=-.15
 for dy in [-.010,.010]:box('Seat bolster',(.027,side*.033+dy,.060),(.024,.006,.022),black,.002)
box('Dashboard',(-.060,0,.075),(.023,.119,.015),black,.002)
for y in [-.041,-.027,-.012]:cyl('Dashboard gauge',(-.046,y,.079),.004,.001,lens,'X',20)
strut('Steering column',(-.054,-.037,.067),(-.031,-.037,.080),.003,black)
torus('Steering wheel',(-.031,-.037,.080),.010,.0015,black,'X')
for y in [-.018,.018]:cyl('Nitrous cylinder',(.073,y,.049),.007,.035,silver,'X',24)
# Studs make individual construction visible without carpeting the whole car.
for x in [-.182,-.151,-.12,.12,.151,.182]:
 for y in [-.061,.061]:cyl('Panel connection stud',(x,y,.079),.0025,.0017,silver,verts=16)
# R34 front fascia: split grille, projector pairs and wide lower intercooler.
box('Front bumper',(-.206,0,.042),(.012,.156,.026),silver)
box('Front lower intake',(-.2125,0,.037),(.001,.078,.013),black,.0005)
for z in [.033,.036,.039,.042]:box('Intercooler horizontal fin',(-.2135,0,z),(.001,.068,.0007),rim,.0001)
box('Upper grille',(-.206,0,.065),(.010,.052,.012),black)
for side in [-1,1]:
 box('Projector headlight housing',(-.207,side*.055,.065),(.012,.044,.013),black)
 for y in [side*.044,side*.061]:cyl('Round projector lens',(-.214,y,.066),.0047,.0015,lens,'X')
 box('Front blue corner stripe',(-.213,side*.064,.046),(.001,.026,.005),blue,.0001)
box('Lower front splitter',(-.210,0,.025),(.020,.174,.003),black)
# Signature four circular rear lamps, two exhaust tips, trunk wing.
box('Rear fascia',(.204,0,.061),(.010,.151,.034),silver)
for side in [-1,1]:
 for y,r in [(side*.054,.008),(side*.034,.006)]:
  cyl('Tail lamp black surround',(.211,y,.068),r+.0015,.002,black,'X')
  cyl('Circular red tail lamp',(.213,y,.068),r,.003,red,'X',32)
  torus('Tail light concentric lens',(.215,y,.068),r*.66,.0005,red,'X')
 cyl('Amber rear indicator',(.212,side*.071,.067),.003,.002,amber,'X')
box('Rear bumper',(.210,0,.036),(.019,.162,.011),silver)
box('Rear plate recess',(.221,0,.049),(.001,.024,.010),black,.0001)
for y in [-.055,.055]:
 cyl('Exhaust dark bore',(.221,y,.026),.005,.014,black,'X')
 torus('Rolled exhaust tip',(.229,y,.026),.0047,.001, rim,'X')
 strut('Wing upright',(.152,y,.080),(.165,y,.112),.007,black)
box('Blue rear wing',(.167,0,.115),(.026,.185,.005),blue)
for side in [-1,1]:
 box('Wing endplate',(.167,side*.095,.116),(.030,.003,.014),blue)
 for x in [.159,.173]:cyl('Wing mounting stud',(x,side*.082,.119),.0025,.0015,blue,verts=16)
# Preserve all pieces in the editable source; export selected model only.
s=bpy.context.scene;s['asset_status']='Original reference-inspired brick Skyline display model; not an official construction plan';s['reference']='LEGO Technic 42210 product and user image';s.unit_settings.system='METRIC'
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(R/'skyline-gtr-brick.blend'))
bpy.ops.object.select_all(action='DESELECT')
for o in parts:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(R/'skyline-gtr-brick.glb'),export_format='GLB',use_selection=True,export_apply=True,export_animations=False)
# Soft studio comparison renders.
s.render.engine='CYCLES';s.cycles.samples=64;s.cycles.use_denoising=True;s.render.resolution_x=1400;s.render.resolution_y=1000;s.render.resolution_percentage=100
world=bpy.data.worlds.new('Studio world');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.11,.13,.16,1);world.node_tree.nodes['Background'].inputs[1].default_value=.5;s.world=world
floor=box('Review ground',(0,0,-.004), (200,200,.004),mat('Studio floor',(.055,.07,.085),.8),0)
for p,e,size in [((-1,-1,2),160,1.5),((1,1,1.7),190,1.2),((0,-2,.7),60,1)]:
 bpy.ops.object.light_add(type='AREA',location=p);o=bpy.context.object;o.data.energy=e;o.data.size=size;o.rotation_euler=(Vector((0,0,.05))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();c=bpy.context.object;s.camera=c;c.data.type='ORTHO';c.data.ortho_scale=.55
for name,pos in [('front',(-.7,-.8,.48)),('rear',(.7,-.8,.42)),('side',(0,-1,.25))]:
 c.location=pos;c.rotation_euler=(Vector((0,0,.055))-c.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=str(R/f'skyline-{name}.png');bpy.ops.render.render(write_still=True)
print('SKYLINE_ASSETS',R)
