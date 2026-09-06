"""Original editable scenery expansion. Run with Blender --background --python.
Coordinates are Blender XY ground/Z up; preserve central 30m editing envelope.
"""
import bpy, math, random
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
rng=random.Random(138)
meshdata={};materials={}
def mat(name,color,rough=.8):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*color,1);m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=rough;materials[name]=m;return name
def geom(name,vs,fs):
 v,f=meshdata.setdefault(name,([],[]));off=len(v);v.extend(vs);f.extend([tuple(off+i for i in face) for face in fs])
def box(name,x,y,z,w,d,h):
 vs=[(x+sx*w/2,y+sy*d/2,z+sz*h/2) for sx,sy,sz in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]];geom(name,vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
def cyl(name,x,y,z,r,h,n=12,r2=None):
 r2=r if r2 is None else r2;v=[(x+rad*math.cos(i*math.tau/n),y+rad*math.sin(i*math.tau/n),z+zz) for rad,zz in [(r,-h/2),(r2,h/2)] for i in range(n)];geom(name,v,[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)])
def branch(a,b,r):
 from mathutils import Vector
 av=Vector(a);bv=Vector(b);d=(bv-av).normalized();u=d.cross(Vector((0,0,1)))
 if u.length<.01:u=d.cross(Vector((1,0,0)))
 u.normalize();v=d.cross(u);verts=[]
 for center,radius in [(av,r),(bv,r*.45)]:
  for i in range(6):verts.append(tuple(center+(u*math.cos(i*math.tau/6)+v*math.sin(i*math.tau/6))*radius))
 geom('bark',verts,[(i,(i+1)%6,(i+1)%6+6,i+6) for i in range(6)])
def tree(x,y,z=0,h=3):
 from mathutils import Vector
 branch((x,y,z),(x+.07*h,y,z+h*.87),h*.035)
 for k in range(10):
  a=k*2.4;bx=x+math.cos(a)*h*.25;by=y+math.sin(a)*h*.25;bz=z+h*(.55+.045*(k%7))
  branch((x,y,z+h*.45),(bx,by,bz),h*.014)
  for twig in range(3):
   ta=a+twig*2;branch((bx,by,bz),(bx+math.cos(ta)*h*.16,by+math.sin(ta)*h*.16,bz+h*.1),h*.005)
  for i in range(100):
   a=rng.random()*math.tau;r=math.sqrt(rng.random())*h*.23
   center=Vector((bx+math.cos(a)*r,by+math.sin(a)*r,bz+rng.uniform(-.13,.22)*h))
   yaw=rng.random()*math.tau;tilt=rng.uniform(-1.2,1.2);length=h*rng.uniform(.045,.065)
   u=Vector((math.cos(yaw),math.sin(yaw),math.sin(tilt)))*length
   v=Vector((-math.sin(yaw),math.cos(yaw),.25))*(length*.45)
   geom('leaves'+str(i%3),[tuple(center-u),tuple(center+v),tuple(center+u),tuple(center-v),tuple(center+Vector((0,0,length*.2)))],[(0,1,4),(1,2,4),(2,3,4),(3,0,4)])

def roof(x,y,z,w,d):
 geom('roof',[(x-w/2,y-d/2,z),(x+w/2,y-d/2,z),(x+w/2,y+d/2,z),(x-w/2,y+d/2,z),(x,y-d/2,z+1.3),(x,y+d/2,z+1.3)],[(0,4,5,3),(4,1,2,5),(0,1,4),(3,5,2)])
def house(x,y,z=0,w=3.5,d=4,h=3,style='home'):
 box('brick' if style=='barn' else 'plaster',x,y,z+h/2,w,d,h);roof(x,y,z+h,w+.4,d+.3)
 for yy in [-1,1]:
  for xx in [-.28,.28]:
   box('trim',x+xx*w,y+yy*(d/2+.035),z+h*.63,.85,.08,1.0);box('glass',x+xx*w,y+yy*(d/2+.09),z+h*.63,.69,.035,.84);box('trim',x+xx*w,y+yy*(d/2+.12),z+h*.63,.05,.03,.9)
 box('bark',x,y-d/2-.05,z+.85,.65,.08,1.7);box('stone',x,y-d/2-.45,z+.06,1.3,.9,.12);box('road',x,y-d/2-2,z+.015,1.3,3,.03);box('brick',x+w*.26,y,z+h+.45,.5,.55,1)
 if style=='barn':
  box('trim',x,y-d/2-.12,z+1,1.8,.05,2);box('brick',x,y-d/2-.16,z+1,1.65,.04,1.85)
def scene(style):
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);meshdata.clear();materials.clear()
 for name,c in {'plaster':(.72,.69,.59),'stone':(.48,.52,.52),'brick':(.45,.18,.12),'roof':(.19,.24,.28),'glass':(.27,.45,.51),'trim':(.85,.84,.76),'road':(.19,.21,.22),'mark':(.86,.83,.66),'water':(.22,.46,.53),'bark':(.27,.20,.13),'leaves0':(.20,.34,.19),'leaves1':(.32,.43,.23),'leaves2':(.41,.49,.25),'field':(.58,.58,.28),'grass':(.37,.47,.26),'sand':(.70,.66,.47)}.items():mat(name,c,.28 if name in ['glass','water'] else .86)
 if style=='city':
  z=-30
  box('water',0,70,z-.1,240,110,.2)
  box('stone',0,-20,z-.1,170,70,.2)
  box('road',0,-35,z,165,40,.2);box('stone',0,12,z+.05,140,5,.3)
  for lane in range(2):
   for x in range(-65,66,5):box('mark',x,-18-lane*6,z+.12,2,.1,.02)
  for i in range(36):
   x=-68+(i%18)*8;y=-28-(i//18)*15;h=rng.uniform(13,43);w=rng.uniform(3.3,6);d=rng.uniform(4,7)
   box('stone',x,y,z+h/2,w,d,h);box('glass',x,y-.03,z+h/2,w-.22,d+.1,h-.4)
   for f in range(1,int(h/2.3)):
    box('trim',x,y,z+f*2.3,w+.3,d+.25,.14)
   for xx in range(-2,3):box('stone',x+xx*w/5,y-d/2-.1,z+h/2,.1,.15,h)
   box('stone',x,y,z+h+.3,w+.3,d+.3,.6);box('roof',x+.4,y,z+h+.8,w*.4,d*.4,1)
  # CN-inspired observation tower; original simplified geometry.
  cyl('stone',-17,-22,z+30,.5,60,16,.2);cyl('trim',-17,-22,z+40,2.0,2,24,2.5);cyl('glass',-17,-22,z+41.2,2.0,.7,24);cyl('trim',-17,-22,z+42,2.1,.5,24,.9);cyl('stone',-17,-22,z+56,.12,22,10,.04)
  # Harbour promenade, marina fingers, sails and islands.
  for x in range(-55,60,10):
   box('sand',x,22,z+.12,1,16,.24)
   for yy in [20,25]:
    box('trim',x+2,yy,z+.38,2.4,.85,.45);cyl('stone',x+2,yy,z+2,.035,3,6);geom('trim',[(x+2,yy,z+3.3),(x+2,yy,z+.8),(x+3.5,yy,z+.8)],[(0,1,2)])
  for i in range(70):tree(rng.uniform(-65,65),rng.choice([12,85])+rng.uniform(-1,1),z,2.2)
  for i in range(7):box('grass',-65+i*21,88,z+.25,23,12,.6)
 else:
  for i in range(28):
   a=i*math.tau/28;r=24+rng.uniform(0,7);x=r*math.cos(a);y=r*math.sin(a)
   if style=='suburban':
    if i%2==0:house(x,y,w=3.6,d=4.2,h=3+rng.random())
    else:tree(x,y,h=3.2)
   elif style=='farm':
    if i in [0,7,14,21]:
     house(x,y,w=5,d=6,h=4,style='barn');cyl('stone',x+4,y,3,1,6,16);cyl('roof',x+4,y,6.4,1.1,.8,16,.2)
    else:
     for j in range(8):box('field',x+j*.32,y,.1,.14,5,.2)
   elif style=='medieval':
    if i%4==0:cyl('stone',x,y,3,1.5,6,16);cyl('roof',x,y,7.1,1.9,2.2,16,.02)
    else:house(x,y,w=3,d=3.5,h=3.2)
   else:
    tree(x,y,h=3+rng.random()*3)
    tree(x*1.22+1,y*1.22-1,h=3+rng.random()*4)
    tree(x*1.42-1,y*1.42+1,h=3+rng.random()*3)
  # Continuous softly rolling ground; no separated concentric bands.
  vs=[];fs=[];n=128;rows=28
  for j in range(rows):
   r=32+j*1.7;t=j/(rows-1)
   for i in range(n):
    a=i*math.tau/n;z=t*t*(2+math.sin(a*3+.4)*1.3+math.cos(a*7)*.5)*4;vs.append((r*math.cos(a),r*math.sin(a),z))
  for j in range(rows-1):
   for i in range(n):fs.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
  geom('grass',vs,fs)
  if style in ['suburban','medieval']:
   vs=[];fs=[]
   for i in range(129):
    a=i*math.tau/128
    for r in [18.5,20.5]:vs.append((r*math.cos(a),r*math.sin(a),.02))
   for i in range(128):fs.append((i*2,i*2+1,i*2+3,i*2+2))
   geom('road',vs,fs)
  if style=='rural':
   vs=[];fs=[]
   for i in range(60):
    x=22+i*.8;y=math.sin(i*.12)*5
    for side in [-1,1]:vs.append((x,y+side*1.4,.04))
   for i in range(59):fs.append((i*2,i*2+1,i*2+3,i*2+2))
   geom('water',vs,fs)
  if style=='farm':
   for x in range(-30,31,2):
    for y in [-18,18]:box('bark',x,y,.6,.08,.08,1.2);box('trim',x,y,.6,2,.06,.1)
 for name,(vs,fs) in meshdata.items():
  mesh=bpy.data.meshes.new(name);mesh.from_pydata(vs,[],fs);mesh.materials.append(materials[name]);o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o)
  if name=='grass':
   for p in mesh.polygons:p.use_smooth=True
 bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets-source/blender'/('backdrop-'+style+'.blend')))
 bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/furniture'/('backdrop-'+style+'.glb')),export_format='GLB',export_yup=True,export_extras=True)
 print('SCENERY DONE',style,sum(len(v) for v,f in meshdata.values()))
for style in ['suburban','rural','farm','medieval']:scene(style)

# Apartment shell sits below the editable plan; no roof over the user's rooms.
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);meshdata.clear()
box('stone',0,0,-15.1,10,10,30)
for level in range(10):
 z=-1.6-level*3
 for side in [-1,1]:
  box('glass',0,side*5.03,z,9.8,.08,2.5);box('glass',side*5.03,0,z,.08,9.8,2.5)
  for j in range(-4,5,2):
   box('trim',j,side*5.12,z,.08,.08,2.7);box('trim',side*5.12,j,z,.08,.08,2.7)
 box('trim',0,0,z-1.4,10.3,10.3,.15)
for name,(vs,fs) in meshdata.items():
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(vs,[],fs);mesh.materials.append(materials[name]);o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets-source/blender/backdrop-apartment-base.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/furniture/backdrop-apartment-base.glb'),export_format='GLB',export_yup=True)
