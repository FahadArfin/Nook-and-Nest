"""Construction-aware appliance refinement and original luxury countertop collection."""
import bpy,math,json,sys,types,subprocess
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
# Reuse the tested bevel, tube and material helpers without running that collection.
ns={'__file__':str(ROOT/'tools/blender/build_luxury_kitchen.py')}
exec((ROOT/'tools/blender/build_luxury_kitchen.py').read_text(encoding='utf-8').split('wanted=set(')[0],ns)
box,cyl,curve,ring,mat=[ns[k] for k in ['box','cyl','curve','ring','mat']]
OLD=json.loads((ROOT/'tools/blender/appliance_inventory.json').read_text(encoding='utf-8'))
NEW=json.loads((ROOT/'src/applianceExpansion.json').read_text(encoding='utf-8'))
FAMILIES=json.loads((ROOT/'tools/blender/appliance_new_families.json').read_text(encoding='utf-8'))

def lathe(n,x,y,profile,m,segments=64):
 vs=[(x+r*math.cos(i*2*math.pi/segments),y+r*math.sin(i*2*math.pi/segments),z) for r,z in profile for i in range(segments)]
 fs=[(j*segments+i,j*segments+(i+1)%segments,(j+1)*segments+(i+1)%segments,(j+1)*segments+i) for j in range(len(profile)-1) for i in range(segments)]
 me=bpy.data.meshes.new(n);me.from_pydata(vs,[],fs);me.materials.append(m);o=bpy.data.objects.new(n,me);bpy.context.collection.objects.link(o)
 for p in me.polygons:p.use_smooth=True
 return o

def dial(x,y,z,r,M):
 cyl('Machined control bezel',(x,y,z),r,.008,M['trim'],'Y');cyl('Knurled control grip',(x,y-.007,z),r*.82,.012,M['black'],'Y')
 for i in range(24):
  a=i*2*math.pi/24;cyl('Knurl ridge',(x+r*.82*math.cos(a),y-.009,z+r*.82*math.sin(a)),r*.035,.009,M['steel'],'Y',8)
 for i in range(11):
  a=math.radians(35+i*29);box('Calibrated dial index',(x+r*1.22*math.cos(a),y-.005,z+r*1.22*math.sin(a)),(.002,.001,.004),M['light'],0)

def display(x,y,z,w,h,M):
 box('Recessed control display',(x,y,z),(w,.004,h),M['glass'])
 for i in range(3):
  xx=x-w*.27+i*w*.27
  for zz in [-h*.27,0,h*.27]:box('Seven segment horizontal',(xx,y-.003,z+zz),(w*.13,.001,h*.045),M['light'],0)
  for sx in [-1,1]:
   for sz in [-1,1]:box('Seven segment upright',(xx+sx*w*.065,y-.003,z+sz*h*.135),(w*.024,.001,h*.19),M['light'],0)

def grille(x,y,z,w,h,M,n=12):
 box('Inset ventilation panel',(x,y,z),(w,.002,h),M['black'],.002)
 for i in range(n):box('Individual louver',(x,y-.002,z-h*.43+i*h*.86/(n-1)),(w*.93,.003,h*.035),M['steel'],.0005)

def rim_bowl(x,y,z,r,height,M,key='steel'):
 return lathe('Double-wall open bowl',x,y,[(0,z),(r*.43,z),(r*.69,z+height*.12),(r*.91,z+height*.55),(r,z+height),(r-.004,z+height),(r*.88,z+height*.52),(r*.64,z+.012),(0,z+.012)],M[key])

def new_model(row):
 bpy.ops.wm.read_factory_settings(use_empty=True);M=ns['materials']();M['case']=mat('variant-surface',(.055,.15,.13),.48);M['clear']=mat('clear-appliance-vessel',(.65,.81,.85),.16,.02,.20)
 id=row[0];w,d,h=[v/1000 for v in row[3:6]];f=FAMILIES[id]
 B=lambda n,p,s,m='case',b=.012:box(n,p,s,M[m],b)
 C=lambda n,p,r,hh,m='steel',axis='Z':cyl(n,p,r,hh,M[m],axis)
 for x in [-w*.32,w*.32]:
  for y in [-d*.32,d*.32]:C('Isolation foot',(x,y,.012),min(w,d)*.06,.024,'black')
 if f=='espresso':
  B('Steel base',(0,0,.045),(w,d,.07),'steel');B('Boiler housing',(0,d*.21,h*.48),(w*.93,d*.49,h*.77),'steel');B('Control bridge',(0,-d*.07,h*.75),(w,d*.27,h*.22),'case')
  B('Cup warming deck',(0,d*.08,h*.885),(w*.88,d*.70,.018),'steel')
  for x in [-w*.40,w*.40]:curve('Cup retention rail',[(x,-d*.17,h*.91),(x,d*.37,h*.91)],.004,M['trim'])
  for x in [-w*.23,w*.23]:
   C('Gauge rim',(x,-d*.219,h*.76),.029,.010,'trim','Y');C('Gauge face',(x,-d*.228,h*.76),.024,.002,'white','Y');curve('Gauge needle',[(x,-d*.231,h*.76),(x+.01,-d*.231,h*.778)],.001,M['black'])
   for i in range(9):a=i*math.pi/8;B('Gauge graduation',(x+.020*math.cos(a),-d*.231,h*.76+.02*math.sin(a)),(.001,.001,.003),'black',0)
  C('Group head',(0,-d*.17,h*.57),.045,.045);C('Portafilter basket',(0,-d*.17,h*.53),.037,.03)
  curve('Portafilter grip',[(0,-d*.18,h*.53),(0,-d*.42,h*.51)],.012,M['black'])
  for side in [-1,1]:
   curve('Articulated steam and water wand',[(side*w*.39,-d*.14,h*.62),(side*w*.43,-d*.25,h*.47),(side*w*.36,-d*.31,h*.27)],.004,M['steel']);dial(side*w*.39,-d*.215,h*.76,.018,M)
  for i in range(22):B('Drip tray rib',(-w*.42+i*w*.84/21,-d*.24,.09),(.004,d*.41,.007),'steel',.001)
 elif f=='grinder':
  B('Weighted grinder foot',(0,0,.023),(w,d,.045),'steel');B('Rear motor tower',(0,d*.19,h*.35),(w*.70,d*.42,h*.64),'case',.024)
  C('Burr chamber',(0,d*.02,h*.63),w*.32,d*.40,'steel','Y');dial(0,-d*.19,h*.63,w*.27,M)
  r=w*.28;lathe('Single dose hopper',0,d*.10,[(0,h*.72),(r*.5,h*.72),(r,h*.83),(r,h*.94),(r-.003,h*.94),(r-.003,h*.84),(r*.43,h*.74)],M['clear'])
  C('Hopper cap',(0,d*.10,h*.955),r*1.03,.012,'black');C('Cap grip',(0,d*.10,h*.98),r*.27,.012,'black')
  curve('Ground coffee delivery chute',[(0,-d*.08,h*.55),(0,-d*.25,h*.47)],.012,M['steel']);rim_bowl(0,-d*.26,.048,w*.24,h*.21,M)
  B('Power rocker',(w*.355,d*.10,h*.32),(.007,.025,.020),'black');grille(0,d*.405,h*.32,w*.48,h*.19,M)
 elif f in ['blender','processor','juicer']:
  baseh=h*(.35 if f in ['blender','processor'] else .43);B('Sculpted motor base',(0,0,baseh/2),(w*.83,d*.79,baseh),'case',.025);dial(-w*.15,-d*.40,baseh*.53,.023,M);display(w*.16,-d*.40,baseh*.55,w*.21,.027,M)
  r=min(w,d)*(.34 if f=='processor' else .30);top=h*.83 if f=='processor' else h*.94
  lathe('Clear graduated vessel',0,0,[(0,baseh),(r*.70,baseh),(r*.78,baseh+.03),(r,top-.035),(r-.004,top-.035),(r*.73,baseh+.035),(0,baseh+.03)],M['clear'])
  C('Vessel locking collar',(0,0,baseh+.015),r*.83,.02,'black');C('Fitted lid',(0,0,top-.025),r*1.04,.025,'black')
  if f=='processor':
   B('Wide feed chute',(0,0,h*.90),(w*.30,d*.25,h*.18),'clear',.006);B('Nested feed pusher',(0,0,h*.995),(w*.25,d*.20,.012),'black')
  elif f=='juicer':
   C('Feed chute',(0,0,h*.93),r*.57,h*.13,'black');curve('Juice outlet',[(r*.7,-.025,baseh+.045),(w*.49,-.05,baseh+.035)],.012,M['steel']);curve('Pulp outlet',[(-r*.8,0,baseh+.08),(-w*.48,0,baseh+.055)],.018,M['black'])
   for i in range(5):ring('Auger helix section',(0,0,baseh+.04+i*.025),r*(.6-i*.06),M['steel'],.004)
  elif f=='grinder':
   for i in range(32):a=i*2*math.pi/32;C('Grind collar detent',(r*.88*math.cos(a),r*.88*math.sin(a),baseh+.025),.0015,.017)
   curve('Ground coffee chute',[(0,-d*.24,baseh*.77),(0,-d*.39,baseh*.64)],.017,M['steel']);rim_bowl(0,-d*.27,.025,w*.18,h*.22,M)
  else:C('Removable lid plug',(0,0,top),r*.35,.025,'clear')
  if f in ['blender','processor']:
   curve('Generous vessel handle',[(r*.87,.01,top-.06),(w*.48,.01,top-.06),(w*.48,.01,baseh+.055),(r*.77,.01,baseh+.055)],.009,M['black'])
   C('Blade spindle',(0,0,baseh+.055),.012,.065)
   for i in range(4):o=B('Stainless cutting blade',(0,0,baseh+.065),(r*1.40,.013,.003),'steel',.001);o.rotation_euler.z=i*math.pi/2;o.rotation_euler.y=.13*(-1)**i
  for i in range(7):B('Vessel measurement mark',(-r*.27,-r*.87,baseh+.05+i*(top-baseh-.10)/6),(r*.28,.0015,.0014),'white',0)
 elif f=='kettle':
  B('Temperature control base',(0,0,.026),(w*.76,d*.91,.052),'black');display(w*.13,-d*.46,.033,w*.22,.021,M);dial(-w*.21,-d*.46,.030,.018,M)
  r=d*.36;lathe('Tapered kettle vessel',-.015,0,[(0,.055),(r,.055),(r,.08),(r*.83,h*.73),(0,h*.73)],M['case']);C('Lid sealing ring',(-.015,0,h*.735),r*.84,.009);C('Fitted kettle lid',(-.015,0,h*.76),r*.81,.009,'case');C('Lid button',(-.015,0,h*.80),.012,.018,'black')
  a=Vector((-.015-r,0,.10));b=Vector((-w*.53,0,.085));c=Vector((-w*.53,0,h*.93));e=Vector((-w*.37,0,h*.82));pts=[(1-t)**3*a+3*(1-t)**2*t*b+3*(1-t)*t*t*c+t**3*e for t in [i/28 for i in range(29)]];curve('Fine curved pouring spout',pts,.007,M['steel']);curve('Counterbalanced open handle',[(r*.45,0,h*.65),(w*.35,0,h*.71),(w*.44,0,h*.60),(w*.39,0,h*.31),(r*.72,0,h*.32)],.014,M['black'])
 elif f=='mixer':
  B('Cast mixer foot',(0,0,.030),(w*.95,d*.91,.060),'case',.025);B('Rear mixer pedestal',(0,d*.25,h*.47),(w*.47,d*.35,h*.76),'case',.035);B('Sculpted tilt motor head',(0,-d*.02,h*.80),(w*.67,d*.85,h*.25),'case',.040)
  C('Attachment hub',(0,-d*.445,h*.80),w*.15,.018,'trim','Y');C('Hub cap',(0,-d*.456,h*.80),w*.12,.009,'case','Y');C('Head hinge',(0,d*.25,h*.68),.032,w*.51,'steel','X')
  rim_bowl(0,-d*.16,.065,w*.40,h*.43,M);curve('Bowl loop grip',[(w*.35,-d*.16,h*.35),(w*.47,-d*.16,h*.36),(w*.49,-d*.16,h*.23),(w*.34,-d*.16,h*.23)],.008,M['steel'])
  C('Planetary drive',(0,-d*.18,h*.59),.026,.06);C('Whisk shaft',(0,-d*.18,h*.43),.004,h*.27)
  for i in range(10):
   a=i*math.pi/5;curve('Balloon whisk wire',[(0,-d*.18,h*.53),(.058*math.cos(a),-d*.18+.058*math.sin(a),h*.26),(0,-d*.18,h*.20)],.0017,M['steel'])
  curve('Speed slide lever',[(-w*.29,d*.09,h*.73),(-w*.44,d*.07,h*.73)],.004,M['steel'])
 elif f=='toaster':
  B('Rounded toaster lower shell',(0,0,h*.40),(w,d,h*.79),'case',.025)
  # Genuine separated slots, no solid top across the bread openings.
  for j in range(5):B('Polished top bridge',(-w*.40+j*w*.20,0,h*.87),(w*.04,d*.89,h*.14),'steel',.007)
  for y in [-d*.42,d*.42]:B('Slot end cap',(0,y,h*.87),(w*.86,d*.07,h*.14),'steel')
  for j in range(4):
   x=-w*.30+j*w*.20;B('Deep bread well',(x,0,h*.80),(w*.13,d*.73,.003),'black',0)
   for k in range(9):B('Bread centering wire',(x,-d*.31+k*d*.62/8,h*.84),(w*.12,.0015,.002),'steel',0)
  for x in [-w*.24,w*.24]:dial(x,-d*.50,h*.39,.023,M);B('Lifting lever track',(x+w*.13,-d*.505,h*.50),(.007,.003,h*.33),'black');B('Bread lift grip',(x+w*.13,-d*.53,h*.59),(.032,.024,.011),'steel')
 elif f=='oven':
  B('Oven floor',(0,0,.028),(w,d,.055),'steel');B('Rear convection wall',(0,d*.47,h*.48),(w,.04,h*.91),'black');B('Oven roof',(0,0,h*.955),(w,d,.03),'steel')
  for x in [-w*.48,w*.48]:B('Insulated side shell',(x,0,h*.50),(w*.04,d,h*.90),'steel')
  ns['oven_door'](-w*.06,-d*.49,h*.47,w*.80,h*.78,M)
  B('Control column',(w*.42,-d*.475,h*.49),(w*.15,.025,h*.86),'steel');display(w*.42,-d*.491,h*.73,w*.12,h*.13,M)
  for z in [h*.49,h*.29]:dial(w*.42,-d*.50,z,.022,M)
  for z in [h*.28,h*.52]:
   for i in range(15):B('Deep oven rack wire',(-w*.40+i*w*.70/14,0,z),(.002,d*.75,.002),'steel',0)
  C('Convection fan guard',(-w*.10,d*.44,h*.52),h*.22,.006,'steel','Y')
 elif f=='rice':
  B('Rounded pressure body',(0,0,h*.40),(w,d,h*.76),'case',.055);B('Insulated steam lid',(0,0,h*.83),(w*.98,d*.96,h*.17),'white',.040);B('Lid seam',(0,0,h*.74),(w*.985,d*.965,.007),'black')
  C('Pressure release',(0,d*.20,h*.94),.028,.018,'black');C('Lid steam vent',(w*.26,d*.20,h*.925),.010,.007)
  display(0,-d*.50,h*.50,w*.45,h*.16,M)
  for x in [-w*.34,w*.34]:dial(x,-d*.50,h*.50,.018,M)
  curve('Swing carry handle',[(-w*.48,0,h*.56),(-w*.45,0,h*.98),(w*.45,0,h*.98),(w*.48,0,h*.56)],.011,M['black'])
 elif f=='waffle':
  B('Removable drip tray',(0,0,.025),(w,d,.035),'steel');B('Rotary pedestal',(0,d*.32,h*.40),(w*.35,d*.23,h*.72),'case');r=w*.43
  for z in [h*.40,h*.49]:C('Cast waffle plate',(0,-d*.04,z),r,.02,'black')
  for z in [h*.40+.014,h*.49-.014]:
   for i in range(-5,6):
    xx=i*r/6;length=2*math.sqrt(max(0,r*r-xx*xx))*.94;B('Waffle grid rib',(xx,-d*.04,z),(.005,length,.009),'steel',.001);B('Waffle cross rib',(0,-d*.04+xx,z),(length,.005,.009),'steel',.001)
  # Open upper lid reveals the second cast grid.
  upper=[o for o in bpy.context.scene.objects if o.type=='MESH' and ('waffle plate' in o.name and o.location.z>h*.45 or ('Waffle grid' in o.name or 'Waffle cross' in o.name) and o.location.z>h*.45)]
  lid=C('Rounded waffle lid',(0,-d*.04,h*.56),r,.04,'case');upper.append(lid)
  from mathutils import Matrix
  pivot=Vector((0,-d*.04+r,h*.49));transform=Matrix.Translation(pivot)@Matrix.Rotation(math.radians(-62),4,'X')@Matrix.Translation(-pivot)
  for o in upper:o.matrix_world=transform@o.matrix_world
  curve('Cool-touch rotary grip',[(0,-d*.08,h*.58),(0,-d*.48,h*.58)],.018,M['black']);dial(0,d*.205,h*.72,.020,M)
 elif f=='soda':
  B('Bottle platform',(0,0,.025),(w,d,.05),'steel');B('Sculpted rear tower',(0,d*.26,h*.50),(w*.48,d*.30,h),'steel',.04);B('Arched dispenser head',(0,d*.02,h*.91),(w*.64,d*.65,h*.15),'steel',.035);C('Carbonation nozzle',(0,-d*.17,h*.79),.008,.055)
  r=w*.24;lathe('Reusable glass bottle',0,-d*.15,[(0,.06),(r,.06),(r,.10),(r,h*.48),(r*.43,h*.62),(r*.43,h*.69),(r*.35,h*.69),(r*.35,h*.62),(r*.90,h*.47),(r*.90,.07),(0,.07)],M['clear']);C('Bottle neck collar',(0,-d*.15,h*.66),r*.45,.019,'black');C('Carbonation button',(0,d*.04,h*.999),.018,.005,'black')
 elif f=='icecream':
  B('Compressor base',(0,0,h*.39),(w,d,h*.73),'steel',.025);r=d*.36
  # Opening in upper deck is formed by separate borders around the churn bowl.
  for x in [-w*.46,w*.46]:B('Top side border',(x,0,h*.81),(w*.08,d,h*.16),'steel')
  for y in [-d*.46,d*.46]:B('Top end border',(0,y,h*.81),(w,d*.08,h*.16),'steel')
  rim_bowl(-w*.05,0,h*.72,r,h*.11,M);C('Clear churn lid',(-w*.05,0,h*.865),r,.009,'clear');C('Churn shaft',(-w*.05,0,h*.79),.008,h*.15);B('Churning paddle',(-w*.05,0,h*.79),(r*1.5,.008,.03),'white')
  display(w*.18,-d*.50,h*.53,w*.32,h*.15,M);dial(-w*.27,-d*.50,h*.52,.025,M);grille(0,-d*.50,h*.18,w*.70,h*.18,M)
 elif f=='ice':
  B('Compressor enclosure',(0,0,h*.19),(w,d,h*.38),'steel');B('Insulated rear',(0,d*.32,h*.65),(w,d*.32,h*.69),'steel');B('Insulated lid',(0,0,h*.98),(w,d,.035),'steel')
  for x in [-w*.47,w*.47]:B('Ice bin side',(x,-d*.09,h*.63),(w*.05,d*.72,h*.50),'steel')
  B('Clear ice-bin front',(0,-d*.45,h*.64),(w*.88,.005,h*.48),'clear');B('Ice bin bottom',(0,-d*.08,h*.41),(w*.85,d*.65,.012),'white')
  for i in range(36):
   x=((i*7)%11-5)*w*.066;y=((i*3)%7-3)*d*.075;B('Individual ice nugget',(x,y,h*.44+(i%3)*.009),(.012,.016,.011),'white',.003)
  grille(0,-d*.501,h*.18,w*.86,h*.21,M);display(0,-d*.465,h*.88,w*.30,.025,M)
 return M

def refine(row):
 id=row['id'];baseline=ROOT/'.generated/appliance-baselines'/f'{id}.blend';baseline.parent.mkdir(parents=True,exist_ok=True)
 baseline.write_bytes(subprocess.check_output(['git','show',f'5814e0954ac5d093c23f32f92f2e846b386d9291:assets-source/blender/{id}.blend'],cwd=ROOT))
 bpy.ops.wm.open_mainfile(filepath=str(baseline));M=ns['materials']();w,d,h=[row[k]/1000 for k in ['widthMm','depthMm','heightMm']]
 old=[o for o in bpy.context.scene.objects if o.type=='MESH'];bpy.context.view_layer.update()
 # Construction detail follows the local front face of the actual authored component.
 for o in old:
  n=o.name.lower();pts=[o.matrix_world@Vector(p) for p in o.bound_box];lo=[min(p[i] for p in pts) for i in range(3)];hi=[max(p[i] for p in pts) for i in range(3)];sx,sy,sz=[hi[i]-lo[i] for i in range(3)];cx=(lo[0]+hi[0])/2;z=(lo[2]+hi[2])/2;y=lo[1]-.0004
  if any(k in n for k in ['housing','enclosure','_body','side wall','side shell']) and sx>w*.30 and sz>h*.25:
   # Service-panel fasteners sit on the side face, away from controls and glass.
   x=hi[0]+.0002
   for yy in [lo[1]+sy*.20,hi[1]-sy*.20]:
    for zz in [lo[2]+sz*.15,hi[2]-sz*.15]:cyl('Recessed service fastener',(x,yy,zz),min(w,h)*.005,.0012,M['steel'],'X',12)
  if any(k in n for k in ['control_band','control_rail','fascia','control_bridge','control_panel']) and sx>w*.28:
   for i in range(5):box('Etched control legend',(cx-sx*.33+i*sx*.165,y,z-sz*.26),(.007,.001,.002),M['light'],0)
  if any(k in n for k in ['door','drawer','panel']) and sx>w*.30 and sz>h*.15 and sy<d*.35 and not any(k in n for k in ['glass','pane','side','back','cavity']):
   for zz in [lo[2]+.004,hi[2]-.004]:curve('Fine perimeter gasket',[(lo[0]+.005,y+.0006,zz),(hi[0]-.005,y+.0006,zz)],.0007,M['black'])
  if any(k in n for k in ['dial','knob','control grip']) and sx>w*.025 and sx<w*.24 and 'tick' not in n:
   r=min(sx,sz)*.45
   for i in range(20):a=i*math.pi/10;cyl('Precision grip rib',(cx+r*math.cos(a),y+.001,z+r*math.sin(a)),max(.0005,w*.0013),.003,M['steel'],'Y',8)
 if id in ['electric-kettle','rice-cooker']:
  display(0,-d*.40,h*.44,w*.32,h*.13,M)
  if id=='electric-kettle':
   box('Water-level window',(w*.22,-d*.37,h*.51),(.018,.006,h*.30),M['window'])
   for i in range(6):box('Water-level calibration',(w*.22,-d*.375,h*.38+i*h*.045),(.012,.001,.0015),M['light'],0)
  else:
   cyl('Pressure vent',(w*.20,d*.16,h*.91),.019,.012,M['black']);ring('Lid sealing edge',(0,0,h*.85),min(w,d)*.43,M['steel'],.002)
 elif id in ['food-processor','countertop-blender']:
  for i in range(12):a=i*math.pi/6;box('Vessel locking tooth',(w*.26*math.cos(a),d*.26*math.sin(a),h*.34),(.009,.009,.008),M['black'])
  if id=='food-processor':
   for o in old:
    if any(k in o.name for k in ['jug','processing_blade','sealed_jug_lid']):o.scale.x*=1.14;o.scale.y*=1.14
   box('Nested feed chute',(0,0,h*.88),(w*.24,d*.24,h*.17),M['window'],.005)
 elif id in ['stand-mixer']:
  cyl('Attachment drive hub',(0,-d*.42,h*.77),w*.15,.014,M['trim'],'Y');cyl('Hub cap',(0,-d*.435,h*.77),w*.11,.009,M['steel'],'Y')
  curve('Speed control lever',[(-w*.28,d*.12,h*.72),(-w*.43,d*.07,h*.72)],.004,M['steel'])
  for i in range(8):a=i*math.pi/4;curve('Whisk cage wire',[(0,-d*.15,h*.54),(.05*math.cos(a),-d*.15+.05*math.sin(a),h*.28),(0,-d*.15,h*.20)],.0015,M['steel'])
 elif id in ['espresso-machine','bean-coffee-machine','filter-coffee-maker']:
  if id=='filter-coffee-maker':
   for i in range(6):box('Carafe volume marking',(-w*.16,-d*.30,h*.19+i*h*.046),(w*.12,.001,.0015),M['light'],0)
   curve('Filter release tab',[(w*.25,0,h*.72),(w*.40,-d*.03,h*.72)],.006,M['steel'])
  else:
   display(0,-d*.39,h*.83,w*.25,h*.085,M)
   for x in [-w*.38,w*.38]:curve('Cup warming guard',[(x,0,h*.92),(x,d*.30,h*.92)],.003,M['steel'])
   for i in range(12):box('Drip tray mesh crossbar',(0,-d*.37+i*d*.018,h*.11),(w*.68,.0015,.002),M['steel'],0)
 elif id=='two-slot-toaster':
  for x in [-w*.23,w*.23]:
   for i in range(9):box('Bread centering grid',(x,-d*.29+i*d*.073,h*.82),(w*.22,.0015,.003),M['steel'],0)
  box('Crumb tray pull',(0,-d*.48,h*.09),(w*.43,.007,.013),M['steel'])
 elif id=='knife-block':
  for o in old:
   if 'handle' in o.name:
    p=o.matrix_world.translation;cyl('Handle end rivet',(p.x,p.y-.008,p.z),.002,.002,M['steel'],'Y',12)
 elif id=='citrus-press':
  for i in range(24):a=i*math.pi/12;cyl('Juice strainer perforation',(w*.23*math.cos(a),d*.23*math.sin(a),h*.31),.002,.001,M['black'],vertices=8)
  curve('Drip-stop outlet',[(0,-d*.23,h*.30),(0,-d*.39,h*.27)],.007,M['steel'])
 elif id=='waffle-iron':
  lid=next(o for o in old if o.name=='hinged_waffle_lid')
  # Recover the plane of the baked tilted lid, then detail its visible inner face.
  import numpy as np
  points=np.array([tuple(lid.matrix_world@v.co) for v in lid.data.vertices]);center=Vector(points.mean(axis=0));values,vectors=np.linalg.eigh(np.cov(points.T));normal=Vector(vectors[:,0])
  if normal.y>0:normal=-normal
  u=Vector((1,0,0));u=(u-normal*u.dot(normal)).normalized();v=normal.cross(u);r=w*.42
  front=max((Vector(p)-center).dot(normal) for p in points)+.002;center+=normal*front
  for i in range(-5,6):
   span=math.sqrt(1-(i/6)**2)*r
   for axis,other in [(u,v),(v,u)]:
    curve('Upper cast waffle grid',[center+axis*i*r/6-other*span,center+axis*i*r/6+other*span],.0017,M['black'])
 elif id in ['glass-air-fryer']:
  for i in range(12):a=i*math.pi/6;curve('Basket radial rib',[(0,0,h*.22),(w*.35*math.cos(a),d*.31*math.sin(a),h*.22)],.002,M['steel'])
  display(0,-d*.34,h*.83,w*.30,h*.08,M)
 elif id=='countertop-microwave':
  display(w*.38,-d*.439,h*.72,w*.13,h*.06,M)
  for x in [-w*.36,w*.36]:box('Microwave foot pad',(x,0,.005),(.025,d*.55,.010),M['black'])
  for i in range(12):box('Microwave side air slot',(w*.499,d*.10+i*d*.025,h*.73),(.0015,.004,h*.11),M['black'],.0003)
 elif 'hood' in id:
  grille(0,-d*.43,h*.17,w*.65,h*.085,M,7)
  for x in [-w*.30,w*.30]:cyl('Recessed task light',(x,-d*.15,.008),.025,.004,M['light'])
 elif id in ['washer','dryer','stacked-laundry','dishwasher']:
  if id=='dishwasher':
   ns['handle']('Recessed dishwasher pull',0,-d*.48,h*.83,w*.58,M);grille(0,-d*.48,h*.075,w*.70,h*.055,M,6)
  else:
   for zz in ([h*.43,h*.91] if id=='stacked-laundry' else [h*.88]):display(-w*.12,-d*.47,zz,w*.22,h*.035,M)
   for zz in ([h*.25,h*.75] if id=='stacked-laundry' else [h*.48]):
    curve('Door latch grip',[(w*.23,-d*.46,zz-.035),(w*.25,-d*.49,zz),(w*.23,-d*.46,zz+.035)],.006,M['steel'])
 elif 'fridge' in id or id=='refrigerator':
  for x in [-w*.45,w*.45]:
   for z in [h*.15,h*.80]:box('Door hinge cover',(x,-d*.43,z),(w*.027,.015,h*.025),M['steel'])
  if 'glass' not in id and id!='wine-fridge':display(0,-d*.445,h*.76,w*.12,h*.022,M)
 elif 'cooktop' in id or id=='induction-hob':
  for i in range(5):box('Touch power indicator',(-w*.13+i*w*.065,-d*.40,h*.97),(.003,.010,.0006),M['light'],0)
  for x in [-w*.44,w*.44]:box('Edge sealing strip',(x,0,h*.30),(.003,d*.80,.003),M['black'],0)
 elif 'oven' in id or 'range' in id:
  if id=='range-oven':
   for x in [-w*.25,w*.25]:
    for y in [-d*.22,d*.22]:ns['burner'](x,y,h*.996,.046,M)
  for x in [-w*.34,w*.34]:box('Lower door hinge detail',(x,-d*.445,h*.15),(.035,.009,.018),M['steel'])
  grille(0,d*.49,h*.63,w*.55,h*.12,M)
 return M

def export(id,dims):
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];bpy.context.view_layer.update();points=[o.matrix_world@v.co for o in meshes for v in o.data.vertices];lo=[min(p[i] for p in points) for i in range(3)];hi=[max(p[i] for p in points) for i in range(3)]
 for o in meshes:
  matrix=o.matrix_world.copy();o.data=o.data.copy()
  for v in o.data.vertices:
   p=matrix@v.co;v.co=Vector(((p.x-(hi[0]+lo[0])/2)*dims[0]/(hi[0]-lo[0]),(p.y-(hi[1]+lo[1])/2)*dims[1]/(hi[1]-lo[1]),(p.z-lo[2])*dims[2]/(hi[2]-lo[2])))
  o.matrix_world.identity()
  if not o.data.uv_layers:
   uv=o.data.uv_layers.new(name='UVMap')
   for loop in o.data.loops:p=o.data.vertices[loop.vertex_index].co;uv.data[loop.index].uv=(p.x,p.y)
 scene=bpy.context.scene;scene['nominal_dimensions_m']=dims;scene['appliance_detail_pass']=2;bpy.context.preferences.filepaths.save_version=0
 bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets-source/blender'/f'{id}.blend'))
 bpy.ops.object.select_all(action='DESELECT')
 for o in meshes:o.select_set(True)
 bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.join();bpy.context.object.name=id
 bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/furniture'/f'{id}.glb'),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_animations=False)
 print('APPLIANCE_DONE',id,flush=True)

wanted=set(sys.argv[sys.argv.index('--')+1:]) if '--' in sys.argv else set()
for r in OLD:
 if not wanted or r['id'] in wanted:refine(r);export(r['id'],[r[k]/1000 for k in ['widthMm','depthMm','heightMm']])
for r in NEW:
 if not wanted or r[0] in wanted:new_model(r);export(r[0],[v/1000 for v in r[3:6]])
