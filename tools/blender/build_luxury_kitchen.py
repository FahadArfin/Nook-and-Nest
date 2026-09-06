"""Luxury kitchen collection: original editable assemblies, exact catalog bounds, bounded GLB exports."""
import bpy,math,json,sys
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[2]
ROWS=json.loads((ROOT/'src/luxuryExpansion.json').read_text(encoding='utf-8-sig'))
OUT=ROOT/'assets-source/blender';WEB=ROOT/'public/models/furniture'
OUT.mkdir(parents=True,exist_ok=True);WEB.mkdir(parents=True,exist_ok=True)

def mat(name,c,rough=.4,metal=0,alpha=1):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,alpha);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;p.inputs['Alpha'].default_value=alpha;m.diffuse_color=(*c,alpha)
 if alpha<1:m.surface_render_method='DITHERED'
 return m

def materials():
 return {'steel':mat('brushed-stainless-steel',(.43,.48,.52),.32,.78),'black':mat('black-enamel',(.015,.019,.024),.38),
 'glass':mat('black-ceramic-glass',(.018,.03,.04),.14,.12),'window':mat('tinted-appliance-glazing',(.12,.22,.26),.18,.05,.24),
 'iron':mat('cast-iron-grates',(.024,.029,.034),.8,.2),'red':mat('ruby-control-knobs',(.48,.012,.018),.35),
 'trim':mat('polished-chrome-trim',(.65,.70,.73),.22,.9),'white':mat('porcelain-white',(.83,.84,.82),.28),
 'case':mat('lacquered-cabinet-panels',(.05,.105,.155),.58),'top':mat('countertop-surface',(.73,.75,.72),.55),
 'light':mat('display-markings',(.58,.75,.79),.45),'brass':mat('satin-champagne-hardware',(.49,.36,.17),.37,.7)}

def finish(o,n,m):
 o.name=n;o.data.materials.append(m);return o

def box(n,p,d,m,b=.003):
 bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.dimensions=d;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if b:
  mod=o.modifiers.new('Machined soft edges','BEVEL');mod.width=min(b,min(d)*.3);mod.segments=3;bpy.ops.object.modifier_apply(modifier=mod.name)
  mod=o.modifiers.new('Weighted panel normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=mod.name)
 return finish(o,n,m)

def cyl(n,p,r,h,m,axis='Z',vertices=32):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=h,location=p);o=bpy.context.object
 if axis=='Y':o.rotation_euler.x=math.pi/2
 if axis=='X':o.rotation_euler.y=math.pi/2
 for poly in o.data.polygons:poly.use_smooth=len(poly.vertices)==4
 return finish(o,n,m)

def curve(n,pts,r,m):
 cu=bpy.data.curves.new(n,'CURVE');cu.dimensions='3D';cu.bevel_depth=r;cu.bevel_resolution=3
 sp=cu.splines.new('POLY');sp.points.add(len(pts)-1)
 for p,v in zip(sp.points,pts):p.co=(*v,1)
 o=bpy.data.objects.new(n,cu);bpy.context.collection.objects.link(o);cu.materials.append(m);bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False);return o

def ring(n,p,r,m,t=.002):return curve(n,[(p[0]+r*math.cos(i*2*math.pi/64),p[1]+r*math.sin(i*2*math.pi/64),p[2]) for i in range(65)],t,m)

def handle(n,x,y,z,w,M):
 for sx in [-1,1]:cyl(n+' standoff',(x+sx*w/2,y+.017,z),.009,.035,M['steel'],'Y',20)
 return cyl(n+' bar',(x,y,z),.012,w+.023,M['steel'],'X',24)

def vhandle(n,x,y,z,h,M):
 for zz in [z-h/2,z+h/2]:cyl(n+' bracket',(x,y+.015,zz),.012,.04,M['steel'],'Y',20)
 cyl(n+' grip',(x,y,z),.014,h+.024,M['steel'],vertices=24)

def markings(x,y,z,w,M):
 box('Control display',(x,y,z),(w,.004,.035),M['glass'],.002)
 for i in range(4):box('Display digit',(x-w*.30+i*w*.19,y-.003,z),(.009,.001,.012),M['light'],.0004)

def burner(x,y,z,r,M):
 cyl('Burner steel socket',(x,y,z),r*1.2,.007,M['steel']);cyl('Stacked burner ring',(x,y,z+.011),r,.016,M['black'])
 cyl('Burner cap',(x,y,z+.022),r*1.03,.006,M['iron'])
 for i in range(16):
  a=2*math.pi*i/16;box('Burner gas port',(x+r*math.cos(a),y+r*math.sin(a),z+.012),(.004,.004,.004),M['steel'],.0003)
 for side in [-1,1]:
  box('Cast grate crossbar',(x+side*r*.92,y,z+.037),(.013,r*3.2,.016),M['iron'])
  box('Cast grate support',(x,y+side*r*.92,z+.037),(r*3.2,.013,.016),M['iron'])

def cook_surface(w,d,z,mode,M,count=4):
 box('Inset cooking surface',(0,0,z-.012),(w-.035,d-.03,.026),M['glass'] if mode!='gas' else M['steel'])
 for side in [-1,1]:box('Cooktop side rim',(side*(w/2-.007),0,z-.01),(.014,d,.026),M['steel'])
 if mode=='gas':
  pos=[(-w*.28,-d*.18),(w*.28,-d*.18),(-w*.28,d*.20),(w*.28,d*.20)]
  if count==5:pos.append((0,0))
  if count==6:pos=[(x,y) for x in [-w*.32,0,w*.32] for y in [-d*.2,d*.2]]
  for x,y in pos:burner(x,y,z,.044 if count!=6 else .040,M)
 else:
  for x,y,r in [(-w*.25,-d*.16,.082),(w*.24,-d*.16,.071),(-w*.24,d*.23,.068),(w*.23,d*.23,.091)]:
   ring('Cooking zone outline',(x,y,z+.002),r,M['light'],.0012)
   if mode=='electric':ring('Radiant inner circuit',(x,y,z+.002),r*.72,M['light'],.0008)
   else:
    box('Induction zone center',(x,y,z+.002),(.016,.0015,.0007),M['light'],0);box('Induction zone center',(x,y,z+.002),(.0015,.016,.0007),M['light'],0)
  for i in range(6):box('Touch slider indicator',(-.065+i*.026,-d*.40,z+.002),(.012,.005,.0007),M['light'],0)

def oven_door(x,y,z,w,h,M):
 box('Oven dark cavity',(x,y+.040,z),(w-.018,.02,h-.016),M['black'])
 for zz in [z-h/2+.020,z+h/2-.020]:box('Door steel horizontal frame',(x,y,zz),(w,.035,.038),M['steel'])
 for xx in [x-w/2+.017,x+w/2-.017]:box('Door steel upright',(xx,y,z),(.032,.035,h-.038),M['steel'])
 for zz in [z-h*.22,z,z+h*.20]:
  box('Visible oven rack',(x,y+.021,zz),(w*.77,.009,.004),M['trim'],.001)
  for i in range(7):box('Rack depth wire',(x-w*.32+i*w*.106,y+.045,zz),(.002,.052,.002),M['trim'],0)
 box('Triple-glass oven pane',(x,y-.001,z),(w-.074,.004,h-.077),M['window'],.002)
 handle('Heavy oven handle',x,y-.047,z+h*.33,w*.76,M)


def range_model(row,M):
 id=row[0];w,d,h=[v/1000 for v in row[3:6]];mode='gas' if 'gas' in id or 'dual' in id else 'electric' if 'electric' in id else 'induction'
 box('Appliance enclosure',(0,.02,h*.45),(w-.014,d-.10,h*.88),M['steel'],.012)
 box('Recessed black plinth',(0,0,.045),(w-.075,d-.08,.090),M['black'])
 front=-d/2+.054
 box('Control fascia',(0,front,h-.115),(w-.012,.055,.13),M['steel'])
 n=7 if 'dual' in id else 6 if mode=='gas' else 4
 for i in range(n):
  x=-w*.40+i*w*.80/(n-1);cyl('Control bezel',(x,front-.034,h-.105),.026,.013,M['trim'],'Y');cyl('Tactile range knob',(x,front-.049,h-.105),.021,.025,M['red'] if mode=='gas' else M['black'],'Y')
  box('Knob indicator',(x,front-.064,h-.090),(.003,.001,.008),M['light'],.0003)
 if 'dual' in id:
  oven_door(-w*.19,front-.012,h*.43,w*.59,h*.56,M);oven_door(w*.31,front-.012,h*.43,w*.36,h*.56,M)
 else:oven_door(0,front-.012,h*.43,w-.040,h*.56,M)
 for i in range(15):box('Toe ventilation slot',(-w*.40+i*w*.8/14,front-.004,.105),(.027,.008,.009),M['black'],.001)
 cook_surface(w,d-.045,h-.045,mode,M,4 if 'dual' in id else 6)
 if 'dual' in id:
  box('Central steel griddle',(0,0,h-.013),(w*.20,d*.70,.014),M['steel']);box('Griddle grease channel',(0,-d*.33,h-.005),(w*.16,.018,.010),M['black'])
 box('Rear vent riser',(0,d/2-.028,h-.013),(w-.02,.045,.026),M['steel'])

def wall_oven(row,M):
 id=row[0];w,d,h=[v/1000 for v in row[3:6]]
 box('Built-in oven casing',(0,.016,h/2),(w-.024,d-.060,h-.020),M['black'],.01)
 f=-d/2+.033
 box('Flush trim surround',(0,f+.016,h/2),(w,.02,h),M['steel'])
 n=2 if 'double' in id else 1;dh=(h-.13)/n
 for i in range(n):oven_door(0,f-.022,.035+dh*(i+.5),w-.03,dh-.015,M)
 box('Black-glass controls',(0,f-.032,h-.053),(w-.033,.01,.075),M['glass']);markings(0,f-.039,h-.050,w*.27,M)
 if 'steam' in id:box('Water reservoir access',(-w*.34,f-.040,h-.052),(w*.18,.006,.052),M['steel'])

def cooktop(row,M):
 w,d,h=[v/1000 for v in row[3:6]];gas='gas' in row[0]
 box('Low-profile cooktop chassis',(0,0,.018),(w-.026,d-.026,.036),M['black'])
 cook_surface(w,d,h-.045 if gas else h-.004,'gas' if gas else 'induction',M,5)
 if gas:
  for i in range(5):cyl('Cooktop control dial',(-w*.3+i*w*.15,-d*.39,h-.025),.017,.014,M['steel'])

def fridge(row,M):
 id=row[0];w,d,h=[v/1000 for v in row[3:6]];f=-d/2+.065
 box('Refrigerator insulated back',(0,d/2-.03,h/2),(w,.06,h),M['steel'])
 for x in [-w/2+.024,w/2-.024]:box('Refrigerator side wall',(x,.01,h/2),(.048,d-.05,h),M['steel'])
 box('Toe kick',(0,0,.055),(w-.06,d-.10,.11),M['black'])
 box('Insulated refrigerator roof',(0,.012,h-.025),(w-.03,d-.03,.05),M['steel'])
 box('Lower appliance base',(0,f,.12),(w-.05,.035,.13),M['black'])
 box('Crown grille recess',(0,f+.006,h-.14),(w-.04,.04,.26),M['black'])
 for i in range(13):box('Crown horizontal louver',(0,f-.006,h-.255+i*.019),(w-.05,.022,.009),M['steel'],.001)
 if 'column' in id:
  box('Panel-ready lacquer face',(0,f,.5*(h-.24)+.05),(w-.025,.036,h-.24),M['white'],.006)
  vhandle('Column pull',-w*.39,f-.045,h*.52,h*.38,M)
  for x in [-w*.44,w*.44]:box('Inset door border',(x,f-.020,h*.48),(.005,.003,h*.76),M['steel'],.0005)
 elif 'french' in id:
  for side in [-1,1]:
   box('French refrigerator door',(side*w*.25,f,h*.64),(w*.49,.035,h*.45),M['steel'],.008)
   vhandle('French door handle',side*.055,f-.052,h*.65,h*.34,M)
  for z in [h*.18,h*.33]:
   box('Freezer drawer front',(0,f,z),(w-.022,.04,h*.14),M['steel'],.007);handle('Freezer drawer handle',0,f-.055,z+h*.035,w*.73,M)
 else:
  for side in [-1,1]:
   for z in [h*.16,h*.32]:
    box('Independent cold-storage drawer',(side*w*.245,f,z),(w*.48,.042,h*.15),M['steel'],.007);handle('Drawer pull',side*w*.245,f-.054,z+h*.03,w*.33,M)
  doorZ=h*.64;dh=h*.43
  box('Freezer upper door',(-w*.29,f,doorZ),(w*.40,.045,dh),M['steel'],.006);vhandle('Freezer pull',-w*.13,f-.060,doorZ,dh*.69,M)
  cx=w*.21;dw=w*.53
  box('Dark refrigerator interior',(cx,d*.27,doorZ),(dw-.02,.035,dh-.015),M['black'])
  for z in [h*.45,h*.53,h*.62,h*.71,h*.80]:
   box('Refrigerator glass shelf',(cx,0,z),(dw-.06,d*.70,.010),M['window']);box('Shelf front trim',(cx,f+.070,z),(dw-.06,.009,.012),M['trim'])
  for xx in [cx-dw/2+.018,cx+dw/2-.018]:box('Glass door steel frame',(xx,f,doorZ),(.036,.05,dh),M['steel'])
  for zz in [doorZ-dh/2+.018,doorZ+dh/2-.018]:box('Glass door cross frame',(cx,f,zz),(dw,.05,.036),M['steel'])
  box('Refrigerator tinted glass',(cx,f-.004,doorZ),(dw-.072,.006,dh-.072),M['window']);vhandle('Glass door pull',cx-dw*.37,f-.058,doorZ,dh*.69,M)

def rounded_rect(w,d,r,n=10):
 pts=[]
 for cx,cy,start in [(w/2-r,d/2-r,0),(-w/2+r,d/2-r,90),(-w/2+r,-d/2+r,180),(w/2-r,-d/2+r,270)]:
  for i in range(n):
   a=math.radians(start+i*90/(n-1));pts.append((cx+r*math.cos(a),cy+r*math.sin(a)))
 return pts

def bowl(x,y,z,w,d,depth,M,fire=False):
 # Continuous open bowl: rim, rounded sloping side walls, floor. No solid top slab.
 loops=[(w,d,z),(w-.026,d-.026,z-.008),(w-.046,d-.046,z-depth+.025),(w-.084,d-.084,z-depth)]
 vs=[];fs=[]
 for ww,dd,zz in loops:vs += [(x+a,y+b,zz) for a,b in rounded_rect(ww,dd,.035)]
 N=40
 for j in range(3):
  for i in range(N):fs.append((j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i))
 fs.append(tuple(range(3*N,4*N)))
 me=bpy.data.meshes.new('Hollow basin');me.from_pydata(vs,[],fs);me.materials.append(M['white'] if fire else M['steel']);o=bpy.data.objects.new('Deep recessed basin',me);bpy.context.collection.objects.link(o)
 for p in me.polygons:p.use_smooth=len(p.vertices)==4
 cyl('Recessed drain',(x,y,z-depth+.001),.036,.003,M['black']);ring('Drain steel ring',(x,y,z-depth+.003),.034,M['trim'],.002)
 for i in range(5):box('Drain strainer slot',(x-.022+i*.011,y,z-depth+.004),(.004,.043,.001),M['steel'],0)

def sink(row,M):
 id=row[0];w,d,h=[v/1000 for v in row[3:6]];farm='farmhouse' in id;double='double' in id;cab=M['white'] if farm else M['case'];top=.91
 box('Recessed cabinet plinth',(0,.01,.055),(w-.07,d-.09,.11),M['black'])
 for x in [-w/2+.022,w/2-.022]:box('Cabinet side panel',(x,0,.46),(.044,d-.03,.82),cab)
 box('Cabinet rear',(0,d/2-.025,.46),(w-.04,.035,.82),cab)
 if not farm: box('Solid basin fascia',(0,-d/2+.022,.785),(w-.035,.042,.23),cab,.005)
 for side in [-1,1]:
  x=side*w*.245;box('Inset cabinet door',(x,-d/2+.022,.38),(w*.48,.04,.58),cab,.006)
  for xx in [x-w*.21,x+w*.21]:box('Door stile',(xx,-d/2-.001,.38),(.019,.009,.54),cab)
  handle('Cabinet pull',x,-d/2-.029,.61,w*.29,M)
 bw=w-.16;bd=.43
 # Four separate stone borders leave a genuine sink opening.
 for yy,dep in [(-d/2+.04,.08),(d/2-.05,.10)]:box('Stone worktop border',(0,yy,top-.018),(w,dep,.036),M['top'])
 for x in [-w/2+.038,w/2-.038]:box('Stone side border',(x,0,top-.018),(.076,d-.17,.036),M['top'])
 if double:
  for side in [-1,1]:bowl(side*bw*.25,-.014,top-.005,bw*.49,bd,.20,M)
 else:bowl(0,-.014,top-.005,bw,bd,.22,M,farm)
 if farm:
  box('Exposed fireclay apron',(0,-d/2+.01,top-.115),(bw,.07,.23),M['white'],.015)
  for i in range(25):cyl('Fluted apron ridge',(-bw*.46+i*bw*.92/24,-d/2-.026,top-.115),.006,.19,M['white'],vertices=12)
 else:
  # Inset drain rack remains visibly below the rim, with an optional prep board.
  rackX=-bw*.24
  for i in range(13):cyl('Basin grid wire',(rackX-.15+i*.025,-.014,top-.15),.0018,.34,M['steel'],'Y',12)
  for yy in [-.17,.13]:cyl('Grid cross rail',(rackX,yy,top-.15),.002,.32,M['steel'],'X',12)
  box('Sliding preparation board',(bw*.28,-.014,top+.012),(bw*.24,bd-.025,.024),M['white'],.01)
  for i in range(10):box('Colander slots',(bw*.28-.07+i*.015,-.014,top+.025),(.006,bd*.65,.002),M['steel'],.002)
 # Swept gooseneck with a distinct pull-down head and independent mixer lever.
 pts=[(0,.235,top),(0,.235,top+.20)]
 pts += [(0,.145+.09*math.cos(t*math.pi/24),top+.20+.12*math.sin(t*math.pi/24)) for t in range(25)]
 curve('Gooseneck pull-down faucet',pts,.013,M['trim']);cyl('Pull-down spray head',(0,.055,top+.174),.019,.058,M['steel'])
 cyl('Faucet base',(0,.235,top+.007),.025,.014,M['steel']);cyl('Mixer pivot',(.06,.235,top+.018),.021,.035,M['steel'])
 curve('Mixer lever',[(.06,.235,top+.024),(.06,.235,top+.09),(.105,.235,top+.11)],.006,M['trim'])


def build(row):
 bpy.ops.wm.read_factory_settings(use_empty=True);M=materials();id=row[0];dims=[v/1000 for v in row[3:6]]
 if id=='skyline-gtr-brick':
  bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets-source/skyline-brick-study/skyline-gtr-brick.blend'))
  # Apply modifiers before batching so the rim and beam geometry survives the catalog export.
  for o in list(bpy.context.scene.objects):
   if o.type=='MESH':
    bpy.context.view_layer.objects.active=o
    for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
 elif 'cooktop' in id:cooktop(row,M)
 elif 'wall-oven' in id or 'steam-oven' in id:wall_oven(row,M)
 elif 'range' in id:range_model(row,M)
 elif 'fridge' in id:fridge(row,M)
 else:sink(row,M)
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];bpy.context.view_layer.update()
 points=[o.matrix_world@v.co for o in meshes for v in o.data.vertices];lo=[min(p[i] for p in points) for i in range(3)];hi=[max(p[i] for p in points) for i in range(3)]
 for o in meshes:
  matrix=o.matrix_world.copy()
  for v in o.data.vertices:
   p=matrix@v.co;v.co=Vector(((p.x-(hi[0]+lo[0])/2)*dims[0]/(hi[0]-lo[0]),(p.y-(hi[1]+lo[1])/2)*dims[1]/(hi[1]-lo[1]),(p.z-lo[2])*dims[2]/(hi[2]-lo[2])))
  o.matrix_world.identity();o['catalog_id']=id
  if not o.data.uv_layers:
   uv=o.data.uv_layers.new(name='UVMap')
   for loop in o.data.loops:
    p=o.data.vertices[loop.vertex_index].co;uv.data[loop.index].uv=(p.x,p.y)
 scene=bpy.context.scene;scene['catalog_id']=id;scene['nominal_dimensions_m']=dims
 bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(id+'.blend')))
 bpy.ops.object.select_all(action='DESELECT')
 for o in meshes:o.select_set(True)
 bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.join();bpy.context.object.name=id
 bpy.ops.export_scene.gltf(filepath=str(WEB/(id+'.glb')),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_animations=False)
 print('EXPORTED_LUXURY',id,flush=True)

wanted=set(sys.argv[sys.argv.index('--')+1:]) if '--' in sys.argv else set()
for row in ROWS:
 if not wanted or row[0] in wanted:build(row)
